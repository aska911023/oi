import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface VStat { views: number; click_web: number; saves: number }

export default async function VendorHome() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor");
  const { data: profile } = await sb.from("profiles").select("display_name, full_name").eq("id", user.id).maybeSingle();
  const hi = profile?.display_name || profile?.full_name || "業主";

  const { data: stays } = await sb.from("stays").select("id,published,approved,image").eq("owner_id", user.id);
  const stayList = stays || [];
  const stayIds = stayList.map((s) => s.id);
  const [{ data: bks }, { data: statsData }, { data: ads }] = await Promise.all([
    stayIds.length ? sb.from("bookings").select("status").in("stay_id", stayIds) : Promise.resolve({ data: [] }),
    sb.rpc("vendor_stats", { p_days: 30 }),
    sb.from("ad_campaigns").select("status").eq("owner_id", user.id),
  ]);
  const bookings = (bks as { status: string }[]) || [];
  const pendingConfirm = bookings.filter((b) => b.status === "pending").length;
  const pendingDeposit = bookings.filter((b) => b.status === "deposit_reported").length;
  const noPhoto = stayList.filter((s) => !s.image).length;
  const notLive = stayList.filter((s) => s.approved === false || !s.published).length;
  const adsPending = ((ads as { status: string }[]) || []).filter((a) => a.status === "pending").length;
  const sum = ((statsData as VStat[]) || []).reduce((a, r) => ({ views: a.views + r.views, click_web: a.click_web + r.click_web, saves: a.saves + r.saves }), { views: 0, click_web: 0, saves: 0 });

  const todos: { icon: string; text: string; href: string; urgent?: boolean }[] = [];
  if (pendingConfirm) todos.push({ icon: "📩", text: `${pendingConfirm} 筆新訂單待確認`, href: "/vendor/bookings", urgent: true });
  if (pendingDeposit) todos.push({ icon: "💰", text: `${pendingDeposit} 筆房客已匯款,待你核對訂金`, href: "/vendor/bookings", urgent: true });
  if (noPhoto) todos.push({ icon: "📷", text: `${noPhoto} 間民宿還沒有照片(有照片才吸引人)`, href: "/vendor/stays" });
  if (notLive) todos.push({ icon: "⏳", text: `${notLive} 間民宿尚未上架 / 待審核`, href: "/vendor/stays" });
  if (adsPending) todos.push({ icon: "📢", text: `${adsPending} 則活動廣告審核中`, href: "/vendor/ads" });

  const shortcuts = [
    { icon: "🏠", label: "我的民宿", desc: "新增 / 編輯 / 上架", href: "/vendor/stays" },
    { icon: "📅", label: "訂房管理", desc: "房況 · 確認訂單", href: "/vendor/bookings" },
    { icon: "📊", label: "數據分析", desc: "瀏覽 · 訂房成效", href: "/vendor/analytics" },
    { icon: "📢", label: "活動廣告", desc: "投放曝光版位", href: "/vendor/ads" },
    { icon: "🏪", label: "我的據點", desc: "景點 / 餐廳 / 娛樂", href: "/vendor/places" },
    { icon: "📖", label: "使用教學", desc: "怎麼上架與收費", href: "/vendor/guide" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 24, margin: "0 0 4px" }}>嗨,{hi} 👋</h2>
        <p style={{ color: "var(--text-2)", margin: 0 }}>這是你的經營總覽。有待辦會列在下面,處理完就都清空了。</p>
      </div>

      {/* 待辦 */}
      <section>
        <h3 className="serif shop-h" style={{ fontSize: 18, marginBottom: 10 }}>待辦事項</h3>
        {todos.length === 0 ? (
          <div style={{ padding: "18px 20px", background: "var(--green-soft)", borderRadius: 12, color: "var(--green)", fontWeight: 600 }}>
            {stayList.length === 0 ? "上架民宿後,需要你處理的事(例如新訂單)會出現在這裡。" : "✅ 目前沒有待辦,一切順利!"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {todos.map((t, i) => (
              <Link key={i} href={t.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 12, textDecoration: "none", color: "var(--text)",
                background: t.urgent ? "#fff6e9" : "var(--surface)", border: "1px solid " + (t.urgent ? "#f0d9ad" : "var(--border)") }}>
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>{t.text}</span>
                <span style={{ color: "var(--muted)", fontSize: 18 }}>›</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 還沒民宿 → 大 CTA */}
      {stayList.length === 0 && (
        <section style={{ padding: "24px", background: "var(--green)", borderRadius: 14, color: "#fff", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>開始營業的第一步</div>
          <p style={{ opacity: 0.9, margin: "0 0 14px", fontSize: 14 }}>上架你的民宿(免費!),就能被旅客搜尋到。大約 3 分鐘。</p>
          <Link href="/vendor/stays" className="btn" style={{ background: "#fff", color: "var(--green)", fontWeight: 700 }}>＋ 新增你的第一間民宿</Link>
        </section>
      )}

      {/* 近 30 天數字 */}
      {sum.views > 0 && (
        <section>
          <h3 className="serif shop-h" style={{ fontSize: 18, marginBottom: 10 }}>近 30 天</h3>
          <div className="stats">
            <div className="stat-card"><div className="n">{sum.views.toLocaleString()}</div><div className="l">瀏覽</div></div>
            <div className="stat-card"><div className="n">{sum.click_web.toLocaleString()}</div><div className="l">導流點擊</div></div>
            <div className="stat-card"><div className="n">{sum.saves.toLocaleString()}</div><div className="l">被收藏</div></div>
            <div className="stat-card"><Link href="/vendor/analytics" className="lnk">看完整分析 →</Link></div>
          </div>
        </section>
      )}

      {/* 功能捷徑 */}
      <section>
        <h3 className="serif shop-h" style={{ fontSize: 18, marginBottom: 10 }}>功能</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {shortcuts.map((s) => (
            <Link key={s.href} href={s.href} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "16px", borderRadius: 12, textDecoration: "none", color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: 24 }}>{s.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{s.label}</span>
              <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{s.desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
