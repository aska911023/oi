import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StaysAdmin from "@/components/admin/stays-admin";
import type { Stay } from "@/lib/types";
import type { Plan } from "@/components/admin/plans-editor";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = { free: "免費", featured: "精選", flagship: "旗艦" };
interface VStat { stay_id: string; name: string; ad_tier: string; views: number; click_web: number; click_map: number; saves: number }

export default async function VendorStaysPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor");
  const { data } = await sb.from("stays").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
  const { data: statsData } = await sb.rpc("vendor_stats", { p_days: 30 });
  const { data: plans } = await sb.from("plans").select("*").order("sort");
  const stats = (statsData as VStat[]) || [];
  const sum = stats.reduce((a, r) => ({ views: a.views + r.views, click_web: a.click_web + r.click_web, saves: a.saves + r.saves }), { views: 0, click_web: 0, saves: 0 });

  return (
    <>
      {stats.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <div className="stats">
            <div className="stat-card"><div className="n">{sum.views.toLocaleString()}</div><div className="l">近 30 天瀏覽</div></div>
            <div className="stat-card"><div className="n">{sum.click_web.toLocaleString()}</div><div className="l">導流點擊(前往你的網頁)</div></div>
            <div className="stat-card"><div className="n">{sum.views > 0 ? ((sum.click_web / sum.views) * 100).toFixed(1) + "%" : "—"}</div><div className="l">導流率</div></div>
            <div className="stat-card"><div className="n">{sum.saves.toLocaleString()}</div><div className="l">被收藏</div></div>
          </div>
          <h2 className="serif shop-h" style={{ marginTop: 20 }}>各民宿成效 <span className="count">近 30 天</span></h2>
          <div className="atable-wrap">
            <table className="atable">
              <thead><tr><th>民宿</th><th>方案</th><th>瀏覽</th><th>導流點擊</th><th>地圖</th><th>收藏</th></tr></thead>
              <tbody>
                {stats.map((r) => (
                  <tr key={r.stay_id}>
                    <td><b>{r.name}</b></td>
                    <td>{r.ad_tier === "free" ? <span className="pill draft">免費</span> : <span className={"pill " + (r.ad_tier === "flagship" ? "live" : "feat")}>{TIER_LABEL[r.ad_tier]}</span>}</td>
                    <td>{r.views.toLocaleString()}</td>
                    <td>{r.click_web.toLocaleString()}</td>
                    <td>{r.click_map.toLocaleString()}</td>
                    <td>{r.saves.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8 }}>想提高曝光?升級「精選 / 旗艦」可在搜尋與首頁置頂。聯繫平台開通。</p>
        </div>
      )}

      <StaysAdmin initial={(data as Stay[]) || []} ownerId={user.id} plans={(plans as Plan[]) || []} />
    </>
  );
}
