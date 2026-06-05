import { mapCssRectToImageCrop, type ImageSize, type Rect, type ViewportSize } from "./gutchain";

export interface CroppedScreenshot {
  dataUrl: string;
  size: ImageSize;
}

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

  context.drawImage(
    bitmap,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    crop.sw,
    crop.sh,
  );
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
