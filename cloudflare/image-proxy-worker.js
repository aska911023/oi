// 偶宿圖片代理 Worker(Cloudflare)
// 作用:把 https://<你的worker>.workers.dev/<路徑> 反代到 Supabase 公開 storage,
//       靠 Cloudflare 免費邊緣快取擋掉 Supabase 的圖片 egress(省頻寬、不怕爆)。
//
// ── 部署步驟 ──────────────────────────────────────────────
// 1. 到 https://dash.cloudflare.com 註冊/登入(免費帳號即可,不用綁網域)。
// 2. 左側 Workers & Pages → Create → Create Worker → 取名例如 oistay-img → Deploy。
// 3. 進該 Worker → Edit code → 把本檔內容整個貼上去 → Deploy。
// 4. 複製它的網址(形如 https://oistay-img.<你的帳號>.workers.dev)。
// 5. 到 Vercel 專案 → Settings → Environment Variables 新增:
//      NEXT_PUBLIC_IMG_CDN = https://oistay-img.<你的帳號>.workers.dev
//    (Production/Preview 都勾)→ 重新部署(Redeploy)。
// 6. 完成:前台圖片會改走這個 Worker,Supabase 只在快取失效時被打到。
//    要回退?把 Vercel 的 NEXT_PUBLIC_IMG_CDN 清掉再 Redeploy 即可,立刻回原圖。
// ──────────────────────────────────────────────────────────

const SUPABASE_PUBLIC = "https://ofknzuhkbbtegxqvzwnl.supabase.co/storage/v1/object/public";
const CACHE_TTL = 2592000; // 邊緣快取 30 天(圖片不常變;換圖是新檔名,不會撞快取)

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "") {
      return new Response("oistay image proxy", { status: 200 });
    }
    // /site/xxx.webp → Supabase 公開 storage 的同路徑
    const target = SUPABASE_PUBLIC + url.pathname + url.search;

    const res = await fetch(target, {
      cf: { cacheEverything: true, cacheTtl: CACHE_TTL },
    });

    const out = new Response(res.body, res);
    out.headers.set("Cache-Control", `public, max-age=${CACHE_TTL}, immutable`);
    out.headers.set("Access-Control-Allow-Origin", "*");
    out.headers.delete("set-cookie");
    return out;
  },
};
