import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 待審核項目進來 → 寄 email 給官方信箱。DB trigger notify_review 以 pg_net 送 {kind,id} 來。
//   收件人:優先讀 site_settings.review_email(後台可改,逗號分隔);留空則 fallback 環境變數 OUSU_ADMIN_EMAILS。
//   內容:依 kind 撈完整那一筆 + 申請人 → 一句白話摘要 + 縮圖 + 可點連結明細 + 審核重點清單,讓人一眼知道「這是什麼、該做什麼」。
const FROM = process.env.RESEND_FROM || "偶宿 Oi Stay <noreply@send.oi-stay.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.oi-stay.com";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const clip = (s: unknown, n = 200) => { const t = String(s ?? "").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };
const ymd = (s: unknown) => (s ? String(s).slice(0, 10) : "");
const dt = (s: unknown) => { if (!s) return ""; const d = String(s); return `${d.slice(0, 10)} ${d.slice(11, 16)}`; };

// 值可能是純文字 / 網址 / email → 自動變可點連結
function cell(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return `<a href="${esc(s)}" style="color:#1b7366;text-decoration:underline">${esc(clip(s, 60))}</a>`;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return `<a href="mailto:${esc(s)}" style="color:#1b7366;text-decoration:underline">${esc(s)}</a>`;
  return esc(s);
}

type Row = [string, unknown];
interface Built { typeLabel: string; subject: string; href: string; summary: string; checklist: string[]; image?: string; submittedAt?: string; rows: Row[]; }

const KIND_META: Record<string, { label: string; href: string; emoji: string }> = {
  claim: { label: "業者認領", href: "/admin/claims", emoji: "🪪" },
  vendor_app: { label: "業者上架申請", href: "/admin/vendors", emoji: "🏪" },
  creator_app: { label: "創作者 / 合作申請", href: "/admin/creators", emoji: "✍️" },
  happening: { label: "活動投稿", href: "/admin/events", emoji: "🎪" },
  ad: { label: "廣告投放申請", href: "/admin/ads", emoji: "📣" },
};
const CLAIM_KIND_LABEL: Record<string, string> = { stay: "民宿", restaurant: "餐廳", activity: "娛樂 / 體驗", catering: "外燴", rental: "租車", parking: "停車" };
const firstImg = (v: unknown): string | undefined => { if (Array.isArray(v)) return v.find((x) => typeof x === "string" && x) as string | undefined; return typeof v === "string" && v ? v : undefined; };

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
  async function applicantName(uid: string | null | undefined): Promise<string> {
    if (!uid) return "有業者";
    const { data: p } = await sb.from("profiles").select("display_name, full_name").eq("id", uid).maybeSingle();
    return p?.display_name || p?.full_name || "有業者";
  }

  if (kind === "claim") {
    const { data: c } = await sb.from("claims").select("*").eq("id", id).maybeSingle();
    if (!c) return null;
    const who = await applicant(c.applicant_id);
    const name0 = who.split("　")[0];
    return {
      typeLabel: meta.label, href: SITE + meta.href, subject: c.target_name || "(未命名店家)", submittedAt: dt(c.created_at),
      summary: `${name0} 想認領並接手管理「${c.target_name || "某店家"}」(${CLAIM_KIND_LABEL[c.kind] || c.kind}),自報身分為「${c.applicant_role || "未填"}」。`,
      checklist: [
        "用下方「可核對的官方聯繫」去電 / 查詢,確認申請人確實是該店家經營方",
        "比對自報身分、關係說明是否合理一致",
        "通過後系統會把該店家 owner 指派給本人,並將帳號升為 partner(可進業者後台)",
      ],
      rows: [
        ["認領對象", `${c.target_name || "—"}（${CLAIM_KIND_LABEL[c.kind] || c.kind}）`],
        ["申請人", who],
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
      typeLabel: meta.label, href: SITE + meta.href, subject: v.business_name || "(未填商家名)", submittedAt: dt(v.created_at),
      summary: `${await applicantName(v.applicant_id)} 申請把「${v.business_name || "某商家"}」上架為合作商家。`,
      checklist: [
        "點開官網 / 社群連結,確認商家真實存在且資料相符",
        "必要時請對方補上營業登記佐證",
        "通過後申請人升為 partner,可自行進業者後台上架與管理",
      ],
      rows: [
        ["商家名稱", v.business_name], ["申請人", await applicant(v.applicant_id)],
        ["電話", v.phone], ["Email", v.email], ["地址", v.address],
        ["官網", v.website], ["LINE", v.line_url], ["Facebook", v.fb_url], ["Instagram", v.ig_url],
        ["營業登記 / 執照", v.license_url ? "已附上(後台可檢視)" : ""], ["備註", clip(v.note)],
      ],
    };
  }
  if (kind === "creator_app") {
    const { data: cr } = await sb.from("creator_applications").select("*").eq("id", id).maybeSingle();
    if (!cr) return null;
    const links = Array.isArray(cr.links) ? cr.links.filter(Boolean).join("　") : cr.links;
    return {
      typeLabel: meta.label, href: SITE + meta.href, subject: await applicantName(cr.applicant_id), submittedAt: dt(cr.created_at),
      summary: `${await applicantName(cr.applicant_id)} 申請成為偶宿的創作者 / 合作夥伴。`,
      checklist: ["點開作品 / 社群連結,評估內容品質與調性是否合適", "以下方聯絡信箱回覆,洽談合作方式"],
      rows: [
        ["申請人", await applicant(cr.applicant_id)], ["聯絡信箱", cr.contact_email],
        ["作品 / 社群連結", links], ["自我介紹", clip(cr.intro, 260)],
      ],
    };
  }
  if (kind === "happening") {
    const { data: h } = await sb.from("happenings").select("*").eq("id", id).maybeSingle();
    if (!h) return null;
    const period = [ymd(h.start_date), ymd(h.end_date)].filter(Boolean).join(" ~ ") || ymd(h.start_date);
    return {
      typeLabel: meta.label, href: SITE + meta.href, subject: h.title || "(未命名活動)", submittedAt: dt(h.created_at),
      image: firstImg(h.images) || firstImg(h.image),
      summary: `${await applicantName(h.owner_id)} 投稿活動「${h.title || "某活動"}」,時間 ${period},地點在${[h.region, h.town].filter(Boolean).join("") || "未填"}。`,
      checklist: ["確認活動資訊正確、無不當或誤導內容", "通過後活動會出現在 /events 活動專頁與周邊推薦"],
      rows: [
        ["活動名稱", h.title], ["投稿者", await applicant(h.owner_id)],
        ["分類", h.category], ["地區", [h.region, h.town].filter(Boolean).join(" ")],
        ["地點", h.address], ["日期", period],
        ["時間", [h.start_time, h.end_time].filter(Boolean).join(" ~ ") || (h.all_day ? "全天" : "")],
        ["免費 / 室內", [h.is_free ? "免費" : "", h.indoor ? "室內" : ""].filter(Boolean).join(" · ")],
        ["官方連結", h.link_url], ["說明", clip(h.description, 260)],
      ],
    };
  }
  if (kind === "ad") {
    const { data: a } = await sb.from("ad_campaigns").select("*").eq("id", id).maybeSingle();
    if (!a) return null;
    const period = [ymd(a.start_date), ymd(a.end_date)].filter(Boolean).join(" ~ ");
    return {
      typeLabel: meta.label, href: SITE + meta.href, subject: a.title || "(未命名廣告)", submittedAt: dt(a.created_at),
      image: firstImg(a.image),
      summary: `${await applicantName(a.owner_id)} 申請投放廣告「${a.title || "某廣告"}」,檔期 ${period || "未填"},版位「${a.tier || "未填"}」。`,
      checklist: ["確認素材與導向連結合規、無誤導", "通過後依版位在指定地區輪播曝光"],
      rows: [
        ["廣告標題", a.title], ["投放者", await applicant(a.owner_id)],
        ["版位", a.tier], ["曝光地區", a.region || "全站"], ["檔期", period], ["導向連結", a.link_url],
      ],
    };
  }
  return null;
}

function renderHtml(b: Built, meta: { emoji: string }): string {
  const rows = b.rows
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k, v]) => `<tr>
      <td style="padding:10px 14px;font-size:13px;color:#6b7a73;white-space:nowrap;vertical-align:top;border-bottom:1px solid #f0f3f1;background:#fafbfa">${esc(k)}</td>
      <td style="padding:10px 14px;font-size:14px;color:#1b2b26;vertical-align:top;border-bottom:1px solid #f0f3f1;word-break:break-word;line-height:1.5">${cell(v)}</td>
    </tr>`).join("");
  const hero = b.image
    ? `<img src="${esc(b.image)}" alt="" width="560" style="width:100%;max-height:220px;object-fit:cover;display:block" />`
    : "";
  const checklist = b.checklist.length
    ? `<div style="margin:4px 0 18px;background:#f3f9f7;border:1px solid #d8ebe6;border-radius:12px;padding:14px 16px">
        <div style="font-size:13px;font-weight:700;color:#0f4a42;margin-bottom:8px">✅ 審核重點 — 通過前請確認</div>
        ${b.checklist.map((c) => `<div style="font-size:13px;color:#2e4a43;line-height:1.7;padding-left:18px;position:relative"><span style="position:absolute;left:0">·</span>${esc(c)}</div>`).join("")}
      </div>` : "";
  return `<div style="max-width:560px;margin:0 auto;font-family:-apple-system,'PingFang TC','Noto Sans TC',sans-serif;color:#1b2b26;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e3e8e5">
    <div style="background:linear-gradient(120deg,#1b7366,#0f4a42);color:#fff;padding:22px 24px">
      <div style="font-size:12px;letter-spacing:2px;opacity:.85">偶宿 O! · 後台審核通知</div>
      <div style="font-size:20px;font-weight:700;margin-top:6px">${meta.emoji} 有新的${esc(b.typeLabel)}待審核</div>
      <div style="font-size:15px;font-weight:600;opacity:.95;margin-top:6px">${esc(b.subject)}</div>
      ${b.submittedAt ? `<div style="font-size:12px;opacity:.8;margin-top:4px">送出時間:${esc(b.submittedAt)}</div>` : ""}
    </div>
    ${hero}
    <div style="padding:20px 24px">
      <div style="font-size:14px;line-height:1.7;color:#2e4a43;background:#fbfaf5;border-left:3px solid #1b7366;padding:12px 14px;border-radius:6px;margin-bottom:18px">${esc(b.summary)}</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #f0f3f1;border-radius:8px;overflow:hidden;margin-bottom:18px">${rows}</table>
      ${checklist}
      <a href="${esc(b.href)}" style="display:inline-block;background:#1b7366;color:#fff;text-decoration:none;padding:12px 26px;border-radius:10px;font-weight:600;font-size:15px">前往後台審核 →</a>
      <div style="margin-top:22px;font-size:12px;color:#8a978f;border-top:1px solid #eef2f0;padding-top:14px;line-height:1.6">
        你收到這封信,是因為有業者 / 使用者在偶宿送出了上述審核項目。<br/>可至後台「網站設定 → 審核通知信箱」調整收件人。
      </div>
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
  const meta = KIND_META[payload.kind];

  try {
    const { error } = await new Resend(key).emails.send({
      from: FROM, to, subject: `【偶宿審核】${b.typeLabel}:${b.subject}`, html: renderHtml(b, meta),
    });
    if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
