import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import { RELAY_SHARE_STORAGE_KEY, type RelayShareStorageShape } from "../src/lib/storage";
import type { RelaySharePayload } from "../src/lib/relay";

export default defineContentScript({
  matches: ["https://creator.xiaohongshu.com/*"],
  main() {
    void fillXhsDraftFromLatestRelayShare();
  },
});

async function fillXhsDraftFromLatestRelayShare(): Promise<void> {
  const payload = await getLatestPayload();
  if (!payload) return;

  showRelayStatus("Preparing Xiaohongshu draft...");

  try {
    await ensureImageTextMode();
    await uploadScreenshot(payload);
    await sleep(5000);
    await fillTitle(payload.xhsTitle);
    await fillBody(payload.xhsBody);
    await browser.storage.local.remove(RELAY_SHARE_STORAGE_KEY);
    showRelayStatus("Relay draft filled. Review it before publishing.", "success");
    setTimeout(hideRelayStatus, 5000);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Xiaohongshu fill error.";
    showRelayStatus(`Relay is waiting: ${message}`, "error");
  }
}

async function getLatestPayload(): Promise<RelaySharePayload | null> {
  const result = await browser.storage.local.get(RELAY_SHARE_STORAGE_KEY);
  return ((result as RelayShareStorageShape)[RELAY_SHARE_STORAGE_KEY] ?? null) as
    | RelaySharePayload
    | null;
}

async function ensureImageTextMode(): Promise<void> {
  if (document.querySelector('input[type="file"]')) return;

  const uploadButton = await waitFor(
    () => {
      const titleSpans = Array.from(
        document.querySelectorAll<HTMLElement>('span.title, span[class="title"]'),
      );
      return titleSpans.find((element) => normalizeElementText(element).includes("上传图文"));
    },
    {
      timeout: 15000,
      errorMessage: "please log in and open the image-text publish page.",
    },
  );

  uploadButton.click();
  uploadButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

async function uploadScreenshot(payload: RelaySharePayload): Promise<void> {
  const fileInput = await waitFor<HTMLInputElement>(
    () => document.querySelector('input[type="file"]'),
    {
      timeout: 15000,
      errorMessage: "could not find Xiaohongshu's file upload input.",
    },
  );
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(dataUrlToFile(payload.screenshotDataUrl, `relay-${payload.id}.png`));
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event("input", { bubbles: true }));
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
}

async function fillTitle(title: string): Promise<void> {
  const titleInput = await waitFor<HTMLInputElement>(
    () =>
      Array.from(document.querySelectorAll<HTMLInputElement>('input[type="text"]')).find(
        isVisibleElement,
      ) ?? null,
    {
      timeout: 15000,
      errorMessage: "could not find the Xiaohongshu title field.",
    },
  );

  setNativeInputValue(titleInput, title);
  titleInput.dispatchEvent(new Event("input", { bubbles: true }));
  titleInput.dispatchEvent(new Event("change", { bubbles: true }));
}

async function fillBody(body: string): Promise<void> {
  const editor = await waitFor<HTMLElement>(
    () =>
      Array.from(document.querySelectorAll<HTMLElement>('div[contenteditable="true"]')).find(
        isVisibleElement,
      ) ?? null,
    {
      timeout: 15000,
      errorMessage: "could not find the Xiaohongshu content editor.",
    },
  );

  editor.focus();
  const clipboardData = new DataTransfer();
  clipboardData.setData("text/plain", body);
  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData,
  });
  editor.dispatchEvent(pasteEvent);

  if (!normalizeElementText(editor).includes(body.slice(0, 12))) {
    editor.textContent = body;
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  }

  editor.blur();
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

function setNativeInputValue(input: HTMLInputElement, value: string): void {
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
  const interval = options.interval ?? 250;

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

function showRelayStatus(message: string, tone: "info" | "success" | "error" = "info"): void {
  const existing = document.getElementById("relay-xhs-status");
  const element = existing ?? document.createElement("div");
  element.id = "relay-xhs-status";
  element.textContent = message;
  element.setAttribute("role", "status");
  element.style.cssText = [
    "position: fixed",
    "right: 16px",
    "bottom: 16px",
    "z-index: 2147483647",
    "max-width: 320px",
    "padding: 10px 12px",
    "border-radius: 8px",
    "box-shadow: 0 8px 24px rgba(0,0,0,.18)",
    "font: 13px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
    "color: white",
    `background: ${tone === "success" ? "#16803c" : tone === "error" ? "#b42318" : "#1f2937"}`,
  ].join(";");

  if (!existing) document.documentElement.appendChild(element);
}

function hideRelayStatus(): void {
  document.getElementById("relay-xhs-status")?.remove();
}
