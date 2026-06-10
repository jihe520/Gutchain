import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import {
  clampRectToViewport,
  type ImageSize,
  isSupportedXStatusUrl,
  normalizeMultilineText,
  normalizeText,
  type Rect,
  type TweetCaptureSnapshot,
  type TweetDomRenderResult,
} from "../src/lib/gutchain";
import { GUTCHAIN_MESSAGE } from "../src/lib/messages";

const DOM_RENDER_SCALE = 2;
const MAX_DOM_RENDER_SIDE = 8192;
const TRANSPARENT_PIXEL_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export default defineContentScript({
  matches: ["https://x.com/*", "https://twitter.com/*"],
  main() {
    browser.runtime.onMessage.addListener(async (message): Promise<unknown> => {
      if (!isGutchainMessage(message)) {
        return undefined;
      }

      if (message.type === GUTCHAIN_MESSAGE.X_COLLECT_TWEET) {
        return collectVisibleTweet();
      }

      if (message.type === GUTCHAIN_MESSAGE.X_RENDER_TWEET_IMAGE) {
        return renderVisibleTweetImage();
      }

      return undefined;
    });
  },
});

function collectVisibleTweet(): TweetCaptureSnapshot {
  const article = getVisibleTweetArticle();

  return collectTweetSnapshot(article);
}

async function renderVisibleTweetImage(): Promise<TweetDomRenderResult> {
  const article = getVisibleTweetArticle();
  const snapshot = collectTweetSnapshot(article);
  const image = await renderElementToPng(article);

  return {
    snapshot,
    imageDataUrl: image.dataUrl,
    imageSize: image.size,
  };
}

function getVisibleTweetArticle(): HTMLElement {
  if (!isSupportedXStatusUrl(window.location.href)) {
    throw new Error("Gutchain only supports X/Twitter post detail pages.");
  }

  const article = findMainTweetArticle();
  if (!article) {
    throw new Error("Could not find the main X post.");
  }

  return article;
}

function collectTweetSnapshot(article: HTMLElement): TweetCaptureSnapshot {
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
  const articles = Array.from(main.querySelectorAll<HTMLElement>('article[data-testid="tweet"]'));

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

async function renderElementToPng(
  element: HTMLElement,
): Promise<{ dataUrl: string; size: ImageSize }> {
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const clone = element.cloneNode(true) as HTMLElement;

  await inlineMediaAssets(element, clone);
  inlineComputedStyles(element, clone);
  removeUnsupportedCloneNodes(clone);
  prepareCloneRoot(clone, width, height);

  const xhtml = serializeCloneForForeignObject(clone, width, height, findRenderBackground(element));
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject>`,
    "</svg>",
  ].join("");
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const scale = getDomRenderScale(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create DOM render canvas.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas);

  return {
    dataUrl: await blobToDataUrl(blob),
    size: {
      width: canvas.width,
      height: canvas.height,
    },
  };
}

function removeUnsupportedCloneNodes(clone: HTMLElement) {
  for (const node of clone.querySelectorAll("script,noscript,link,style")) {
    node.remove();
  }
}

async function inlineMediaAssets(source: HTMLElement, clone: HTMLElement) {
  await Promise.all([inlineImageAssets(source, clone), inlineVideoPosters(source, clone)]);

  for (const sourceElement of clone.querySelectorAll("source")) {
    sourceElement.removeAttribute("srcset");
  }
}

async function inlineImageAssets(source: HTMLElement, clone: HTMLElement) {
  const sourceImages = Array.from(source.querySelectorAll("img"));
  const cloneImages = Array.from(clone.querySelectorAll("img"));

  await Promise.all(
    sourceImages.map(async (sourceImage, index) => {
      const cloneImage = cloneImages[index];
      if (!cloneImage) return;

      cloneImage.loading = "eager";
      cloneImage.decoding = "sync";
      cloneImage.removeAttribute("srcset");

      const dataUrl = await fetchImageAsDataUrl(sourceImage.currentSrc || sourceImage.src);
      cloneImage.src = dataUrl ?? TRANSPARENT_PIXEL_DATA_URL;
    }),
  );
}

async function inlineVideoPosters(source: HTMLElement, clone: HTMLElement) {
  const sourceVideos = Array.from(source.querySelectorAll("video"));
  const cloneVideos = Array.from(clone.querySelectorAll("video"));

  await Promise.all(
    sourceVideos.map(async (sourceVideo, index) => {
      const cloneVideo = cloneVideos[index];
      if (!cloneVideo) return;

      const posterDataUrl = await fetchImageAsDataUrl(sourceVideo.poster);
      cloneVideo.removeAttribute("src");
      cloneVideo.querySelectorAll("source").forEach((sourceElement) => {
        sourceElement.remove();
      });

      if (!posterDataUrl) return;

      cloneVideo.poster = posterDataUrl;
      cloneVideo.style.backgroundImage = `url("${posterDataUrl}")`;
      cloneVideo.style.backgroundPosition = "center";
      cloneVideo.style.backgroundSize = "cover";
    }),
  );
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  try {
    const response = await fetch(url, {
      credentials: "omit",
    });
    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;

    return blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function inlineComputedStyles(source: Element, clone: Element) {
  copyComputedStyle(source, clone);

  const sourceChildren = Array.from(source.children);
  const cloneChildren = Array.from(clone.children);

  for (const [index, sourceChild] of sourceChildren.entries()) {
    const cloneChild = cloneChildren[index];
    if (cloneChild) {
      inlineComputedStyles(sourceChild, cloneChild);
    }
  }
}

function copyComputedStyle(source: Element, clone: Element) {
  if (!(clone instanceof HTMLElement || clone instanceof SVGElement)) return;

  const computed = window.getComputedStyle(source);
  const targetStyle = clone.style;

  for (const property of computed) {
    targetStyle.setProperty(
      property,
      computed.getPropertyValue(property),
      computed.getPropertyPriority(property),
    );
  }

  targetStyle.setProperty("animation", "none", "important");
  targetStyle.setProperty("transition", "none", "important");
  targetStyle.setProperty("caret-color", "transparent", "important");
}

function prepareCloneRoot(clone: HTMLElement, width: number, height: number) {
  clone.style.position = "relative";
  clone.style.inset = "auto";
  clone.style.transform = "none";
  clone.style.margin = "0";
  clone.style.width = `${width}px`;
  clone.style.minWidth = `${width}px`;
  clone.style.maxWidth = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.minHeight = `${height}px`;
  clone.style.maxHeight = "none";
  clone.style.overflow = "hidden";
}

function serializeCloneForForeignObject(
  clone: HTMLElement,
  width: number,
  height: number,
  background: string,
): string {
  const container = document.createElement("div");
  container.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.overflow = "hidden";
  container.style.background = background;
  container.append(clone);

  return new XMLSerializer().serializeToString(container);
}

function findRenderBackground(element: HTMLElement): string {
  let current: HTMLElement | null = element;

  while (current) {
    const background = window.getComputedStyle(current).backgroundColor;
    if (isVisibleColor(background)) return background;
    current = current.parentElement;
  }

  const bodyBackground = window.getComputedStyle(document.body).backgroundColor;
  if (isVisibleColor(bodyBackground)) return bodyBackground;

  return "#ffffff";
}

function isVisibleColor(color: string): boolean {
  return Boolean(color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)");
}

function getDomRenderScale(width: number, height: number): number {
  const maxScale = Math.min(MAX_DOM_RENDER_SIDE / width, MAX_DOM_RENDER_SIDE / height);

  return Math.max(1, Math.min(DOM_RENDER_SCALE, maxScale));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load rendered DOM image."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Unable to encode DOM render canvas."));
      }
    }, "image/png");
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image blob."));
    reader.readAsDataURL(blob);
  });
}

function isGutchainMessage(message: unknown): message is { type: string } {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    typeof (message as { type?: unknown }).type === "string"
  );
}
