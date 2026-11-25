import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 待審核項目進來 → 寄 email 給官方信箱。DB trigger notify_review 以 pg_net 送 {kind,id} 來。
//   收件人:優先讀 site_settings.review_email(後台可改,逗號分隔);留空則 fallback 環境變數 OUSU_ADMIN_EMAILS。
//   內容:依 kind 撈完整那一筆 + 申請人資料,整理成「一眼就懂是什麼」的明細表。
const FROM = process.env.RESEND_FROM || "偶宿 Oi Stay <noreply@send.oi-stay.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.oi-stay.com";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const clip = (s: unknown, n = 160) => { const t = String(s ?? "").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };
const ymd = (s: unknown) => (s ? String(s).slice(0, 10) : "");

type Row = [string, unknown];
interface Built { typeLabel: string; subject: string; href: string; rows: Row[]; }

const KIND_META: Record<string, { label: string; href: string }> = {
  claim: { label: "業者認領", href: "/admin/claims" },
  vendor_app: { label: "業者上架申請", href: "/admin/vendors" },
  creator_app: { label: "創作者 / 合作申請", href: "/admin/creators" },
  happening: { label: "活動投稿", href: "/admin/events" },
  ad: { label: "廣告投放申請", href: "/admin/ads" },
};

const CLAIM_KIND_LABEL: Record<string, string> = {
  stay: "民宿", restaurant: "餐廳", activity: "娛樂 / 體驗", catering: "外燴", rental: "租車", parking: "停車",
};

// 用 service_role 撈那一筆 + 申請人(profiles + auth email)
async function buildDetail(kind: string, id: string): Promise<Built | null> {
  const sb = createAdminClient();
  const meta = KIND_META[kind];
  if (!meta) return null;

  async function applicant(uid: string | null | undefined): Promise<string> {
    if (!uid) return "";
    const { data: p } = await sb.from("profiles").select("display_name, full_name, phone").eq("id", uid).maybeSingle();
    let email = "";
    try { const { data } = await sb.auth.admin.getUserById(uid); email = data?.user?.email || ""; } catch {}
    const name = p?.display_name || p?.full_name || "(未填名稱)";
    return [name, p?.phone && `☎ ${p.phone}`, email && `✉ ${email}`].filter(Boolean).join("　");
  }

  if (kind === "claim") {
    const { data: c } = await sb.from("claims").select("*").eq("id", id).maybeSingle();
    if (!c) return null;
    return {
      typeLabel: meta.label, href: SITE + meta.href, subject: c.target_name || "(未命名店家)",
      rows: [
        ["認領對象", `${c.target_name || "—"}（${CLAIM_KIND_LABEL[c.kind] || c.kind}）`],
        ["申請人", await applicant(c.applicant_id)],
        ["自報身分", c.applicant_role],
        ["可核對的官方聯繫", c.contact],
        ["與店家關係", c.relation_note],
        ["希望更正 / 補充", clip(c.wish_note)],
        ["素材 / 授權說明", clip(c.material_note)],
        ["授權到期", ymd(c.auth_until)],
        ["是否詢問付費方案", c.want_paid ? "是,有意願了解" : "否"],
      ],
    };
  }
  if (kind === "vendor_app") {
    const { data: v } = await sb.from("vendor_applications").select("*").eq("id", id).maybeSingle();
    if (!v) return null;
    return {
      typeLabel: meta.label, href: SITE + meta.href, subject: v.business_name || "(未填商家名)",
      rows: [
        ["商家名稱", v.business_name],
        ["申請人", await applicant(v.applicant_id)],
        ["電話", v.phone], ["Email", v.email], ["地址", v.address],
        ["官網", v.website], ["LINE", v.line_url], ["Facebook", v.fb_url], ["Instagram", v.ig_url],
        ["營業登記 / 執照", v.license_url ? "已附上(後台可檢視)" : ""],
        ["備註", clip(v.note)],
      ],
    };
  }
  if (kind === "creator_app") {
    const { data: cr } = await sb.from("creator_applications").select("*").eq("id", id).maybeSingle();
    if (!cr) return null;
    const links = Array.isArray(cr.links) ? cr.links.filter(Boolean).join("　") : cr.links;
    return {
      typeLabel: meta.label, href: SITE + meta.href, subject: "創作者 / 合作申請",
      rows: [
        ["申請人", await applicant(cr.applicant_id)],
        ["聯絡信箱", cr.contact_email],
        ["作品 / 社群連結", links],
        ["自我介紹", clip(cr.intro, 240)],
      ],
    };
  }
  if (kind === "happening") {
    const { data: h } = await sb.from("happenings").select("*").eq("id", id).maybeSingle();
    if (!h) return null;
    const period = [ymd(h.start_date), ymd(h.end_date)].filter(Boolean).join(" ~ ") || ymd(h.start_date);
    return {
      typeLabel: meta.label, href: SITE + meta.href, subject: h.title || "(未命名活動)",
      rows: [
        ["活動名稱", h.title],
        ["投稿者", await applicant(h.owner_id)],
        ["分類", h.category], ["地區", [h.region, h.town].filter(Boolean).join(" ")],
        ["地點", h.address], ["日期", period],
        ["時間", [h.start_time, h.end_time].filter(Boolean).join(" ~ ") || (h.all_day ? "全天" : "")],
        ["免費 / 室內", [h.is_free ? "免費" : "", h.indoor ? "室內" : ""].filter(Boolean).join(" · ")],
        ["官方連結", h.link_url],
        ["說明", clip(h.description, 240)],
      ],
    };
  }
  if (kind === "ad") {
    const { data: a } = await sb.from("ad_campaigns").select("*").eq("id", id).maybeSingle();
    if (!a) return null;
    const period = [ymd(a.start_date), ymd(a.end_date)].filter(Boolean).join(" ~ ");
    return {
      typeLabel: meta.label, href: SITE + meta.href, subject: a.title || "(未命名廣告)",
      rows: [
        ["廣告標題", a.title],
        ["投放者", await applicant(a.owner_id)],
        ["版位", a.tier], ["曝光地區", a.region || "全站"],
        ["檔期", period], ["導向連結", a.link_url],
      ],
    };
  }
  return null;
}

function renderHtml(b: Built): string {
  const rows = b.rows
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k, v]) => `<tr>
      <td style="padding:9px 14px;font-size:13px;color:#6b7a73;white-space:nowrap;vertical-align:top;border-bottom:1px solid #f0f3f1">${esc(k)}</td>
      <td style="padding:9px 14px;font-size:14px;color:#1b2b26;vertical-align:top;border-bottom:1px solid #f0f3f1;word-break:break-word">${esc(v)}</td>
    </tr>`).join("");
  return `<div style="max-width:560px;margin:0 auto;font-family:-apple-system,'PingFang TC','Noto Sans TC',sans-serif;color:#1b2b26">
    <div style="background:linear-gradient(120deg,#1b7366,#0f4a42);color:#fff;padding:20px 24px;border-radius:14px 14px 0 0">
      <div style="font-size:13px;letter-spacing:2px;opacity:.85">偶宿 O! · 後台審核通知</div>
      <div style="font-size:19px;font-weight:700;margin-top:4px">有新的${esc(b.typeLabel)}待審核</div>
      <div style="font-size:14px;opacity:.9;margin-top:3px">${esc(b.subject)}</div>
    </div>
    <div style="border:1px solid #e3e8e5;border-top:none;border-radius:0 0 14px 14px;padding:20px 24px;background:#fff">
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px">${rows}</table>
      <a href="${esc(b.href)}" style="display:inline-block;background:#1b7366;color:#fff;text-decoration:none;padding:11px 24px;border-radius:10px;font-weight:600">前往後台審核 →</a>
      <div style="margin-top:20px;font-size:12px;color:#8a978f;border-top:1px solid #eef2f0;padding-top:14px">此信由偶宿系統自動發送。請至後台核對資料後決定是否通過。</div>
    </div>
  </div>`;
}

async function recipients(): Promise<string[]> {
  try {
    const sb = createAdminClient();
    const { data } = await sb.from("site_settings").select("review_email").eq("id", 1).maybeSingle();
    const configured = String(data?.review_email || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (configured.length) return configured;
  } catch {}
  return (process.env.OUSU_ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-oi-secret") !== process.env.OI_NOTIFY_SECRET) return NextResponse.json({ ok: false }, { status: 401 });
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ ok: true, skipped: "no RESEND_API_KEY" });

  let payload: { kind?: string; id?: string };
  try { payload = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!payload.kind || !payload.id) return NextResponse.json({ ok: false, error: "missing kind/id" }, { status: 400 });

  const to = await recipients();
  if (to.length === 0) return NextResponse.json({ ok: true, skipped: "no recipients" });

  const b = await buildDetail(payload.kind, payload.id);
  if (!b) return NextResponse.json({ ok: true, skipped: "record not found" });

  try {
    const { error } = await new Resend(key).emails.send({
      from: FROM, to, subject: `【偶宿審核】${b.typeLabel}:${b.subject}`, html: renderHtml(b),
    });
    if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
