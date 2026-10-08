// 讓詳情頁網址帶名字(SEO + 分享好看),但查詢一律用網址裡的 UUID。
// 例:/stay/宜蘭-空島skypiea-c91994f3-... ;/trips/宜蘭三天兩夜-ab12...
// 舊的純 UUID 網址(/stay/c91994f3-...)也照常能開(extractId 會抓出 UUID)。

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function slugify(s: string): string {
  return (s || "")
    .trim()
    .replace(/[\s_]+/g, "-")          // 空白 / 底線 → 連字號
    .replace(/[/\\?#%&]+/g, "")       // 去掉會破壞網址的字元
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function staySlug(id: string, region?: string | null, name?: string | null): string {
  const head = slugify([region, name].filter(Boolean).join("-"));
  return head ? `${head}-${id}` : id;
}

export function tripSlug(id: string, title?: string | null): string {
  const head = slugify(title || "");
  return head ? `${head}-${id}` : id;
}

// 從網址參數(可能是 slug-uuid 或純 uuid)取出真正的 UUID 當查詢鍵
export function extractId(param: string): string {
  const m = (param || "").match(UUID_RE);
  return m ? m[0] : param;
}
