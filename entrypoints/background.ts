import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

import {
  GUTCHAIN_MESSAGE,
  GUTCHAIN_SETTINGS_STORAGE_KEY,
  GUTCHAIN_SHARE_STORAGE_KEY,
  GUTCHAIN_WECHAT_PUBLISH_URL,
  GUTCHAIN_WECHAT_SHARE_STORAGE_KEY,
  GUTCHAIN_XHS_PUBLISH_URL,
  type PopupShareResponse,
  type PopupStateResponse,
} from "../src/lib/messages";
import {
  createGutchainPayload,
  DEFAULT_GUTCHAIN_SETTINGS,
  isSupportedXStatusUrl,
  type Rect,
  type GutchainSettings,
  type TweetCaptureSnapshot,
} from "../src/lib/gutchain";
import { cropScreenshotDataUrl } from "../src/lib/screenshot";
import {
  buildWechatStickerPublishUrl,
  createGutchainWechatSharePayload,
} from "../src/lib/wechat";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isGutchainMessage(message)) return false;

    void handleGutchainMessage(message)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unknown Gutchain background error.",
        });
      });

    return true;
  });
});

async function handleGutchainMessage(message: { type: string }): Promise<unknown> {
  if (message.type === GUTCHAIN_MESSAGE.POPUP_GET_STATE) {
    return getPopupState();
  }

  if (message.type === GUTCHAIN_MESSAGE.POPUP_SHARE_TO_XHS) {
    return shareActiveTweetToXhs();
  }

  if (message.type === GUTCHAIN_MESSAGE.POPUP_SHARE_TO_WECHAT) {
    return shareActiveTweetToWechat();
  }

  return {
    ok: false,
    error: `Unsupported Gutchain message: ${message.type}`,
  };
}

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
    const payload = await captureActiveTweetPayload();

    await browser.storage.local.set({
      [GUTCHAIN_SHARE_STORAGE_KEY]: payload,
    });

    const xhsTab = await browser.tabs.create({
      active: true,
      url: GUTCHAIN_XHS_PUBLISH_URL,
    });

    return {
      ok: true,
      payloadId: payload.id,
      xhsTabId: xhsTab.id,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown Gutchain error.",
    };
  }
}

async function shareActiveTweetToWechat(): Promise<PopupShareResponse> {
  try {
    const payload = await captureActiveTweetPayload();
    const wechatPayload = createGutchainWechatSharePayload(payload);

    await browser.storage.local.set({
      [GUTCHAIN_WECHAT_SHARE_STORAGE_KEY]: wechatPayload,
    });

    const wechatTab = await browser.tabs.create({
      active: true,
      url: await getWechatPublishUrl(),
    });

    return {
      ok: true,
      payloadId: payload.id,
      wechatTabId: wechatTab.id,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown WeChat share error.",
    };
  }
}

async function captureActiveTweetPayload() {
  const tab = await getActiveTab();
  if (!tab?.id || !isSupportedXStatusUrl(tab.url)) {
    throw new Error("Please open an X/Twitter post detail page first.");
  }

  const snapshot = await collectTweetSnapshot(tab.id);

  if (!snapshot?.visibleRect || !snapshot.viewport) {
    throw new Error("Could not find a visible X post on this page.");
  }

  const fullScreenshotDataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  const cropped = await cropScreenshotDataUrl(
    fullScreenshotDataUrl,
    snapshot.visibleRect,
    snapshot.viewport,
  );

  return createGutchainPayload(snapshot, cropped.dataUrl, cropped.size, {
    settings: await getGutchainSettings(),
  });
}

async function getActiveTab() {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  return tab;
}

async function getWechatPublishUrl(): Promise<string> {
  const tabs = await browser.tabs.query({
    url: "https://mp.weixin.qq.com/*",
  });
  const token = tabs.map((tab) => extractWechatToken(tab.url)).find(Boolean);

  if (!token) return GUTCHAIN_WECHAT_PUBLISH_URL;

  return buildWechatStickerPublishUrl(token);
}

function extractWechatToken(url: string | undefined): string | null {
  if (!url) return null;

  try {
    return new URL(url).searchParams.get("token");
  } catch {
    return null;
  }
}

async function getGutchainSettings(): Promise<GutchainSettings> {
  const result = await browser.storage.local.get(GUTCHAIN_SETTINGS_STORAGE_KEY);
  const saved = result[GUTCHAIN_SETTINGS_STORAGE_KEY] as GutchainSettings | undefined;

  return {
    ...DEFAULT_GUTCHAIN_SETTINGS,
    ...saved,
  };
}

async function collectTweetSnapshot(tabId: number): Promise<TweetCaptureSnapshot> {
  try {
    const snapshot = (await browser.tabs.sendMessage(tabId, {
      type: GUTCHAIN_MESSAGE.X_COLLECT_TWEET,
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
    throw new Error("Gutchain only supports X/Twitter post detail pages.");
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

function isGutchainMessage(message: unknown): message is { type: string } {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    typeof (message as { type?: unknown }).type === "string"
  );
}
