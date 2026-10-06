import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAnalyticsXlsx, type TierRow, type TopRow, type Totals } from "@/lib/analytics-xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGES: Record<number, string> = { 7: "近 7 天", 30: "近 30 天", 90: "近 90 天", 365: "近一年" };
const ORDER: Record<string, number> = { flagship: 0, featured: 1, free: 2 };

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = RANGES[daysParam] ? daysParam : 30;
  const rangeLabel = RANGES[days] || `近 ${days} 天`;

  const { data } = await sb.rpc("admin_stats", { p_days: days });
  const s = (data || {}) as { totals?: Totals; tiers?: TierRow[]; top?: TopRow[] };
  const totals = s.totals || { views: 0, click_web: 0, click_map: 0, shares: 0, saves: 0 };
  const tiers = (s.tiers || []).slice().sort((a, b) => (ORDER[a.ad_tier] ?? 9) - (ORDER[b.ad_tier] ?? 9));
  const top = s.top || [];

  const buf = await buildAnalyticsXlsx(rangeLabel, totals, tiers, top);
  const fname = encodeURIComponent(`偶宿數據_${rangeLabel.replace(/\s/g, "")}.xlsx`);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fname}`,
      "Cache-Control": "no-store",
    },
  });
}
