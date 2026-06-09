import type { GutchainSharePayload } from "./gutchain";

export const GUTCHAIN_WECHAT_STICKER_PUBLISH_BASE_URL = "https://mp.weixin.qq.com/cgi-bin/appmsg";

export interface GutchainWechatSharePayload extends GutchainSharePayload {
  wechatStickerDataUrl: string;
  wechatFilename: string;
}

export function createGutchainWechatSharePayload(
  payload: GutchainSharePayload,
): GutchainWechatSharePayload {
  return {
    ...payload,
    wechatStickerDataUrl: payload.screenshotDataUrl,
    wechatFilename: buildWechatStickerFilename(payload),
  };
}

export function buildWechatStickerFilename(payload: GutchainSharePayload): string {
  const author = sanitizeFilenamePart(payload.authorHandle || payload.authorName || "x-post");
  return `gutchain-wechat-${author}-${payload.id}.png`;
}

export function buildWechatStickerPublishUrl(token: string, timestamp = Date.now()): string {
  const url = new URL(GUTCHAIN_WECHAT_STICKER_PUBLISH_BASE_URL);
  url.searchParams.set("t", "media/appmsg_edit_v2");
  url.searchParams.set("action", "edit");
  url.searchParams.set("isNew", "1");
  url.searchParams.set("type", "77");
  url.searchParams.set("createType", "8");
  url.searchParams.set("token", token);
  url.searchParams.set("lang", "zh_CN");
  url.searchParams.set("timestamp", String(timestamp));
  return url.toString();
}

function sanitizeFilenamePart(value: string): string {
  const normalized = value
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || "x-post";
}
