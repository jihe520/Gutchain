import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import { GUTCHAIN_MESSAGE } from "../src/lib/messages";
import {
  clampRectToViewport,
  isSupportedXStatusUrl,
  normalizeMultilineText,
  normalizeText,
  type Rect,
  type TweetCaptureSnapshot,
} from "../src/lib/gutchain";

export default defineContentScript({
  matches: ["https://x.com/*", "https://twitter.com/*"],
  main() {
    browser.runtime.onMessage.addListener(async (message): Promise<unknown> => {
      if (!isGutchainMessage(message) || message.type !== GUTCHAIN_MESSAGE.X_COLLECT_TWEET) {
        return undefined;
      }

      return collectVisibleTweet();
    });
  },
});

function collectVisibleTweet(): TweetCaptureSnapshot {
  if (!isSupportedXStatusUrl(window.location.href)) {
    throw new Error("Gutchain only supports X/Twitter post detail pages.");
  }

  const article = findMainTweetArticle();
  if (!article) {
    throw new Error("Could not find the main X post.");
  }

  const rect = article.getBoundingClientRect();
  const visibleRect = clampRectToViewport(domRectToRect(rect), {
    width: window.innerWidth,
    height: window.innerHeight,
  });

  if (!visibleRect || visibleRect.width < 8 || visibleRect.height < 8) {
    throw new Error("The main X post is not visible in the current viewport.");
  }

  const author = extractAuthor(article);

  return {
    text: extractTweetText(article),
    authorName: author.name,
    authorHandle: author.handle,
    visibleRect,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };
}

function findMainTweetArticle(): HTMLElement | null {
  const main = document.querySelector("main") ?? document.body;
  const articles = Array.from(
    main.querySelectorAll<HTMLElement>('article[data-testid="tweet"]'),
  );

  return articles.find(isVisibleElement) ?? null;
}

function extractTweetText(article: HTMLElement): string {
  const textElement = article.querySelector<HTMLElement>('div[data-testid="tweetText"]');
  return normalizeMultilineText(textElement?.innerText ?? "");
}

function extractAuthor(article: HTMLElement): { name: string; handle: string } {
  const userNameElement = article.querySelector<HTMLElement>('[data-testid="User-Name"]');
  const userNameText = normalizeText(userNameElement?.innerText ?? "");
  const handle = userNameText.match(/@[A-Za-z0-9_]+/)?.[0] ?? "";
  const name = normalizeText(
    userNameText
      .split("@")[0]
      .replace(/认证账号|Verified account|Verified/g, "")
      .trim(),
  );

  return {
    name: name || handle.replace(/^@/, ""),
    handle,
  };
}

function isVisibleElement(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
}

function domRectToRect(rect: DOMRect): Rect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
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
