"use client";

const TIER_LABEL: Record<string, string> = { free: "免費", featured: "精選", flagship: "旗艦" };
const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "—");

interface Totals { views: number; click_web: number; click_map: number; shares: number; saves: number }
interface TopRow { name: string; ad_tier: string; views: number; click_web: number; shares: number; saves: number }
interface TierRow { ad_tier: string; stays: number; views: number; click_web: number; shares: number; saves: number }

const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

// 匯出數據報表:把目前區間的總覽/方案成效/熱門民宿組成 CSV 下載(含 BOM,Excel 開中文不亂碼)。
export default function ExportReport({ rangeLabel, totals, tiers, top }: {
  rangeLabel: string; totals: Totals; tiers: TierRow[]; top: TopRow[];
}) {
  function run() {
    const L: string[] = [];
    L.push(q("偶宿 O! 營運數據報表") + "," + q(rangeLabel));
    L.push("");
    L.push(q("總覽"));
    L.push([q("指標"), q("數值")].join(","));
    L.push([q("民宿頁瀏覽"), totals.views].join(","));
    L.push([q("導流點擊(前往商家)"), totals.click_web].join(","));
    L.push([q("導流率"), q(pct(totals.click_web, totals.views))].join(","));
    L.push([q("地圖點擊"), totals.click_map].join(","));
    L.push([q("分享次數"), totals.shares].join(","));
    L.push([q("被收藏"), totals.saves].join(","));
    L.push("");
    L.push(q("曝光方案成效"));
    L.push([q("方案"), q("上架數"), q("瀏覽"), q("導流點擊"), q("分享"), q("收藏"), q("平均瀏覽/間"), q("導流率")].join(","));
    tiers.forEach((t) => L.push([
      q(TIER_LABEL[t.ad_tier] || t.ad_tier), t.stays, t.views, t.click_web, t.shares, t.saves,
      t.stays > 0 ? Math.round(t.views / t.stays) : 0, q(pct(t.click_web, t.views)),
    ].join(",")));
    L.push("");
    L.push(q("熱門民宿"));
    L.push([q("民宿"), q("方案"), q("瀏覽"), q("導流點擊"), q("分享"), q("收藏"), q("導流率")].join(","));
    top.forEach((r) => L.push([
      q(r.name), q(TIER_LABEL[r.ad_tier] || r.ad_tier), r.views, r.click_web, r.shares, r.saves, q(pct(r.click_web, r.views)),
    ].join(",")));

    const csv = "﻿" + L.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `偶宿數據_${rangeLabel.replace(/\s/g, "")}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return <button type="button" className="btn btn-ghost" onClick={run}>⬇ 匯出報表（CSV）</button>;
}
