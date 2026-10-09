import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { GEOGRAPHIC_AREAS } from "@/lib/data"; // 純資料(僅 import type),edge 安全

// 縣市集合(判斷 /stay/{slug} 的 slug 前綴是否為縣市,用來推導新網址)
const CITY_SET = new Set(GEOGRAPHIC_AREAS.flatMap((a) => a.regions));

/* ────────────────────────────────────────────────────────────────
 * 反爬蟲(第二層,伺服器端)— 搭配前端 EntryGate 真人門
 *   1) Bot UA 擋:程式抓取器 / 空 UA → 403;放行正牌搜尋引擎(SEO)
 *   2) IP 限速:每 IP 每 WINDOW 上限 MAX_HITS → 429
 *   3) 蜜罐:盲抓隱藏連結踩到 TRAP_PATH → 封該 IP,回假 200
 *
 * 狀態存在記憶體(Map),刻意不依賴 Vercel KV / Redis。
 * 注意:Serverless/Edge 多執行個體時,各實例記憶體獨立、冷啟會清空
 *   → 這是「盡力擋」而非強一致;要強一致需外部儲存(目前不做)。
 * ──────────────────────────────────────────────────────────────── */

const WINDOW_MS = 10_000;        // 限速視窗
const MAX_HITS = 120;            // 每 IP 每視窗上限(放寬:正常瀏覽+prefetch 不會中)
const BAN_MS = 30 * 60_000;      // 踩蜜罐 → 封鎖時長
const TRAP_PATH = "/api/_t";     // 蜜罐路徑(footer 隱藏連結指向這;真人不會點)

const hits = new Map<string, number[]>();   // ip -> 近期請求時間戳
const banned = new Map<string, number>();   // ip -> 解封 epoch ms

// 放行的正牌搜尋引擎/社群預覽/AI 爬蟲(要讓它們爬才有曝光、分享卡與 AI 引用 GEO)
const GOOD_BOTS =
  /(googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex(bot)?|applebot|facebookexternalhit|twitterbot|linebot|line-poker|whatsapp|telegrambot|pinterest|discordbot|gptbot|oai-searchbot|chatgpt-user|perplexitybot|claudebot|anthropic-ai|claude-web|ccbot|bytespider)/i;

// 明顯的程式/抓取器 UA(非瀏覽器)
const BAD_UA =
  /(python-requests|python-urllib|scrapy|httpclient|curl\/|wget\/|libwww|go-http-client|java\/|okhttp|aiohttp|node-fetch|axios\/|guzzle|mechanize|phantomjs|puppeteer|playwright|selenium|headlesschrome)/i;

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "0.0.0.0";
}

// 滑動視窗限速;順便回收過期 key 避免 Map 無限成長
function tooMany(ip: string, t: number): boolean {
  const arr = (hits.get(ip) || []).filter((x) => t - x < WINDOW_MS);
  arr.push(t);
  hits.set(ip, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.length || t - v[v.length - 1] > WINDOW_MS) hits.delete(k);
    }
  }
  return arr.length > MAX_HITS;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 舊網址 → 城市優先新結構(308 永久轉址,邊緣層處理,所有客戶端含搜尋引擎都吃得到)。
  //   /stays/{area}            → /{area}/hotels
  //   /stays/{area}/{theme}    → /{area}/hotels/{theme}
  // 註:不在頁面層用 redirect(),因前台 error.tsx 自癒邊界會把 NEXT_REDIRECT 當錯誤攔成 500。
  if (pathname.startsWith("/stays/")) {
    const segs = pathname.slice(7).replace(/\/+$/, "").split("/").filter(Boolean); // 保持 percent-encoded,交給目標頁解碼
    if (segs.length === 1) return NextResponse.redirect(new URL(`/${segs[0]}/hotels`, request.url), 308);
    if (segs.length >= 2) return NextResponse.redirect(new URL(`/${segs[0]}/hotels/${segs[1]}`, request.url), 308);
  }
  // /stay/{slug} → /{region}/hotel/{slug}(region 由 slug 前綴推得:slug = make_slug(region-名稱))。
  // 推不出縣市(舊 /stay/uuid 等)則放行,交給 /stay/[id] 頁(canonical 指向新網址)。
  if (pathname.startsWith("/stay/")) {
    const slugEnc = pathname.slice(6).replace(/\/+$/, "");
    if (slugEnc && !slugEnc.includes("/")) {
      let decoded = slugEnc;
      try { decoded = decodeURIComponent(slugEnc); } catch {}
      const region = decoded.split("-")[0];
      if (CITY_SET.has(region)) return NextResponse.redirect(new URL(`/${encodeURIComponent(region)}/hotel/${slugEnc}`, request.url), 308);
    }
  }

  const ip = clientIp(request);
  const ua = request.headers.get("user-agent") || "";
  const t = Date.now();
  const isGoodBot = GOOD_BOTS.test(ua);

  // 0) 已封鎖的 IP(搜尋引擎不受封鎖池影響)
  if (!isGoodBot) {
    const until = banned.get(ip);
    if (until && until > t) {
      return new NextResponse("Too Many Requests", { status: 429, headers: { "Retry-After": "600" } });
    }
    if (until) banned.delete(ip); // 已到期,解封
  }

  // 1) 蜜罐:踩到陷阱 → 封鎖(搜尋引擎只回 200 不封),回假 200 不讓它察覺
  if (pathname === TRAP_PATH) {
    if (!isGoodBot) banned.set(ip, t + BAN_MS);
    return new NextResponse("OK", { status: 200, headers: { "x-robots-tag": "noindex, nofollow" } });
  }

  // 2) Bot UA:空 UA 或程式抓取器 → 403(放行正牌搜尋引擎)
  if (!isGoodBot && (ua.trim() === "" || BAD_UA.test(ua))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 3) IP 限速(搜尋引擎不限速)
  if (!isGoodBot && tooMany(ip, t)) {
    return new NextResponse("Too Many Requests", { status: 429, headers: { "Retry-After": "10" } });
  }

  // 其餘交給原本的 Supabase session 更新
  return updateSession(request);
}

export const config = {
  matcher: [
    // robots / sitemap / llms 是給爬蟲與工具讀的公開 meta 檔,不經過反爬蟲
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
