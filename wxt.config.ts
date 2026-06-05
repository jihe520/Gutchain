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
    action: {
      default_title: "Gutchain"
    }
  },
  vite: () => ({
    plugins: [react()]
  })
});
