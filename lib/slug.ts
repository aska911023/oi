// 詳情頁網址用「乾淨 slug」(存在 stays.slug / trips.slug,例:宜蘭-淞湘卉館VILLA)。
// 連結一律用資料裡的 slug;查詢時先用 slug,找不到再用這裡抽出的 UUID(相容舊網址)。

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// 從網址參數抽出 UUID(舊的 /stay/uuid 或 /stay/名字-uuid 都抓得到);純 slug 則回原字串
export function extractId(param: string): string {
  const m = (param || "").match(UUID_RE);
  return m ? m[0] : param;
}
