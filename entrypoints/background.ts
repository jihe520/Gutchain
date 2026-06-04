import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

import {
  RELAY_MESSAGE,
  RELAY_SETTINGS_STORAGE_KEY,
  RELAY_SHARE_STORAGE_KEY,
  RELAY_XHS_PUBLISH_URL,
  type PopupShareResponse,
  type PopupStateResponse,
} from "../src/lib/messages";
import {
  createRelayPayload,
  DEFAULT_RELAY_SETTINGS,
  isSupportedXStatusUrl,
  type Rect,
  type RelaySettings,
  type TweetCaptureSnapshot,
} from "../src/lib/relay";
import { cropScreenshotDataUrl } from "../src/lib/screenshot";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(async (message): Promise<unknown> => {
    if (!isRelayMessage(message)) return undefined;

    if (message.type === RELAY_MESSAGE.POPUP_GET_STATE) {
      return getPopupState();
    }

    if (message.type === RELAY_MESSAGE.POPUP_SHARE_TO_XHS) {
      return shareActiveTweetToXhs();
    }

    return undefined;
  });
});

async function getPopupState(): Promise<PopupStateResponse> {
  const tab = await getActiveTab();
  const tabUrl = tab?.url;

  if (!tab?.id || !tabUrl) {
    return {
      isSupported: false,
      reason: "No active tab found.",
    };
  }

  if (!isSupportedXStatusUrl(tabUrl)) {
    return {
      isSupported: false,
      reason: "Open an X/Twitter post detail page first.",
      tabUrl,
    };
  }

  return {
    isSupported: true,
    tabUrl,
  };
}

async function shareActiveTweetToXhs(): Promise<PopupShareResponse> {
  try {
    const tab = await getActiveTab();
    if (!tab?.id || !isSupportedXStatusUrl(tab.url)) {
      return {
        ok: false,
        error: "Please open an X/Twitter post detail page first.",
      };
    }

    const snapshot = await collectTweetSnapshot(tab.id);

    if (!snapshot?.visibleRect || !snapshot.viewport) {
      return {
        ok: false,
        error: "Could not find a visible X post on this page.",
      };
    }

    const fullScreenshotDataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });
    const cropped = await cropScreenshotDataUrl(
      fullScreenshotDataUrl,
      snapshot.visibleRect,
      snapshot.viewport,
    );
    const payload = createRelayPayload(snapshot, cropped.dataUrl, cropped.size, {
      settings: await getRelaySettings(),
    });

    await browser.storage.local.set({
      [RELAY_SHARE_STORAGE_KEY]: payload,
    });

    const xhsTab = await browser.tabs.create({
      active: true,
      url: RELAY_XHS_PUBLISH_URL,
    });

    return {
      ok: true,
      payloadId: payload.id,
      xhsTabId: xhsTab.id,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown Relay error.",
    };
  }
}

async function getActiveTab() {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  return tab;
}

async function getRelaySettings(): Promise<RelaySettings> {
  const result = await browser.storage.local.get(RELAY_SETTINGS_STORAGE_KEY);
  const saved = result[RELAY_SETTINGS_STORAGE_KEY] as RelaySettings | undefined;

  return {
    ...DEFAULT_RELAY_SETTINGS,
    ...saved,
  };
}

async function collectTweetSnapshot(tabId: number): Promise<TweetCaptureSnapshot> {
  try {
    const snapshot = (await browser.tabs.sendMessage(tabId, {
      type: RELAY_MESSAGE.X_COLLECT_TWEET,
    })) as TweetCaptureSnapshot | undefined;

    if (snapshot) return snapshot;
  } catch {
    // Existing tabs may not have the manifest content script until they are reloaded.
  }

  const [result] = await browser.scripting.executeScript({
    target: { tabId },
    func: collectVisibleTweetSnapshotInPage,
  });

  if (!result?.result) {
    throw new Error("Could not collect the visible X post.");
  }

  return result.result as TweetCaptureSnapshot;
}

function collectVisibleTweetSnapshotInPage(): TweetCaptureSnapshot {
  function normalizeText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  function normalizeMultilineText(text: string): string {
    return text
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function isSupportedXStatusUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      const isXHost =
        hostname === "x.com" ||
        hostname.endsWith(".x.com") ||
        hostname === "twitter.com" ||
        hostname.endsWith(".twitter.com");

      return isXHost && /\/status\/\d+/.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  function isVisibleElement(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function clampRect(rect: DOMRect): Rect | null {
    const left = Math.max(0, rect.x);
    const top = Math.max(0, rect.y);
    const right = Math.min(window.innerWidth, rect.x + rect.width);
    const bottom = Math.min(window.innerHeight, rect.y + rect.height);
    const width = right - left;
    const height = bottom - top;

    if (width <= 0 || height <= 0) return null;

    return {
      x: left,
      y: top,
      width,
      height,
    };
  }

  if (!isSupportedXStatusUrl(window.location.href)) {
    throw new Error("Relay only supports X/Twitter post detail pages.");
  }

  const main = document.querySelector("main") ?? document.body;
  const article =
    Array.from(main.querySelectorAll<HTMLElement>('article[data-testid="tweet"]')).find(
      isVisibleElement,
    ) ?? null;

  if (!article) {
    throw new Error("Could not find the main X post.");
  }

  const visibleRect = clampRect(article.getBoundingClientRect());
  if (!visibleRect || visibleRect.width < 8 || visibleRect.height < 8) {
    throw new Error("The main X post is not visible in the current viewport.");
  }

  const tweetText = normalizeMultilineText(
    article.querySelector<HTMLElement>('div[data-testid="tweetText"]')?.innerText ?? "",
  );
  const userNameText = normalizeText(
    article.querySelector<HTMLElement>('[data-testid="User-Name"]')?.innerText ?? "",
  );
  const authorHandle = userNameText.match(/@[A-Za-z0-9_]+/)?.[0] ?? "";
  const authorName = normalizeText(
    userNameText
      .split("@")[0]
      .replace(/认证账号|Verified account|Verified/g, "")
      .trim(),
  );

  return {
    text: tweetText,
    authorName: authorName || authorHandle.replace(/^@/, ""),
    authorHandle,
    visibleRect,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };
}

function isRelayMessage(message: unknown): message is { type: string } {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    typeof (message as { type?: unknown }).type === "string"
  );
}
