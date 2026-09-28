import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function countKind(sb: Awaited<ReturnType<typeof createClient>>, kind: string) {
  const { count } = await sb.from("track_events").select("*", { count: "exact", head: true }).eq("kind", kind);
  return count || 0;
}

export default async function Analytics() {
  const sb = await createClient();
  const [impressions, clicks, outbound] = await Promise.all([
    countKind(sb, "impression"),
    countKind(sb, "click"),
    countKind(sb, "outbound"),
  ]);
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : "0.0";

  return (
    <>
      <div className="stats">
        <div className="stat-card"><div className="n">{impressions.toLocaleString()}</div><div className="l">曝光數(民宿被看到)</div></div>
        <div className="stat-card"><div className="n">{clicks.toLocaleString()}</div><div className="l">點擊數(點進詳情)</div></div>
        <div className="stat-card"><div className="n">{outbound.toLocaleString()}</div><div className="l">導流數(前往民宿官網)</div></div>
        <div className="stat-card"><div className="n">{ctr}%</div><div className="l">點擊率 CTR</div></div>
      </div>

      <div className="atable-wrap" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
        <p style={{ margin: 0, fontSize: 14 }}>
          數據會在消費者開始瀏覽、點擊與導流後累積。<br />
          曝光 / 點擊 / 導流即時記錄,可做為業者「精選置頂」成效與導購計費(CPC / CPA)的依據。
        </p>
      </div>
    </>
  );
}
