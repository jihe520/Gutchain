import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import {
  GUTCHAIN_WECHAT_SHARE_STORAGE_KEY,
  type GutchainWechatShareStorageShape,
} from "../src/lib/storage";
import type { GutchainWechatSharePayload } from "../src/lib/wechat";

const TITLE_FIELD_SELECTORS = [
  '[name="title"] .ProseMirror',
  ".title-editor__input .ProseMirror",
  '[contenteditable="true"][data-placeholder*="标题"]',
  "input[placeholder*='标题']",
  "textarea[placeholder*='标题']",
];

const DESCRIPTION_FIELD_SELECTORS = [
  '[name="description"] .ProseMirror',
  '[name="digest"] .ProseMirror',
  ".desc-editor__input .ProseMirror",
  ".description-editor__input .ProseMirror",
  '[contenteditable="true"][data-placeholder*="描述"]',
  '[contenteditable="true"][data-placeholder*="了解更多内容"]',
  "input[placeholder*='描述']",
  "textarea[placeholder*='描述']",
];

export default defineContentScript({
  matches: ["https://mp.weixin.qq.com/*"],
  main() {
    void uploadWechatImageFromLatestGutchainShare();
  },
});

async function uploadWechatImageFromLatestGutchainShare(): Promise<void> {
  const payload = await getLatestPayload();
  if (!payload) return;

  showGutchainStatus("Preparing WeChat sticker...");

  try {
    await uploadWechatImage(payload);
    await fillWechatMetadata(payload);
    await browser.storage.local.remove(GUTCHAIN_WECHAT_SHARE_STORAGE_KEY);
    showGutchainStatus("Gutchain sticker filled. Review it before publishing.", "success");
    setTimeout(hideGutchainStatus, 5000);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown WeChat upload error.";
    showGutchainStatus(`Gutchain is waiting: ${message}`, "error");
  }
}

async function getLatestPayload(): Promise<GutchainWechatSharePayload | null> {
  const result = await browser.storage.local.get(GUTCHAIN_WECHAT_SHARE_STORAGE_KEY);
  return (
    (result as GutchainWechatShareStorageShape)[GUTCHAIN_WECHAT_SHARE_STORAGE_KEY] ?? null
  ) as GutchainWechatSharePayload | null;
}

async function uploadWechatImage(payload: GutchainWechatSharePayload): Promise<void> {
  const file = dataUrlToFile(payload.wechatStickerDataUrl, payload.wechatFilename);
  let lastTriggerClickAt = 0;
  let lastHomeClickAt = 0;

  const fileInput = await waitFor<HTMLInputElement>(
    () => {
      const input = findBestImageFileInput();
      if (input) return input;

      if (!isLikelyWechatStickerEditor()) {
        if (Date.now() - lastHomeClickAt > 2500) {
          clickStickerCreationEntry();
          lastHomeClickAt = Date.now();
        }
        return null;
      }

      if (Date.now() - lastTriggerClickAt > 2500) {
        clickImageUploadTrigger();
        lastTriggerClickAt = Date.now();
      }

      return null;
    },
    {
      timeout: 120000,
      errorMessage: "open the WeChat sticker editor, then choose the sticker upload area.",
    },
  );

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event("input", { bubbles: true }));
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
}

async function fillWechatMetadata(payload: GutchainWechatSharePayload): Promise<void> {
  const title = payload.xhsTitle || "来自 X 的分享";
  const description = payload.xhsBody || payload.tweetText;

  const titleField = await waitFor(
    () => findEditableField(TITLE_FIELD_SELECTORS),
    {
      timeout: 30000,
      errorMessage: "could not find the WeChat sticker title field.",
    },
  );
  setEditableValue(titleField, title);

  if (!description) return;

  const descriptionField = await waitFor(
    () => findEditableField(DESCRIPTION_FIELD_SELECTORS),
    {
      timeout: 30000,
      errorMessage: "could not find the WeChat sticker description field.",
    },
  );
  setEditableValue(descriptionField, description);
}

function findEditableField(selectors: string[]): HTMLElement | null {
  for (const doc of getAccessibleDocuments()) {
    for (const selector of selectors) {
      const field =
        Array.from(doc.querySelectorAll<HTMLElement>(selector))
          .map(resolveEditableElement)
          .find((candidate): candidate is HTMLElement => Boolean(candidate)) ?? null;

      if (field) return field;
    }
  }

  return null;
}

function resolveEditableElement(element: HTMLElement): HTMLElement | null {
  if (!isVisibleElement(element)) return null;
  if (element.matches('input, textarea, [contenteditable="true"], [role="textbox"]')) {
    return element;
  }

  const field = element.querySelector<HTMLElement>(
    'input, textarea, [contenteditable="true"], [role="textbox"]',
  );
  return field && isVisibleElement(field) ? field : null;
}

function setEditableValue(element: HTMLElement, value: string): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    setNativeInputValue(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  element.focus();
  const ownerDocument = element.ownerDocument;
  const selection = ownerDocument.getSelection();
  if (selection) {
    selection.removeAllRanges();
    const range = ownerDocument.createRange();
    range.selectNodeContents(element);
    selection.addRange(range);
  }

  if (ownerDocument.execCommand("insertText", false, value)) {
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    return;
  }

  const clipboardData = new DataTransfer();
  clipboardData.setData("text/plain", value);
  element.dispatchEvent(
    new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData,
    }),
  );

  if (!normalizeElementText(element).includes(value.slice(0, 8))) {
    element.textContent = value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  }
}

function findBestImageFileInput(): HTMLInputElement | null {
  const inputs = getAccessibleDocuments().flatMap((doc) =>
    Array.from(doc.querySelectorAll<HTMLInputElement>('input[type="file"]')),
  );
  const ranked = inputs
    .map((input) => ({ input, score: scoreFileInput(input) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.input ?? null;
}

function isLikelyWechatStickerEditor(): boolean {
  if (/\/cgi-bin\/appmsg/.test(window.location.pathname)) {
    const params = new URLSearchParams(window.location.search);
    return params.get("type") === "77" || params.get("createType") === "8";
  }

  return getAccessibleDocuments().some(
    (doc) =>
      /贴图/.test(doc.title) ||
      Array.from(doc.querySelectorAll<HTMLElement>(".appmsg_editor, .sticker, [class*='sticker']"))
        .some(isVisibleElement),
  );
}

function scoreFileInput(input: HTMLInputElement): number {
  const accept = input.accept.toLowerCase();
  const identifier = `${input.id} ${input.name} ${input.className}`.toLowerCase();
  const context = getElementContextText(input);

  if (accept.includes("video") || accept.includes("audio")) return -100;
  if (/(video|audio|voice)/i.test(identifier)) return -100;

  let score = 0;
  if (!accept || /image|png|jpe?g|gif|webp/.test(accept)) score += 4;
  if (/(image|img|pic|photo|upload|file)/i.test(identifier)) score += 2;
  if (input.multiple) score += 2;
  if (isVisibleElement(input)) score += 3;
  if (/贴图|图片|插入|上传|本地|正文/.test(context)) score += 3;
  if (/封面|头像|二维码|视频|音频|语音|附件/.test(context)) score -= 8;

  return score;
}

function clickStickerCreationEntry(): boolean {
  const candidates = [
    ".new-creation__menu-item",
    ".new-creation__menu-content",
    'button, a, [role="button"]',
  ];

  for (const doc of getAccessibleDocuments()) {
    for (const selector of candidates) {
      const trigger =
        Array.from(doc.querySelectorAll<HTMLElement>(selector)).find((element) => {
          if (!isVisibleElement(element)) return false;
          return normalizeElementText(element).includes("贴图");
        }) ?? null;

      if (trigger) {
        trigger.click();
        trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return true;
      }
    }
  }

  return false;
}

function clickImageUploadTrigger(): boolean {
  const textTriggers = [
    "上传贴图",
    "添加贴图",
    "贴图",
    "本地上传",
    "上传图片",
    "上传",
    "插入图片",
    "图片",
    "选择图片",
    "选择文件",
    "从电脑选择",
  ];

  for (const doc of getAccessibleDocuments()) {
    const elements = Array.from(
      doc.querySelectorAll<HTMLElement>('button, a, label, [role="button"], span, div, i'),
    );
    const trigger =
      elements.find((element) => {
        if (!isVisibleElement(element)) return false;
        const text = normalizeElementText(element);
        if (/封面|头像|二维码|视频|音频|语音|附件/.test(text)) return false;
        return textTriggers.some((candidate) => text === candidate || text.includes(candidate));
      }) ??
      elements.find((element) => {
        if (!isVisibleElement(element)) return false;
        const className = String(element.className);
        return /image|img|pic|photo/i.test(className) && !/cover|avatar|video/i.test(className);
      });

    if (trigger) {
      trigger.click();
      trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    }
  }

  return false;
}

function getAccessibleDocuments(): Document[] {
  const docs = [document];

  for (const frame of Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe"))) {
    try {
      if (frame.contentDocument) docs.push(frame.contentDocument);
    } catch {
      // Cross-origin editor frames are ignored; the top document still owns upload controls.
    }
  }

  return docs;
}

function getElementContextText(element: HTMLElement): string {
  const parts = [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("name"),
    element.getAttribute("placeholder"),
    element.getAttribute("data-placeholder"),
    element.className ? String(element.className) : "",
  ];
  let parent = element.parentElement;
  let depth = 0;

  while (parent && depth < 4) {
    parts.push(parent.innerText || parent.textContent || "");
    parent = parent.parentElement;
    depth += 1;
  }

  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [header, encoded] = dataUrl.split(",");
  const mimeType = header.match(/^data:(.*?);base64$/)?.[1] || "image/png";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: mimeType });
}

function setNativeInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(input, "value")?.set;
  const prototype = Object.getPrototypeOf(input);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(input, value);
  } else if (valueSetter) {
    valueSetter.call(input, value);
  } else {
    input.value = value;
  }
}

function normalizeElementText(element: HTMLElement): string {
  return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
}

function isVisibleElement(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

async function waitFor<T>(
  getter: () => T | null | undefined,
  options: { timeout: number; interval?: number; errorMessage: string },
): Promise<T> {
  const startedAt = Date.now();
  const interval = options.interval ?? 300;

  while (Date.now() - startedAt < options.timeout) {
    const value = getter();
    if (value) return value;
    await sleep(interval);
  }

  throw new Error(options.errorMessage);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showGutchainStatus(message: string, tone: "info" | "success" | "error" = "info"): void {
  const existing = document.getElementById("gutchain-wechat-status");
  const element = existing ?? document.createElement("div");
  element.id = "gutchain-wechat-status";
  element.textContent = message;
  element.setAttribute("role", "status");
  element.style.cssText = [
    "position: fixed",
    "right: 16px",
    "bottom: 16px",
    "z-index: 2147483647",
    "max-width: 360px",
    "padding: 10px 12px",
    "border-radius: 8px",
    "box-shadow: 0 8px 24px rgba(0,0,0,.18)",
    "font: 13px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
    "color: white",
    `background: ${tone === "success" ? "#16803c" : tone === "error" ? "#b42318" : "#1f2937"}`,
  ].join(";");

  if (!existing) document.documentElement.appendChild(element);
}

function hideGutchainStatus(): void {
  document.getElementById("gutchain-wechat-status")?.remove();
}
