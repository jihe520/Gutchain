import type { GutchainSettings, GutchainSharePayload } from "./gutchain";

export { GUTCHAIN_SETTINGS_STORAGE_KEY, GUTCHAIN_SHARE_STORAGE_KEY } from "./messages";

export interface GutchainShareStorageShape {
  [key: string]: GutchainSharePayload | undefined;
}

export interface GutchainSettingsStorageShape {
  [key: string]: GutchainSettings | undefined;
}
