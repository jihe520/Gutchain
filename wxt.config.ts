import react from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: "Gutchain",
    description: "Share visible X posts to Xiaohongshu image-text drafts.",
    permissions: ["activeTab", "tabs", "scripting", "storage"],
    host_permissions: [
      "https://x.com/*",
      "https://twitter.com/*",
      "https://creator.xiaohongshu.com/*"
    ],
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      96: "icon/96.png",
      128: "icon/128.png"
    },
    action: {
      default_title: "Gutchain",
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png",
        48: "icon/48.png",
        96: "icon/96.png",
        128: "icon/128.png"
      }
    }
  },
  vite: () => ({
    plugins: [react()]
  })
});
