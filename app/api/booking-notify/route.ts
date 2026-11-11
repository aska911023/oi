import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DB trigger(notify_booking_change)在訂房 INSERT / 狀態變更時,用 pg_net 打這支寄 email。
// 未設 RESEND_API_KEY 時靜默略過;站內鈴鐺通知不受影響。
const FROM = process.env.RESEND_FROM || "偶宿 Oi Stay <noreply@send.oi-stay.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.oi-stay.com";

interface Booking {
  code: string; guest_name: string; guest_phone: string; guest_email: string | null;
  check_in: string; check_out: string; nights: number; adults: number; children: number;
  total: number; deposit_amount: number; created_by: string | null; stay_id: string;
}
interface Stay { name: string; owner_id: string | null; booking_note: string | null }
interface Room { room_name: string; qty: number }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const ntd = (n: number) => "NT$ " + Number(n || 0).toLocaleString();
const WK = ["日", "一", "二", "三", "四", "五", "六"];
const fmtDate = (d: string) => { const dt = new Date(d + "T00:00:00"); return `${d}(週${WK[dt.getDay()]})`; };

function shell(title: string, bodyHtml: string, cta?: { href: string; label: string }) {
  return `<div style="max-width:540px;margin:0 auto;font-family:-apple-system,'PingFang TC','Noto Sans TC',sans-serif;color:#1b2b26">
    <div style="background:linear-gradient(120deg,#1b7366,#0f4a42);color:#fff;padding:20px 24px;border-radius:14px 14px 0 0">
      <div style="font-size:13px;letter-spacing:2px;opacity:.85">偶宿 O! · Oi Stay</div>
      <div style="font-size:19px;font-weight:700;margin-top:4px">${esc(title)}</div>
    </div>
    <div style="border:1px solid #e3e8e5;border-top:none;border-radius:0 0 14px 14px;padding:22px 24px;background:#fff">
      ${bodyHtml}
      ${cta ? `<div style="margin-top:22px"><a href="${cta.href}" style="display:inline-block;background:#1b7366;color:#fff;text-decoration:none;padding:11px 22px;border-radius:10px;font-weight:600">${esc(cta.label)}</a></div>` : ""}
      <div style="margin-top:24px;font-size:12px;color:#8a978f;border-top:1px solid #eef2f0;padding-top:14px;line-height:1.7">
        有任何問題,可到該民宿頁點「私訊民宿」直接詢問。<br>
        此信由偶宿系統自動發送,請勿直接回覆。偶宿為旅宿曝光 / 媒合平台,不經手金流;實際付款與入住事宜,請以民宿提供的資訊為準。<br>
        <span style="color:#b4bdb7">© 偶宿 O! · Oi Stay — ${SITE.replace(/^https?:\/\//, "")}</span>
      </div>
    </div>
  </div>`;
}

// 明細表(含房型、完整日期、人數、金額/訂金);showGuest=true 時附訂房人姓名電話(給業者看)
function detail(b: Booking, s: Stay, rooms: Room[], showGuest = false) {
  const pax = `${b.adults} 位大人${b.children ? ` · ${b.children} 位小孩` : ""}`;
  const roomsStr = rooms.length ? rooms.map((r) => `${esc(r.room_name)} ×${r.qty}`).join("、") : "";
  const row = (k: string, v: string) => `<tr><td style="color:#7a877f;width:92px;vertical-align:top;padding:3px 0">${k}</td><td style="padding:3px 0">${v}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.7;margin-top:4px">
    ${row("民宿", `<b>${esc(s.name || "民宿")}</b>`)}
    ${roomsStr ? row("房型", roomsStr) : ""}
    ${row("入住", fmtDate(b.check_in))}
    ${row("退房", `${fmtDate(b.check_out)}　<span style="color:#7a877f">共 ${b.nights} 晚</span>`)}
    ${row("入住人數", pax)}
    ${row("訂單編號", `<span style="letter-spacing:1px">${esc(b.code)}</span>`)}
    ${b.total > 0 ? row("金額", `${ntd(b.total)}${b.deposit_amount > 0 ? `　<span style="color:#1b7366">訂金 ${ntd(b.deposit_amount)}</span>` : ""}`) : ""}
    ${showGuest ? row("訂房人", `${esc(b.guest_name)}　${esc(b.guest_phone)}`) : ""}
  </table>`;
}

// 提示框(接下來怎麼做)
const noteBox = (html: string, color = "#eef7f3", accent = "#0f4a42") =>
  `<div style="margin-top:16px;background:${color};border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.8;color:${accent}">${html}</div>`;

export async function POST(req: NextRequest) {
  if (req.headers.get("x-oi-secret") !== process.env.OI_NOTIFY_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ ok: true, skipped: "no RESEND_API_KEY" });

  let payload: { booking_id?: string; event?: string };
  try { payload = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { booking_id, event } = payload;
  if (!booking_id || !event) return NextResponse.json({ ok: false }, { status: 400 });
  if (!["new", "confirmed", "rejected", "cancelled"].includes(event)) return NextResponse.json({ ok: true, skipped: event });

  const sb = createAdminClient();
  const { data: b } = await sb.from("bookings")
    .select("code,guest_name,guest_phone,guest_email,check_in,check_out,nights,adults,children,total,deposit_amount,created_by,stay_id")
    .eq("id", booking_id).maybeSingle<Booking>();
  if (!b) return NextResponse.json({ ok: true, skipped: "no booking" });
  const [{ data: s }, { data: rd }] = await Promise.all([
    sb.from("stays").select("name,owner_id,booking_note").eq("id", b.stay_id).maybeSingle<Stay>(),
    sb.from("booking_rooms").select("room_name,qty").eq("booking_id", booking_id),
  ]);
  const stay = s || { name: "民宿", owner_id: null, booking_note: null };
  const rooms = (rd as Room[]) || [];

  async function emailOf(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null;
    const { data } = await sb.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  }
  const guestEmail = async () => b.guest_email || (await emailOf(b.created_by));

  const resend = new Resend(key);
  const send = async (to: string, subject: string, html: string) => {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error)); // Resend 不 throw,錯誤在 error 欄位
  };

  try {
    if (event === "new") {
      const sent: string[] = [];
      // ① 通知業者:有新訂單待確認
      const ownerTo = await emailOf(stay.owner_id);
      if (ownerTo) {
        const body = `<p style="margin:0 0 14px;font-size:15px">你有一筆<b>新的線上訂房</b>,房客正在等你確認。</p>
          ${detail(b, stay, rooms, true)}
          ${noteBox("👉 請盡快到「訂房管理」<b>確認或婉拒</b>這筆訂單;確認後房客會收到通知與你的付款資訊。", "#fff6e9", "#8a5a12")}`;
        await send(ownerTo, `【偶宿】新訂房待確認 — ${stay.name}(${b.code})`,
          shell("新訂房待確認", body, { href: `${SITE}/vendor/bookings`, label: "前往確認訂單" }));
        sent.push("owner");
      }
      // ② 通知房客:已收到申請,待民宿確認
      const gTo = await guestEmail();
      if (gTo) {
        const body = `<p style="margin:0 0 6px;font-size:15px">${esc(b.guest_name)} 你好,<b>我們已收到你的訂房申請</b>!</p>
          <p style="margin:0 0 14px;font-size:14px;color:#415049">目前狀態為「待民宿確認」,民宿確認後會再以 email 通知你,並提供匯款 / 付款方式。</p>
          ${detail(b, stay, rooms)}
          ${noteBox("這筆訂房<b>尚未成立</b>,請先別匯款;民宿確認後你會收到「訂房已確認」信,裡面有付款資訊。你也可以隨時到「我的訂房」查看最新狀態。")}`;
        await send(gTo, `【偶宿】訂房申請已送出 — ${stay.name}(${b.code})`,
          shell("訂房申請已送出", body, { href: `${SITE}/me/bookings`, label: "查看我的訂房" }));
        sent.push("guest");
      }
      if (!sent.length) return NextResponse.json({ ok: true, skipped: "no email" });
    } else {
      const to = await guestEmail();
      if (!to) return NextResponse.json({ ok: true, skipped: "no guest email" });
      if (event === "confirmed") {
        const pay = noteBox(
          `<div style="font-weight:700;margin-bottom:4px">💳 付款 / 轉帳資訊</div>
          ${b.deposit_amount > 0 ? `<div>請匯<b>訂金 ${ntd(b.deposit_amount)}</b>(總金額 ${ntd(b.total)})</div>` : ""}
          ${stay.booking_note ? `<div style="white-space:pre-line;margin-top:4px">${esc(stay.booking_note)}</div>` : `<div style="color:#7a877f;margin-top:4px">匯款方式請洽民宿。</div>`}`);
        const body = `<p style="margin:0 0 6px;font-size:15px">${esc(b.guest_name)} 你好,<b>你的訂房已由民宿確認!</b> 🎉</p>
          <p style="margin:0 0 14px;font-size:14px;color:#415049">請依下方付款資訊完成匯款,即完成訂房。</p>
          ${detail(b, stay, rooms)}${pay}`;
        await send(to, `【偶宿】訂房已確認 — ${stay.name}(${b.code})`,
          shell("訂房已確認 ✅", body, { href: `${SITE}/me/bookings`, label: "查看我的訂房" }));
      } else {
        const word = event === "rejected" ? "未成立" : "已取消";
        const body = `<p style="margin:0 0 6px;font-size:15px">${esc(b.guest_name)} 你好,很抱歉,你的這筆訂房<b>${word}</b>。</p>
          <p style="margin:0 0 14px;font-size:14px;color:#415049">若已匯款,請與民宿聯繫處理退款;有任何疑問,可到民宿頁「私訊民宿」詢問。</p>
          ${detail(b, stay, rooms)}`;
        await send(to, `【偶宿】訂房${word} — ${stay.name}(${b.code})`,
          shell(`訂房${word}`, body, { href: `${SITE}/me/bookings`, label: "查看我的訂房" }));
      }
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
