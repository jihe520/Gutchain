export const GUTCHAIN_SHARE_STORAGE_KEY = "gutchain.latestShare";
export const GUTCHAIN_SETTINGS_STORAGE_KEY = "gutchain.settings";

export const GUTCHAIN_XHS_PUBLISH_URL =
  "https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch";

export const GUTCHAIN_MESSAGE = {
  POPUP_GET_STATE: "gutchain.popup.getState",
  POPUP_SHARE_TO_XHS: "gutchain.popup.shareToXhs",
  X_COLLECT_TWEET: "gutchain.x.collectTweet",
} as const;

export interface PopupStateResponse {
  isSupported: boolean;
  reason?: string;
  tabUrl?: string;
}

export interface PopupShareResponse {
  ok: boolean;
  error?: string;
  payloadId?: string;
  xhsTabId?: number;
}
