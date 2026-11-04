export type Point = { x: number; y: number };
export type Crop = Point & { width: number; height: number };
export type Corner = 'nw' | 'ne' | 'sw' | 'se';
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// Coordinates are fractions of the source image, independent of preview size.
export function centeredCrop(imageAspect: number, aspect: number): Crop {
  const width = Math.min(1, aspect / imageAspect);
  const height = Math.min(1, imageAspect / aspect);
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

export function moveCrop(crop: Crop, dx: number, dy: number): Crop {
  return { ...crop, x: clamp(crop.x + dx, 0, 1 - crop.width), y: clamp(crop.y + dy, 0, 1 - crop.height) };
}

export function resizeCrop(crop: Crop, corner: Corner, dx: number, dy: number, normalizedAspect?: number): Crop {
  const left = corner.includes('w');
  const top = corner.includes('n');
  const anchorX = left ? crop.x + crop.width : crop.x;
  const anchorY = top ? crop.y + crop.height : crop.y;
  const maxWidth = left ? anchorX : 1 - anchorX;
  const maxHeight = top ? anchorY : 1 - anchorY;
  let width = clamp(crop.width + (left ? -dx : dx), Math.min(0.03, crop.width), maxWidth);
  let height = clamp(crop.height + (top ? -dy : dy), Math.min(0.03, crop.height), maxHeight);
  if (normalizedAspect) {
    // Use the dominant movement so vertical and horizontal drags both resize.
    const desiredWidth = Math.abs(dx) >= Math.abs(dy * normalizedAspect) ? width : height * normalizedAspect;
    width = clamp(desiredWidth, Math.min(0.03, 0.03 * normalizedAspect, crop.width), Math.min(maxWidth, maxHeight * normalizedAspect));
    height = width / normalizedAspect;
  }
  return { x: left ? anchorX - width : anchorX, y: top ? anchorY - height : anchorY, width, height };
}

export function zoomCrop(crop: Crop, factor: number, from: Point, to: Point): Crop {
  const scale = clamp(factor, Math.max(Math.min(0.03, crop.width) / crop.width, Math.min(0.03, crop.height) / crop.height), Math.min(1 / crop.width, 1 / crop.height));
  const width = crop.width * scale;
  const height = crop.height * scale;
  return {
    x: clamp(to.x - (from.x - crop.x) * scale, 0, 1 - width),
    y: clamp(to.y - (from.y - crop.y) * scale, 0, 1 - height), width, height,
  };
}

export async function encodeSmallestPhoto(canvas: HTMLCanvasElement): Promise<Blob> {
  let smallest: Blob | null = null;
  // Serial encoding bounds memory use on phones. Reject silent PNG fallbacks.
  for (const mime of ['image/webp', 'image/jpeg']) {
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime, 0.72));
      if (blob?.type === mime && blob.size > 0 && (!smallest || blob.size < smallest.size)) smallest = blob;
    } catch { /* Try the other encoder when a browser does not support this one. */ }
  }
  if (!smallest) throw new Error('浏览器无法生成压缩照片，请换一个浏览器重试。');
  return smallest;
}
