import type { RelaySettings, RelaySharePayload } from "./relay";

export { RELAY_SETTINGS_STORAGE_KEY, RELAY_SHARE_STORAGE_KEY } from "./messages";

export interface RelayShareStorageShape {
  [key: string]: RelaySharePayload | undefined;
}

export interface RelaySettingsStorageShape {
  [key: string]: RelaySettings | undefined;
}
