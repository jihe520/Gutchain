import {
  type GutchainFramePresetId,
  type ImageSize,
  mapCssRectToImageCrop,
  type Rect,
  type ViewportSize,
} from "./gutchain";

export interface CroppedScreenshot {
  dataUrl: string;
  size: ImageSize;
}

interface FrameRenderPreset {
  background: readonly [string, string];
  borderColor: string;
  borderWidth: number;
  footerColor: string;
  footerMutedColor: string;
  frameFill: string;
  frameRadius: number;
  imageRadius: number;
  maxPadding: number;
  minPadding: number;
  paddingRatio: number;
  shadow?: {
    blur: number;
    color: string;
    offsetX: number;
    offsetY: number;
  };
  accentRail?: {
    color: string;
    widthRatio: number;
  };
}

const GUTCHAIN_FRAME_BRAND = "Gutchain";
const GUTCHAIN_OFFICIAL_LINK = "gutchain.fun";

const FRAME_RENDER_PRESETS: Record<GutchainFramePresetId, FrameRenderPreset> = {
  clean: {
    background: ["#fbfaf6", "#efefea"],
    borderColor: "transparent",
    borderWidth: 0,
    footerColor: "#24211a",
    footerMutedColor: "#756d5f",
    frameFill: "#ffffff",
    frameRadius: 22,
    imageRadius: 10,
    maxPadding: 64,
    minPadding: 22,
    paddingRatio: 0.055,
    shadow: {
      blur: 36,
      color: "rgba(30, 28, 23, 0.18)",
      offsetX: 0,
      offsetY: 18,
    },
  },
  xhs: {
    background: ["#fff6f2", "#f5e7dc"],
    borderColor: "rgba(228, 45, 72, 0.28)",
    borderWidth: 2,
    footerColor: "#e42d48",
    footerMutedColor: "#7c5e58",
    frameFill: "#fffdf8",
    frameRadius: 24,
    imageRadius: 10,
    maxPadding: 70,
    minPadding: 24,
    paddingRatio: 0.06,
    shadow: {
      blur: 30,
      color: "rgba(64, 20, 24, 0.14)",
      offsetX: 10,
      offsetY: 18,
    },
    accentRail: {
      color: "#e42d48",
      widthRatio: 0.12,
    },
  },
  wechat: {
    background: ["#edf8ef", "#dfeee8"],
    borderColor: "rgba(20, 122, 69, 0.22)",
    borderWidth: 2,
    footerColor: "#147a45",
    footerMutedColor: "#557165",
    frameFill: "#f9fffb",
    frameRadius: 24,
    imageRadius: 10,
    maxPadding: 72,
    minPadding: 26,
    paddingRatio: 0.065,
    shadow: {
      blur: 34,
      color: "rgba(10, 72, 42, 0.16)",
      offsetX: 0,
      offsetY: 16,
    },
  },
  ink: {
    background: ["#f3f0e7", "#dfdbcf"],
    borderColor: "#1f1f1d",
    borderWidth: 4,
    footerColor: "#1f1f1d",
    footerMutedColor: "#6b6257",
    frameFill: "#fffdf2",
    frameRadius: 14,
    imageRadius: 6,
    maxPadding: 62,
    minPadding: 22,
    paddingRatio: 0.055,
    shadow: {
      blur: 0,
      color: "#1f1f1d",
      offsetX: 12,
      offsetY: 12,
    },
  },
};

export async function cropScreenshotDataUrl(
  screenshotDataUrl: string,
  cropRect: Rect,
  viewport: ViewportSize,
): Promise<CroppedScreenshot> {
  const sourceBlob = await fetch(screenshotDataUrl).then((response) => response.blob());
  const bitmap = await createImageBitmap(sourceBlob);
  const crop = mapCssRectToImageCrop(cropRect, viewport, {
    width: bitmap.width,
    height: bitmap.height,
  });

  const canvas = new OffscreenCanvas(crop.sw, crop.sh);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Unable to create screenshot crop canvas.");
  }

  context.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);
  bitmap.close();

  const croppedBlob = await canvas.convertToBlob({ type: "image/png" });

  return {
    dataUrl: await blobToDataUrl(croppedBlob),
    size: {
      width: crop.sw,
      height: crop.sh,
    },
  };
}

export async function frameScreenshotDataUrl(
  screenshotDataUrl: string,
  presetId: GutchainFramePresetId,
): Promise<CroppedScreenshot> {
  const sourceBlob = await fetch(screenshotDataUrl).then((response) => response.blob());
  const bitmap = await createImageBitmap(sourceBlob);
  const preset = FRAME_RENDER_PRESETS[presetId];
  const baseSize = Math.min(bitmap.width, bitmap.height);
  const padding = clampNumber(
    Math.round(baseSize * preset.paddingRatio),
    preset.minPadding,
    preset.maxPadding,
  );
  const accentWidth = preset.accentRail
    ? Math.max(4, Math.round(padding * preset.accentRail.widthRatio))
    : 0;
  const footerFontSize = clampNumber(Math.round(baseSize * 0.032), 15, 24);
  const footerGap = clampNumber(Math.round(padding * 0.5), 12, 24);
  const footerHeight = Math.round(footerFontSize * 1.5);
  const leftPadding = padding + accentWidth;
  const frameWidth = bitmap.width + leftPadding + padding;
  const frameHeight = bitmap.height + padding + footerGap + footerHeight + padding;
  const shadowPad = preset.shadow
    ? Math.ceil(
        preset.shadow.blur + Math.max(Math.abs(preset.shadow.offsetX), preset.shadow.offsetY),
      )
    : 0;
  const margin = clampNumber(Math.round(padding * 0.8), 18, 48) + shadowPad;
  const canvas = new OffscreenCanvas(frameWidth + margin * 2, frameHeight + margin * 2);
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("Unable to create screenshot frame canvas.");
  }

  const frameX = margin;
  const frameY = margin;
  const imageX = frameX + leftPadding;
  const imageY = frameY + padding;

  fillCanvasBackground(context, canvas, preset.background);
  fillFrame(context, frameX, frameY, frameWidth, frameHeight, preset);
  drawAccentRail(context, frameX, frameY, frameHeight, padding, accentWidth, preset);
  drawRoundedImage(context, bitmap, imageX, imageY, preset.imageRadius);
  drawFrameFooter(context, {
    footerFontSize,
    footerGap,
    imageBottom: imageY + bitmap.height,
    imageLeft: imageX,
    imageWidth: bitmap.width,
    padding,
    preset,
  });
  strokeFrame(context, frameX, frameY, frameWidth, frameHeight, preset);
  bitmap.close();

  const framedBlob = await canvas.convertToBlob({ type: "image/png" });

  return {
    dataUrl: await blobToDataUrl(framedBlob),
    size: {
      width: canvas.width,
      height: canvas.height,
    },
  };
}

export async function readImageSize(dataUrl: string): Promise<ImageSize> {
  const sourceBlob = await fetch(dataUrl).then((response) => response.blob());
  const bitmap = await createImageBitmap(sourceBlob);
  const size = {
    width: bitmap.width,
    height: bitmap.height,
  };
  bitmap.close();
  return size;
}

function fillCanvasBackground(
  context: OffscreenCanvasRenderingContext2D,
  canvas: OffscreenCanvas,
  colors: readonly [string, string],
) {
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function fillFrame(
  context: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  preset: FrameRenderPreset,
) {
  context.save();
  if (preset.shadow) {
    context.shadowBlur = preset.shadow.blur;
    context.shadowColor = preset.shadow.color;
    context.shadowOffsetX = preset.shadow.offsetX;
    context.shadowOffsetY = preset.shadow.offsetY;
  }
  context.fillStyle = preset.frameFill;
  drawRoundedRect(context, x, y, width, height, preset.frameRadius);
  context.fill();
  context.restore();
}

function drawAccentRail(
  context: OffscreenCanvasRenderingContext2D,
  frameX: number,
  frameY: number,
  frameHeight: number,
  padding: number,
  accentWidth: number,
  preset: FrameRenderPreset,
) {
  if (!preset.accentRail || accentWidth <= 0) return;

  context.fillStyle = preset.accentRail.color;
  drawRoundedRect(
    context,
    frameX + Math.round(padding * 0.48),
    frameY + padding,
    accentWidth,
    frameHeight - padding * 2,
    accentWidth / 2,
  );
  context.fill();
}

function drawRoundedImage(
  context: OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap,
  x: number,
  y: number,
  radius: number,
) {
  context.save();
  drawRoundedRect(context, x, y, bitmap.width, bitmap.height, radius);
  context.clip();
  context.drawImage(bitmap, x, y);
  context.restore();
}

function drawFrameFooter(
  context: OffscreenCanvasRenderingContext2D,
  options: {
    footerFontSize: number;
    footerGap: number;
    imageBottom: number;
    imageLeft: number;
    imageWidth: number;
    padding: number;
    preset: FrameRenderPreset;
  },
) {
  const baseline = options.imageBottom + options.footerGap + options.footerFontSize;
  const left = options.imageLeft;
  const right = options.imageLeft + options.imageWidth;

  context.save();
  context.textBaseline = "alphabetic";
  context.font = `700 ${options.footerFontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  context.fillStyle = options.preset.footerMutedColor;
  context.fillText(GUTCHAIN_FRAME_BRAND, left, baseline);

  context.font = `800 ${options.footerFontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  context.fillStyle = options.preset.footerColor;
  context.textAlign = "right";
  context.fillText(GUTCHAIN_OFFICIAL_LINK, right, baseline);
  context.restore();

  if (!options.preset.accentRail) return;

  const markSize = Math.max(3, Math.round(options.padding * 0.14));
  context.fillStyle = options.preset.footerColor;
  drawRoundedRect(
    context,
    left - Math.round(options.padding * 0.4),
    baseline - options.footerFontSize + Math.round(markSize * 0.25),
    markSize,
    markSize,
    markSize / 2,
  );
  context.fill();
}

function strokeFrame(
  context: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  preset: FrameRenderPreset,
) {
  if (preset.borderWidth <= 0) return;

  context.strokeStyle = preset.borderColor;
  context.lineWidth = preset.borderWidth;
  drawRoundedRect(context, x, y, width, height, preset.frameRadius);
  context.stroke();
}

function drawRoundedRect(
  context: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const clampedRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + clampedRadius, y);
  context.lineTo(x + width - clampedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + clampedRadius);
  context.lineTo(x + width, y + height - clampedRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - clampedRadius, y + height);
  context.lineTo(x + clampedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - clampedRadius);
  context.lineTo(x, y + clampedRadius);
  context.quadraticCurveTo(x, y, x + clampedRadius, y);
  context.closePath();
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}
