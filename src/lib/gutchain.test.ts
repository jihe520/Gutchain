import { describe, expect, it } from "vitest";

import {
  buildXhsBody,
  buildXhsTitle,
  clampRectToViewport,
  isSupportedXStatusUrl,
  mapCssRectToImageCrop,
} from "./gutchain";
import {
  buildWechatStickerFilename,
  buildWechatStickerPublishUrl,
  createGutchainWechatSharePayload,
} from "./wechat";

describe("gutchain helpers", () => {
  it("detects supported X status URLs", () => {
    expect(isSupportedXStatusUrl("https://x.com/user/status/1234567890")).toBe(true);
    expect(isSupportedXStatusUrl("https://twitter.com/user/status/1234567890")).toBe(true);
    expect(isSupportedXStatusUrl("https://x.com/home")).toBe(false);
    expect(isSupportedXStatusUrl("https://example.com/user/status/1234567890")).toBe(false);
  });

  it("builds a 20-character XHS title from the first non-empty tweet line", () => {
    expect(buildXhsTitle("  abcdefghijklmnopqrstuvwxyz  ")).toBe("abcdefghijklmnopqrst");
    expect(buildXhsTitle("  \nFirst   line title\nsecond line")).toBe("First line title");
    expect(buildXhsTitle("First line title that is too long\nsecond line")).toBe(
      "First line title tha",
    );
    expect(buildXhsTitle("")).toBe("来自 X 的分享");
  });

  it("builds the XHS body with tweet text and author only", () => {
    expect(buildXhsBody("Hello   world\nsecond line", "Alice", "alice")).toBe(
      "Hello world\nsecond line\n\n作者：Alice @alice",
    );
  });

  it("can omit the author line from the XHS body", () => {
    expect(
      buildXhsBody("Hello   world\nsecond line", "Alice", "alice", {
        includeAuthorInBody: false,
      }),
    ).toBe("Hello world\nsecond line");
  });

  it("clamps the tweet rect to the visible viewport", () => {
    expect(
      clampRectToViewport({ x: -10, y: 20, width: 100, height: 200 }, { width: 80, height: 120 }),
    ).toEqual({ x: 0, y: 20, width: 80, height: 100 });

    expect(
      clampRectToViewport({ x: 90, y: 0, width: 20, height: 20 }, { width: 80, height: 120 }),
    ).toBeNull();
  });

  it("maps CSS crop rects to screenshot bitmap coordinates", () => {
    expect(
      mapCssRectToImageCrop(
        { x: 10, y: 20, width: 100, height: 50 },
        { width: 400, height: 300 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ sx: 20, sy: 40, sw: 200, sh: 100 });
  });

  it("builds a safe WeChat sticker filename", () => {
    expect(
      buildWechatStickerFilename({
        id: "123",
        tweetText: "hello",
        authorName: "Alice",
        authorHandle: "@alice/dev",
        screenshotDataUrl: "data:image/png;base64,",
        cropRect: { x: 0, y: 0, width: 1, height: 1 },
        screenshotSize: { width: 1, height: 1 },
        xhsTitle: "hello",
        xhsBody: "hello",
        createdAt: 0,
      }),
    ).toBe("gutchain-wechat-alice-dev-123.png");
  });

  it("builds the WeChat sticker editor URL", () => {
    const url = new URL(buildWechatStickerPublishUrl("token-123", 1780931939633));

    expect(url.origin + url.pathname).toBe("https://mp.weixin.qq.com/cgi-bin/appmsg");
    expect(url.searchParams.get("t")).toBe("media/appmsg_edit_v2");
    expect(url.searchParams.get("action")).toBe("edit");
    expect(url.searchParams.get("isNew")).toBe("1");
    expect(url.searchParams.get("type")).toBe("77");
    expect(url.searchParams.get("createType")).toBe("8");
    expect(url.searchParams.get("token")).toBe("token-123");
    expect(url.searchParams.get("lang")).toBe("zh_CN");
    expect(url.searchParams.get("timestamp")).toBe("1780931939633");
  });

  it("creates a WeChat share payload from the captured screenshot", () => {
    const payload = {
      id: "123",
      tweetText: "hello",
      authorName: "Alice",
      authorHandle: "@alice",
      screenshotDataUrl: "data:image/png;base64,source",
      cropRect: { x: 0, y: 0, width: 1, height: 1 },
      screenshotSize: { width: 1, height: 1 },
      xhsTitle: "hello",
      xhsBody: "hello",
      createdAt: 0,
    };

    expect(createGutchainWechatSharePayload(payload)).toMatchObject({
      id: "123",
      wechatStickerDataUrl: "data:image/png;base64,source",
      wechatFilename: "gutchain-wechat-alice-123.png",
    });
  });
});
