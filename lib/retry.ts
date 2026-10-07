// Supabase 讀取重試工具。
// 核心原則:連線抖動(error)才重試;「成功但沒資料」是合法結果照常回傳。
// 重點是——失敗時 throw,絕不回空值,否則空結果會被 unstable_cache 當成功值快取住,
// 害整頁空白並卡到下次 revalidate(= 之前「常常資料都沒了」的真因)。

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 清單/RPC 用:成功回 { data, count };三次都 error 就 throw。
// data 為 null 視為失敗(RPC/清單正常至少回物件或陣列);空陣列/{total:0} 是合法成功。
export async function sbRetry<T>(
  call: () => PromiseLike<{ data: T | null; error: unknown; count?: number | null }>,
  label = "Supabase",
  tries = 3,
): Promise<{ data: T; count: number | null }> {
  let lastErr: unknown = null;
  for (let i = 0; i < tries; i++) {
    const res = await call();
    if (!res.error && res.data != null) return { data: res.data, count: res.count ?? null };
    lastErr = res.error ?? "no data";
    if (i < tries - 1) await delay(200 * (i + 1));
  }
  throw new Error(`${label} 連續失敗:${lastErr instanceof Error ? lastErr.message : JSON.stringify(lastErr)}`);
}

// 單筆(maybeSingle)用:查無資料(error 為空、data 為 null)算成功回 null;
// 只有真的 error 才重試,三次都 error 才 throw —— 避免連線抖動時把正常頁面變成 404。
export async function sbMaybeRetry<T>(
  call: () => PromiseLike<{ data: T | null; error: { message?: string } | null }>,
  label = "Supabase",
  tries = 3,
): Promise<T | null> {
  let res: { data: T | null; error: { message?: string } | null } | undefined;
  for (let i = 0; i < tries; i++) {
    res = await call();
    if (!res.error) return res.data;
    if (i < tries - 1) await delay(200 * (i + 1));
  }
  throw new Error(`${label} 連續失敗:${res?.error?.message || "unknown"}`);
}
