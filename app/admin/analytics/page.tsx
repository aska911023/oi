import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = { free: "免費", featured: "精選", flagship: "旗艦" };
interface Totals { views: number; click_web: number; click_map: number }
interface TopRow { name: string; ad_tier: string; views: number; click_web: number }
interface TierRow { ad_tier: string; stays: number; views: number; click_web: number }
interface Stats { totals?: Totals; top?: TopRow[]; tiers?: TierRow[]; error?: string }

const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "—");
const TierPill = ({ t }: { t: string }) =>
  t === "free" ? <span className="pill draft">免費</span> : <span className={"pill " + (t === "flagship" ? "live" : "feat")}>{TIER_LABEL[t] || t}</span>;

export default async function Analytics() {
  const sb = await createClient();
  const { data } = await sb.rpc("admin_stats", { p_days: 30 });
  const s = (data || {}) as Stats;
  const totals = s.totals || { views: 0, click_web: 0, click_map: 0 };
  const top = s.top || [];
  const tiers = (s.tiers || []).slice().sort((a, b) => ({ flagship: 0, featured: 1, free: 2 } as Record<string, number>)[a.ad_tier] - ({ flagship: 0, featured: 1, free: 2 } as Record<string, number>)[b.ad_tier]);

  return (
    <>
      <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 16px" }}>近 30 天 · 數據隨消費者瀏覽、導流累積</p>

      <div className="stats">
        <div className="stat-card"><div className="n">{totals.views.toLocaleString()}</div><div className="l">民宿頁瀏覽</div></div>
        <div className="stat-card"><div className="n">{totals.click_web.toLocaleString()}</div><div className="l">導流點擊(前往商家)</div></div>
        <div className="stat-card"><div className="n">{pct(totals.click_web, totals.views)}</div><div className="l">導流率</div></div>
        <div className="stat-card"><div className="n">{totals.click_map.toLocaleString()}</div><div className="l">地圖點擊</div></div>
      </div>

      <h2 className="serif shop-h" style={{ marginTop: 30 }}>曝光方案成效 <span className="count">付費 vs 免費</span></h2>
      <div className="atable-wrap">
        <table className="atable">
          <thead><tr><th>方案</th><th>上架數</th><th>瀏覽</th><th>導流點擊</th><th>平均瀏覽/間</th><th>導流率</th></tr></thead>
          <tbody>
            {tiers.length === 0 && <tr><td colSpan={6} className="empty-row">尚無資料</td></tr>}
            {tiers.map((t) => (
              <tr key={t.ad_tier}>
                <td><TierPill t={t.ad_tier} /></td>
                <td>{t.stays}</td>
                <td>{t.views.toLocaleString()}</td>
                <td>{t.click_web.toLocaleString()}</td>
                <td>{t.stays > 0 ? Math.round(t.views / t.stays).toLocaleString() : "—"}</td>
                <td>{pct(t.click_web, t.views)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="serif shop-h" style={{ marginTop: 30 }}>熱門民宿 <span className="count">Top 10</span></h2>
      <div className="atable-wrap">
        <table className="atable">
          <thead><tr><th>民宿</th><th>方案</th><th>瀏覽</th><th>導流點擊</th><th>導流率</th></tr></thead>
          <tbody>
            {top.length === 0 && <tr><td colSpan={5} className="empty-row">尚無資料</td></tr>}
            {top.map((r, i) => (
              <tr key={i}>
                <td><b>{r.name}</b></td>
                <td><TierPill t={r.ad_tier} /></td>
                <td>{r.views.toLocaleString()}</td>
                <td>{r.click_web.toLocaleString()}</td>
                <td>{pct(r.click_web, r.views)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
