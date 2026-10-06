import { createClient } from "@/lib/supabase/server";
import ExportReport from "@/components/admin/export-report";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = { free: "免費", featured: "精選", flagship: "旗艦" };
interface Totals { views: number; click_web: number; click_map: number; shares: number; saves: number }
interface TopRow { name: string; ad_tier: string; views: number; click_web: number; shares: number; saves: number }
interface TierRow { ad_tier: string; stays: number; views: number; click_web: number; shares: number; saves: number }
interface Stats { totals?: Totals; top?: TopRow[]; tiers?: TierRow[]; error?: string }

const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "—");
const TierPill = ({ t }: { t: string }) =>
  t === "free" ? <span className="pill draft">免費</span> : <span className={"pill " + (t === "flagship" ? "live" : "feat")}>{TIER_LABEL[t] || t}</span>;

const RANGES = [{ d: 7, l: "近 7 天" }, { d: 30, l: "近 30 天" }, { d: 90, l: "近 90 天" }, { d: 365, l: "近一年" }];
const ORDER: Record<string, number> = { flagship: 0, featured: 1, free: 2 };

export default async function Analytics({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.some((r) => r.d === Number(sp.days)) ? Number(sp.days) : 30;
  const rangeLabel = RANGES.find((r) => r.d === days)?.l || `近 ${days} 天`;

  const sb = await createClient();
  const { data } = await sb.rpc("admin_stats", { p_days: days });
  const s = (data || {}) as Stats;
  const totals = s.totals || { views: 0, click_web: 0, click_map: 0, shares: 0, saves: 0 };
  const top = s.top || [];
  const tiers = (s.tiers || []).slice().sort((a, b) => (ORDER[a.ad_tier] ?? 9) - (ORDER[b.ad_tier] ?? 9));

  return (
    <>
      {/* ── 查詢導覽:時間範圍 ── */}
      <div className="admin-subtabs" style={{ marginTop: 0 }}>
        {RANGES.map((r) => <a key={r.d} href={`?days=${r.d}`} className={days === r.d ? "on" : ""}>{r.l}</a>)}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, margin: "0 0 16px" }}>
        <p style={{ fontSize: 13.5, color: "var(--muted)", margin: 0 }}>{rangeLabel} · 數據隨消費者瀏覽、導流、分享、收藏累積</p>
        <ExportReport rangeLabel={rangeLabel} totals={totals} tiers={tiers} top={top} />
      </div>

      <div className="stats">
        <div className="stat-card"><div className="n">{totals.views.toLocaleString()}</div><div className="l">民宿頁瀏覽</div></div>
        <div className="stat-card"><div className="n">{totals.click_web.toLocaleString()}</div><div className="l">導流點擊(前往商家)</div></div>
        <div className="stat-card"><div className="n">{pct(totals.click_web, totals.views)}</div><div className="l">導流率</div></div>
        <div className="stat-card"><div className="n">{totals.click_map.toLocaleString()}</div><div className="l">地圖點擊</div></div>
        <div className="stat-card"><div className="n">{totals.shares.toLocaleString()}</div><div className="l">分享次數</div></div>
        <div className="stat-card"><div className="n">{totals.saves.toLocaleString()}</div><div className="l">被收藏</div></div>
      </div>

      <h2 className="serif shop-h" style={{ marginTop: 30 }}>曝光方案成效 <span className="count">付費 vs 免費</span></h2>
      <div className="atable-wrap">
        <table className="atable">
          <thead><tr><th>方案</th><th>上架數</th><th>瀏覽</th><th>導流點擊</th><th>分享</th><th>收藏</th><th>平均瀏覽/間</th><th>導流率</th></tr></thead>
          <tbody>
            {tiers.length === 0 && <tr><td colSpan={8} className="empty-row">尚無資料</td></tr>}
            {tiers.map((t) => (
              <tr key={t.ad_tier}>
                <td><TierPill t={t.ad_tier} /></td>
                <td>{t.stays}</td>
                <td>{t.views.toLocaleString()}</td>
                <td>{t.click_web.toLocaleString()}</td>
                <td>{t.shares.toLocaleString()}</td>
                <td>{t.saves.toLocaleString()}</td>
                <td>{t.stays > 0 ? Math.round(t.views / t.stays).toLocaleString() : "—"}</td>
                <td>{pct(t.click_web, t.views)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="serif shop-h" style={{ marginTop: 30 }}>熱門民宿 <span className="count">Top {top.length || 30}</span></h2>
      <div className="atable-wrap">
        <table className="atable">
          <thead><tr><th>#</th><th>民宿</th><th>方案</th><th>瀏覽</th><th>導流點擊</th><th>分享</th><th>收藏</th><th>導流率</th></tr></thead>
          <tbody>
            {top.length === 0 && <tr><td colSpan={8} className="empty-row">尚無資料</td></tr>}
            {top.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><b>{r.name}</b></td>
                <td><TierPill t={r.ad_tier} /></td>
                <td>{r.views.toLocaleString()}</td>
                <td>{r.click_web.toLocaleString()}</td>
                <td>{r.shares.toLocaleString()}</td>
                <td>{r.saves.toLocaleString()}</td>
                <td>{pct(r.click_web, r.views)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
