export const GUTCHAIN_SHARE_STORAGE_KEY = "gutchain.latestShare";
export const GUTCHAIN_WECHAT_SHARE_STORAGE_KEY = "gutchain.latestWechatShare";
export const GUTCHAIN_SETTINGS_STORAGE_KEY = "gutchain.settings";

export const GUTCHAIN_XHS_PUBLISH_URL =
  "https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch";
export const GUTCHAIN_WECHAT_PUBLISH_URL = "https://mp.weixin.qq.com/";

export const GUTCHAIN_MESSAGE = {
  POPUP_GET_STATE: "gutchain.popup.getState",
  POPUP_SHARE_TO_XHS: "gutchain.popup.shareToXhs",
  POPUP_SHARE_TO_WECHAT: "gutchain.popup.shareToWechat",
  X_COLLECT_TWEET: "gutchain.x.collectTweet",
  X_RENDER_TWEET_IMAGE: "gutchain.x.renderTweetImage",
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
  wechatTabId?: number;
}
