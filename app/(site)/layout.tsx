import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteTheme from "@/components/site-theme";
import EntryGate from "@/components/entry-gate";
import CompareBar from "@/components/compare-bar";
import { CompareProvider } from "@/lib/compare-store";
import { Logo } from "@/components/logo";
import { getSiteSettings } from "@/lib/site-settings";
import { POI_KINDS } from "@/lib/types";

export const dynamic = "force-dynamic";

// 共用外殼:header / 主題 / footer 常駐,導航時只換 children(不再每頁重查登入)
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <CompareProvider>
      <SiteTheme s={settings} />
      <EntryGate logoSrc={settings.logo_image || undefined} />
      <SiteHeader />
      {children}
      <footer className="footer">
        <div className="shell footer-grid">
          <div className="footer-brand">
            <Logo src={settings.logo_image || undefined} size={settings.logo_size} />
            <p style={{ whiteSpace: "pre-line" }}>{settings.footer_about}</p>
          </div>
          <div className="footer-col">
            <h4>探索</h4>
            <Link href="/">全部民宿</Link>
            {POI_KINDS.map((k) => <Link key={k.slug} href={`/places/${k.slug}`}>{k.label}</Link>)}
            <Link href="/rentals">租車</Link>
          </div>
          <div className="footer-col">
            <h4>行程</h4>
            <Link href="/plan">規劃行程</Link>
            <Link href="/trips">行程分享</Link>
          </div>
          <div className="footer-col">
            <h4>關於</h4>
            <Link href="/about">品牌故事</Link>
            <Link href="/contact">聯絡我們</Link>
            <Link href="/apply">業者上架</Link>
            <Link href="/terms">服務條款</Link>
            <Link href="/privacy">隱私權政策</Link>
          </div>
        </div>
        <div className="shell footer-bottom">
          <span>{settings.footer_copyright}</span>
          <span className="tagline">{settings.footer_tagline}</span>
        </div>
      </footer>
      <CompareBar />
    </CompareProvider>
  );
}
