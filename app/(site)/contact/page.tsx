import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

// LINE 填網址就用網址;填 @ID(或純 ID)自動轉成加好友連結
const lineHref = (v: string) => {
  const t = (v || "").trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://line.me/R/ti/p/@${t.replace(/^@/, "")}`;
};
// IG/FB 等:沒帶 http 就補上 https://(避免變成壞的相對連結)
const httpHref = (v: string) => {
  const t = (v || "").trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

export default async function ContactPage() {
  const s = await getSiteSettings();
  return (
    <main className="legal">
      <h1>聯絡我們</h1>
      <p className="updated">偶宿 O! 客服</p>

      {s.brand_philosophy && (
        <blockquote style={{ borderLeft: "3px solid var(--green)", paddingLeft: 14, margin: "14px 0 20px", color: "var(--text-2)", fontStyle: "italic", whiteSpace: "pre-line" }}>
          {s.brand_philosophy}
        </blockquote>
      )}

      <p style={{ whiteSpace: "pre-line" }}>{s.contact_intro}</p>

      <div className="box">
        <p style={{ margin: "4px 0" }}>📧 Email:<a href={`mailto:${s.contact_email || "hello@oistay.tw"}`}>{s.contact_email || "hello@oistay.tw"}</a></p>
        {s.contact_line && <p style={{ margin: "4px 0" }}>💬 LINE@:<a href={s.contact_line} target="_blank" rel="noopener noreferrer">官方帳號</a></p>}
        {s.contact_ig && <p style={{ margin: "4px 0" }}>📷 Instagram:<a href={s.contact_ig} target="_blank" rel="noopener noreferrer">追蹤我們</a></p>}
        {s.contact_fb && <p style={{ margin: "4px 0" }}>👍 Facebook:<a href={s.contact_fb} target="_blank" rel="noopener noreferrer">粉絲專頁</a></p>}
        {s.contact_phone && <p style={{ margin: "4px 0" }}>📞 電話:{s.contact_phone}</p>}
      </div>

      <h2>我是民宿 / 店家</h2>
      <p>想在偶宿曝光、把客人導回你的官方管道?請<Link href="/apply">申請成為業者</Link>,審核通過後即可自助上架。</p>
    </main>
  );
}
