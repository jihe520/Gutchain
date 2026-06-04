import { describe, expect, it } from "vitest";

import {
  buildXhsBody,
  buildXhsTitle,
  clampRectToViewport,
  isSupportedXStatusUrl,
  mapCssRectToImageCrop,
} from "./relay";

describe("relay helpers", () => {
  it("detects supported X status URLs", () => {
    expect(isSupportedXStatusUrl("https://x.com/user/status/1234567890")).toBe(true);
    expect(isSupportedXStatusUrl("https://twitter.com/user/status/1234567890")).toBe(true);
    expect(isSupportedXStatusUrl("https://x.com/home")).toBe(false);
    expect(isSupportedXStatusUrl("https://example.com/user/status/1234567890")).toBe(false);
  });

  it("builds a 20-character XHS title from normalized tweet text", () => {
    expect(buildXhsTitle("  abcdefghijklmnopqrstuvwxyz  ")).toBe("abcdefghijklmnopqrst");
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
      clampRectToViewport(
        { x: -10, y: 20, width: 100, height: 200 },
        { width: 80, height: 120 },
      ),
    ).toEqual({ x: 0, y: 20, width: 80, height: 100 });

    expect(
      clampRectToViewport(
        { x: 90, y: 0, width: 20, height: 20 },
        { width: 80, height: 120 },
      ),
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
});
