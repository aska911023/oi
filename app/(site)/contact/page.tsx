import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const s = await getSiteSettings();
  return (
    <main className="legal">
      <h1>聯絡我們</h1>
      <p className="updated">偶宿 O! 客服</p>

      <p style={{ whiteSpace: "pre-line" }}>{s.contact_intro}</p>

      <div className="box">
        <p style={{ margin: "4px 0" }}>📧 Email:<a href={`mailto:${s.contact_email || "hello@oistay.tw"}`}>{s.contact_email || "hello@oistay.tw"}</a></p>
        {s.contact_line && <p style={{ margin: "4px 0" }}>💬 LINE:<a href={s.contact_line} target="_blank" rel="noopener noreferrer">官方帳號</a></p>}
        {s.contact_phone && <p style={{ margin: "4px 0" }}>📞 電話:{s.contact_phone}</p>}
      </div>

      <h2>我是民宿 / 店家</h2>
      <p>想在偶宿曝光、把客人導回你的官方管道?請<Link href="/apply">申請成為業者</Link>,審核通過後即可自助上架。</p>
    </main>
  );
}
