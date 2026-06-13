export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export interface ImageCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface TweetCaptureSnapshot {
  text: string;
  authorName: string;
  authorHandle: string;
  visibleRect: Rect;
  viewport: ViewportSize;
}

export interface TweetDomRenderResult {
  snapshot: TweetCaptureSnapshot;
  imageDataUrl: string;
  imageSize: ImageSize;
}

export type GutchainCaptureSource = "dom" | "screenshot";

export interface GutchainSharePayload {
  id: string;
  tweetText: string;
  authorName: string;
  authorHandle: string;
  screenshotDataUrl: string;
  cropRect: Rect;
  screenshotSize: ImageSize;
  captureSource?: GutchainCaptureSource;
  xhsTitle: string;
  xhsBody: string;
  createdAt: number;
}

export const GUTCHAIN_FRAME_PRESET_IDS = ["clean", "xhs", "wechat", "ink"] as const;

export type GutchainFramePresetId = (typeof GUTCHAIN_FRAME_PRESET_IDS)[number];

export interface GutchainSettings {
  includeAuthorInBody: boolean;
  screenshotFramePreset: GutchainFramePresetId;
}

export const DEFAULT_GUTCHAIN_SETTINGS: GutchainSettings = {
  includeAuthorInBody: true,
  screenshotFramePreset: "clean",
};

export interface CreateGutchainPayloadOptions {
  captureSource?: GutchainCaptureSource;
  settings?: GutchainSettings;
}

export function isSupportedXStatusUrl(url: string | undefined): boolean {
  if (!url) return false;

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

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function normalizeMultilineText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildXhsTitle(tweetText: string): string {
  const firstLine = tweetText.split(/\r?\n/).map(normalizeText).find(Boolean);

  if (!firstLine) return "来自 X 的分享";
  return Array.from(firstLine).slice(0, 20).join("");
}

export function buildXhsBody(
  tweetText: string,
  authorName: string,
  authorHandle: string,
  settings: Pick<GutchainSettings, "includeAuthorInBody"> = DEFAULT_GUTCHAIN_SETTINGS,
): string {
  const normalizedText = normalizeMultilineText(tweetText);
  const normalizedAuthorName = normalizeText(authorName);
  const normalizedHandle = normalizeAuthorHandle(authorHandle);
  const authorLine = [normalizedAuthorName, normalizedHandle].filter(Boolean).join(" ");

  if (!settings.includeAuthorInBody) return normalizedText;
  if (!normalizedText && !authorLine) return "";
  if (!normalizedText) return `作者：${authorLine}`;
  if (!authorLine) return normalizedText;

  return `${normalizedText}\n\n作者：${authorLine}`;
}

export function normalizeAuthorHandle(handle: string): string {
  const normalized = normalizeText(handle);
  if (!normalized) return "";
  return normalized.startsWith("@") ? normalized : `@${normalized}`;
}

export function normalizeGutchainSettings(settings: unknown): GutchainSettings {
  const candidate =
    typeof settings === "object" && settings !== null
      ? (settings as Record<string, unknown>)
      : undefined;

  return {
    includeAuthorInBody:
      typeof candidate?.includeAuthorInBody === "boolean"
        ? candidate.includeAuthorInBody
        : DEFAULT_GUTCHAIN_SETTINGS.includeAuthorInBody,
    screenshotFramePreset: isGutchainFramePresetId(candidate?.screenshotFramePreset)
      ? candidate.screenshotFramePreset
      : DEFAULT_GUTCHAIN_SETTINGS.screenshotFramePreset,
  };
}

export function isGutchainFramePresetId(value: unknown): value is GutchainFramePresetId {
  return (
    typeof value === "string" && (GUTCHAIN_FRAME_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function clampRectToViewport(rect: Rect, viewport: ViewportSize): Rect | null {
  const left = Math.max(0, rect.x);
  const top = Math.max(0, rect.y);
  const right = Math.min(viewport.width, rect.x + rect.width);
  const bottom = Math.min(viewport.height, rect.y + rect.height);
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

export function mapCssRectToImageCrop(
  rect: Rect,
  viewport: ViewportSize,
  imageSize: ImageSize,
): ImageCrop {
  const scaleX = imageSize.width / viewport.width;
  const scaleY = imageSize.height / viewport.height;
  const sx = Math.max(0, Math.floor(rect.x * scaleX));
  const sy = Math.max(0, Math.floor(rect.y * scaleY));
  const right = Math.min(imageSize.width, Math.ceil((rect.x + rect.width) * scaleX));
  const bottom = Math.min(imageSize.height, Math.ceil((rect.y + rect.height) * scaleY));
  const sw = Math.max(1, right - sx);
  const sh = Math.max(1, bottom - sy);

  return { sx, sy, sw, sh };
}

export function createGutchainPayload(
  snapshot: TweetCaptureSnapshot,
  screenshotDataUrl: string,
  screenshotSize: ImageSize,
  options: CreateGutchainPayloadOptions = {},
): GutchainSharePayload {
  const settings = normalizeGutchainSettings(options.settings);

  const payload: GutchainSharePayload = {
    id: createShareId(),
    tweetText: normalizeMultilineText(snapshot.text),
    authorName: normalizeText(snapshot.authorName),
    authorHandle: normalizeAuthorHandle(snapshot.authorHandle),
    screenshotDataUrl,
    cropRect: snapshot.visibleRect,
    screenshotSize,
    xhsTitle: buildXhsTitle(snapshot.text),
    xhsBody: buildXhsBody(snapshot.text, snapshot.authorName, snapshot.authorHandle, settings),
    createdAt: Date.now(),
  };

  if (options.captureSource) {
    payload.captureSource = options.captureSource;
  }

  return payload;
}

function createShareId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
