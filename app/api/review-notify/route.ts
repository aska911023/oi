import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 待審核項目進來 → 寄 email 給官方信箱(OUSU_ADMIN_EMAILS,逗號分隔)。DB trigger notify_review 以 pg_net 呼叫。
const FROM = process.env.RESEND_FROM || "偶宿 Oi Stay <noreply@send.oi-stay.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.oi-stay.com";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export async function POST(req: NextRequest) {
  if (req.headers.get("x-oi-secret") !== process.env.OI_NOTIFY_SECRET) return NextResponse.json({ ok: false }, { status: 401 });
  const key = process.env.RESEND_API_KEY;
  const to = (process.env.OUSU_ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!key || to.length === 0) return NextResponse.json({ ok: true, skipped: "no RESEND_API_KEY or OUSU_ADMIN_EMAILS" });

  let payload: { type?: string; title?: string; href?: string };
  try { payload = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const type = payload.type || "待審核項目";
  const title = payload.title || "";
  const href = SITE + (payload.href || "/admin");

  const html = `<div style="max-width:520px;margin:0 auto;font-family:-apple-system,'PingFang TC','Noto Sans TC',sans-serif;color:#1b2b26">
    <div style="background:linear-gradient(120deg,#1b7366,#0f4a42);color:#fff;padding:20px 24px;border-radius:14px 14px 0 0">
      <div style="font-size:13px;letter-spacing:2px;opacity:.85">偶宿 O! · 後台審核</div>
      <div style="font-size:19px;font-weight:700;margin-top:4px">有新的${esc(type)}待審核</div>
    </div>
    <div style="border:1px solid #e3e8e5;border-top:none;border-radius:0 0 14px 14px;padding:22px 24px;background:#fff">
      <p style="margin:0 0 6px;font-size:15px">類型:<b>${esc(type)}</b></p>
      <p style="margin:0 0 16px;font-size:15px">對象:<b>${esc(title)}</b></p>
      <a href="${href}" style="display:inline-block;background:#1b7366;color:#fff;text-decoration:none;padding:11px 22px;border-radius:10px;font-weight:600">前往審核</a>
      <div style="margin-top:22px;font-size:12px;color:#8a978f;border-top:1px solid #eef2f0;padding-top:14px">此信由偶宿系統自動發送,提醒有待處理的審核項目。</div>
    </div>
  </div>`;

  try {
    const { error } = await new Resend(key).emails.send({ from: FROM, to, subject: `【偶宿審核】新的${type}:${title}`, html });
    if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
