import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DB trigger(notify_booking_change)在訂房 INSERT / 狀態變更時,用 pg_net 打這支寄 email。
// 未設 RESEND_API_KEY 時靜默略過(骨架先上,等 key 到就生效);站內鈴鐺通知不受影響。
const FROM = process.env.RESEND_FROM || "偶宿 Oi Stay <noreply@oi-stay.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.oi-stay.com";

interface Booking {
  code: string; guest_name: string; guest_phone: string; guest_email: string | null;
  check_in: string; check_out: string; nights: number; adults: number; children: number;
  total: number; deposit_amount: number; created_by: string | null; stay_id: string;
}
interface Stay { name: string; owner_id: string | null; booking_note: string | null }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const ntd = (n: number) => "NT$ " + Number(n || 0).toLocaleString();

function shell(title: string, bodyHtml: string, cta?: { href: string; label: string }) {
  return `<div style="max-width:520px;margin:0 auto;font-family:-apple-system,'PingFang TC','Noto Sans TC',sans-serif;color:#1b2b26">
    <div style="background:linear-gradient(120deg,#1b7366,#0f4a42);color:#fff;padding:20px 24px;border-radius:14px 14px 0 0">
      <div style="font-size:13px;letter-spacing:2px;opacity:.85">偶宿 O! · Oi Stay</div>
      <div style="font-size:19px;font-weight:700;margin-top:4px">${esc(title)}</div>
    </div>
    <div style="border:1px solid #e3e8e5;border-top:none;border-radius:0 0 14px 14px;padding:22px 24px;background:#fff">
      ${bodyHtml}
      ${cta ? `<div style="margin-top:22px"><a href="${cta.href}" style="display:inline-block;background:#1b7366;color:#fff;text-decoration:none;padding:11px 22px;border-radius:10px;font-weight:600">${esc(cta.label)}</a></div>` : ""}
      <div style="margin-top:22px;font-size:12px;color:#8a978f;border-top:1px solid #eef2f0;padding-top:14px">此信由偶宿系統自動發送。偶宿為曝光/媒合平台,不經手金流;實際付款、入住請與民宿確認。</div>
    </div>
  </div>`;
}

function rowsHtml(b: Booking, s: Stay) {
  const pax = `${b.adults} 位大人${b.children ? ` · ${b.children} 位小孩` : ""}`;
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.9">
    <tr><td style="color:#7a877f;width:88px">民宿</td><td style="font-weight:600">${esc(s.name || "民宿")}</td></tr>
    <tr><td style="color:#7a877f">入住 / 退房</td><td>${b.check_in} → ${b.check_out}(${b.nights} 晚)</td></tr>
    <tr><td style="color:#7a877f">人數</td><td>${pax}</td></tr>
    <tr><td style="color:#7a877f">訂單編號</td><td style="letter-spacing:1px">${esc(b.code)}</td></tr>
    ${b.total > 0 ? `<tr><td style="color:#7a877f">金額</td><td>${ntd(b.total)}${b.deposit_amount > 0 ? ` · 訂金 ${ntd(b.deposit_amount)}` : ""}</td></tr>` : ""}
  </table>`;
}

export async function POST(req: NextRequest) {
  // 來源驗證:DB trigger 帶的共享密鑰(擋外部亂打)
  if (req.headers.get("x-oi-secret") !== process.env.OI_NOTIFY_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ ok: true, skipped: "no RESEND_API_KEY" }); // 尚未設定 → 不報錯,靜默略過

  let payload: { booking_id?: string; event?: string };
  try { payload = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { booking_id, event } = payload;
  if (!booking_id || !event) return NextResponse.json({ ok: false }, { status: 400 });
  // 只對這些事件寄信;checked_in / completed 不寄
  if (!["new", "confirmed", "rejected", "cancelled"].includes(event)) return NextResponse.json({ ok: true, skipped: event });

  const sb = createAdminClient();
  const { data: b } = await sb.from("bookings")
    .select("code,guest_name,guest_phone,guest_email,check_in,check_out,nights,adults,children,total,deposit_amount,created_by,stay_id")
    .eq("id", booking_id).maybeSingle<Booking>();
  if (!b) return NextResponse.json({ ok: true, skipped: "no booking" });
  const { data: s } = await sb.from("stays").select("name,owner_id,booking_note").eq("id", b.stay_id).maybeSingle<Stay>();
  const stay = s || { name: "民宿", owner_id: null, booking_note: null };

  async function emailOf(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null;
    const { data } = await sb.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  }

  const resend = new Resend(key);
  const send = async (to: string, subject: string, html: string) => {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error)); // Resend 不 throw,錯誤在 error 欄位
  };
  try {
    if (event === "new") {
      const to = await emailOf(stay.owner_id);
      if (!to) return NextResponse.json({ ok: true, skipped: "no owner email" });
      const body = `<p style="margin:0 0 14px;font-size:15px">你有一筆<b>新的線上訂房</b>,請盡快確認。</p>
        ${rowsHtml(b, stay)}
        <div style="margin-top:14px;font-size:14px;color:#415049">訂房人:${esc(b.guest_name)}　電話:${esc(b.guest_phone)}</div>`;
      await send(to, `【偶宿】新訂房待確認 — ${stay.name}(${b.code})`,
        shell("新訂房待確認", body, { href: `${SITE}/vendor/bookings`, label: "前往確認訂單" }));
    } else {
      const to = b.guest_email || await emailOf(b.created_by);
      if (!to) return NextResponse.json({ ok: true, skipped: "no guest email" });
      if (event === "confirmed") {
        const pay = `<div style="margin-top:16px;background:#eef7f3;border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.8">
          <div style="font-weight:700;color:#0f4a42;margin-bottom:4px">💳 付款 / 轉帳資訊</div>
          ${b.deposit_amount > 0 ? `<div>請匯訂金 <b>${ntd(b.deposit_amount)}</b></div>` : ""}
          ${stay.booking_note ? `<div style="white-space:pre-line">${esc(stay.booking_note)}</div>` : `<div style="color:#7a877f">匯款方式請洽民宿。</div>`}
        </div>`;
        await send(to, `【偶宿】訂房已確認 — ${stay.name}(${b.code})`,
          shell("訂房已確認 ✅", `<p style="margin:0 0 14px;font-size:15px">你的訂房已由民宿確認,詳情如下:</p>${rowsHtml(b, stay)}${pay}`,
            { href: `${SITE}/me/bookings`, label: "查看我的訂房" }));
      } else {
        const word = event === "rejected" ? "未成立" : "已取消";
        await send(to, `【偶宿】訂房${word} — ${stay.name}(${b.code})`,
          shell(`訂房${word}`, `<p style="margin:0 0 14px;font-size:15px">很抱歉,你的這筆訂房${word}。如有疑問,可到民宿頁「私訊民宿」詢問。</p>${rowsHtml(b, stay)}`,
            { href: `${SITE}/me/bookings`, label: "查看我的訂房" }));
      }
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
