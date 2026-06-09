import type { GutchainSettings, GutchainSharePayload } from "./gutchain";
import type { GutchainWechatSharePayload } from "./wechat";

export {
  GUTCHAIN_SETTINGS_STORAGE_KEY,
  GUTCHAIN_SHARE_STORAGE_KEY,
  GUTCHAIN_WECHAT_SHARE_STORAGE_KEY,
} from "./messages";

export interface GutchainShareStorageShape {
  [key: string]: GutchainSharePayload | undefined;
}

export interface GutchainSettingsStorageShape {
  [key: string]: GutchainSettings | undefined;
}

export interface GutchainWechatShareStorageShape {
  [key: string]: GutchainWechatSharePayload | undefined;
}
