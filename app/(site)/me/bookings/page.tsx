import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Row {
  id: string; code: string; status: string; stay_id: string; stay_name: string;
  check_in: string; check_out: string; nights: number; adults: number; children: number;
  total: number; deposit_amount: number; booking_note: string | null; created_at: string;
  rooms: { name: string; qty: number }[];
}

const STATUS: Record<string, { label: string; pill: string }> = {
  pending: { label: "待確認", pill: "pending" },
  confirmed: { label: "已確認", pill: "live" },
  checked_in: { label: "已入住", pill: "live" },
  completed: { label: "已完成", pill: "live" },
  rejected: { label: "未成立", pill: "draft" },
  cancelled: { label: "已取消", pill: "draft" },
};

function fmt(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" }); }

export default async function MyBookings() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/me/bookings");

  const { data } = await sb.rpc("my_bookings");
  const rows = (data as Row[]) || [];

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="plan-head">
        <h1 className="serif">我的訂房</h1>
        <p>你的訂房紀錄與狀態。民宿確認後請依「付款資訊」匯款;實際入住、加購請直接與民宿聯繫。</p>
      </div>

      {rows.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>
          還沒有訂房。到<Link href="/" style={{ color: "var(--green)", textDecoration: "underline" }}>民宿頁</Link>點「線上訂房」就能預訂。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
          {rows.map((b) => {
            const st = STATUS[b.status] || { label: b.status, pill: "draft" };
            const showPay = b.deposit_amount > 0 || b.booking_note;
            return (
              <div key={b.id} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", background: "var(--surface)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <Link href={`/stay/${b.stay_id}`} style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{b.stay_name}</Link>
                  <span className={"pill " + st.pill}>{st.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }}>訂單 {b.code}</span>
                </div>
                <div style={{ fontSize: 14, color: "var(--text-2)", marginTop: 8 }}>
                  {fmt(b.check_in)} – {fmt(b.check_out)} · {b.nights} 晚 · {b.adults} 大{b.children ? ` ${b.children} 小` : ""}
                </div>
                {b.rooms.length > 0 && (
                  <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}>
                    {b.rooms.map((r, i) => <span key={i}>{i > 0 ? "、" : ""}{r.name}×{r.qty}</span>)}
                  </div>
                )}
                {b.total > 0 && <div style={{ fontSize: 14, marginTop: 6 }}>金額 NT$ {Number(b.total).toLocaleString()}{b.deposit_amount > 0 && <span style={{ color: "var(--green)", fontWeight: 600 }}> · 訂金 NT$ {Number(b.deposit_amount).toLocaleString()}</span>}</div>}

                {b.status === "pending" && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>⏳ 等待民宿確認,確認後會通知你並顯示匯款方式。</div>}
                {b.status === "confirmed" && showPay && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--green-soft)", borderRadius: 10, fontSize: 13.5, lineHeight: 1.7 }}>
                    <b style={{ color: "var(--green)" }}>💳 付款 / 轉帳資訊</b>
                    {b.deposit_amount > 0 && <div>請匯訂金 NT$ {Number(b.deposit_amount).toLocaleString()}</div>}
                    {b.booking_note ? <div style={{ whiteSpace: "pre-line" }}>{b.booking_note}</div> : <div style={{ color: "var(--muted)" }}>匯款方式請洽民宿。</div>}
                  </div>
                )}
                {(b.status === "rejected" || b.status === "cancelled") && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>此訂單已{st.label}。如有疑問可到民宿頁「私訊民宿」詢問。</div>}
              </div>
            );
          })}
        </div>
      )}

      <div className="account-actions" style={{ marginTop: 28 }}>
        <Link href="/account" className="btn btn-ghost">← 我的帳號</Link>
      </div>
    </main>
  );
}
