// 圖片工具:上傳前壓縮 + 顯示時取縮圖(走 Supabase Storage 的即時轉換,不用另外存一份)

const MAX_EDGE = 1600;      // 上傳後長邊上限
const QUALITY = 0.82;       // WebP 品質
const SKIP = /^image\/(gif|svg\+xml)$/;   // 動圖與向量圖不壓(會壞)

/**
 * 瀏覽器端壓縮:縮到長邊 MAX_EDGE 以內並轉 WebP。
 * 壓不動或壓完反而更大就回傳原檔,不會越弄越糟。
 */
export async function compressImage(file: File): Promise<File> {
  if (SKIP.test(file.type) || !file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();

    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;   // 任何環節失敗就照原檔上傳
  }
}

/**
 * 顯示用網址。直接回傳原圖 —— 上傳時已壓到 1600px WebP(compressImage),
 * 不再走 Supabase Storage 的 render/image 即時轉換(Pro 每月僅含 100 張,會超額被限制)。
 * egress 有大量餘裕,原圖已是壓縮過的 WebP,直接送即可。
 */
export function imgUrl(src: string | null | undefined, _width?: number): string {
  return src || "";
}

export const imgList = (list: string[] | null | undefined, width?: number) =>
  (list || []).map((s) => imgUrl(s, width));
