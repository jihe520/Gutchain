export const RELAY_SHARE_STORAGE_KEY = "relay.latestShare";
export const RELAY_SETTINGS_STORAGE_KEY = "relay.settings";

export const RELAY_XHS_PUBLISH_URL =
  "https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch";

export const RELAY_MESSAGE = {
  POPUP_GET_STATE: "relay.popup.getState",
  POPUP_SHARE_TO_XHS: "relay.popup.shareToXhs",
  X_COLLECT_TWEET: "relay.x.collectTweet",
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
