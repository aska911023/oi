import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const s = await getSiteSettings();
  return (
    <main className="legal">
      <h1>品牌故事</h1>
      <p className="updated">關於偶宿 O!</p>
      <div style={{ whiteSpace: "pre-line", fontSize: 15, color: "var(--text-2)", lineHeight: 1.9 }}>{s.about_body}</div>
      <div className="box">
        <p style={{ margin: 0 }}>想合作或上架你的民宿?歡迎<Link href="/apply">申請成為業者</Link>,或到<Link href="/contact">聯絡我們</Link>找到我們。</p>
      </div>
    </main>
  );
}
