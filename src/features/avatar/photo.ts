/**
 * 写真アバターの作成。端末の中だけで処理し、どこにも送らない。
 * 真ん中を正方形に切り抜き、小さく縮小して JPEG の data URL にする。
 */

/** 保存する写真の一辺(px)。地図では 56px 程度で表示するので高精細端末でも十分 */
export const PHOTO_SIZE = 192;
export const PHOTO_QUALITY = 0.85;

export type SquareCrop = { sx: number; sy: number; size: number };

/** 横 width・縦 height の画像から、真ん中の正方形を切り抜く範囲 */
export function centerSquareCrop(width: number, height: number): SquareCrop {
  if (!(width > 0) || !(height > 0)) throw new Error("画像の大きさが正しくありません");
  const size = Math.min(width, height);
  return { sx: (width - size) / 2, sy: (height - size) / 2, size };
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decodeImage(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // 下の <img> 方式でもう一度ためす
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("画像を読みこめませんでした"));
      img.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** 写真ファイルを、正方形・縮小済みの JPEG data URL にする。読めないときは例外。 */
export async function photoFileToDataUrl(file: Blob): Promise<string> {
  const decoded = await decodeImage(file);
  try {
    const { sx, sy, size } = centerSquareCrop(decoded.width, decoded.height);
    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas が使えません");
    // 透過 PNG でも黒くならないよう白で下地を塗る
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, sx, sy, size, size, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    const dataUrl = canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
    if (!dataUrl.startsWith("data:image/")) throw new Error("画像を作れませんでした");
    return dataUrl;
  } finally {
    decoded.release();
  }
}
