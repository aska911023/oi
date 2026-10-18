import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteTheme from "@/components/site-theme";
import EntryGate from "@/components/entry-gate";
import PageViewTracker from "@/components/page-view-tracker";
import ScrollTop from "@/components/scroll-top";
import CompareBar from "@/components/compare-bar";
import BottomNav from "@/components/bottom-nav";
import TripDraftBadge from "@/components/trip-draft-badge";
import RolePreviewBanner from "@/components/role-preview-banner";
import LoginGateModal from "@/components/login-gate-modal";
import { CompareProvider } from "@/lib/compare-store";
import { Logo } from "@/components/logo";
import { getSiteSettings } from "@/lib/site-settings";
import { POI_KINDS } from "@/lib/types";

// 殼層不再查 auth(登入狀態改由 header 的 client 島顯示),整個 (site) 子樹才能進 CDN(ISR)。
// getSiteSettings 走 unstable_cache,殼層可靜態化;內容頁各自設 revalidate。
export const revalidate = 300;

// 共用外殼:header / 主題 / footer 常駐,導航時只換 children
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  // 站級結構化資料:品牌實體(Organization)+ 網站(WebSite),讓 Google 建立 oi-stay 品牌 Entity
  const socials = [settings.contact_fb, settings.contact_ig].filter((u): u is string => !!u && /^https?:\/\//.test(u));
  const siteLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": "https://www.oi-stay.com/#org", name: "偶宿 O!", alternateName: "oi-stay", url: "https://www.oi-stay.com", logo: settings.logo_image || "https://www.oi-stay.com/icon.png", ...(socials.length ? { sameAs: socials } : {}) },
      { "@type": "WebSite", "@id": "https://www.oi-stay.com/#website", name: "偶宿 O!", alternateName: "oi-stay", url: "https://www.oi-stay.com", inLanguage: "zh-TW", publisher: { "@id": "https://www.oi-stay.com/#org" }, potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: "https://www.oi-stay.com/search?q={search_term_string}" }, "query-input": "required name=search_term_string" } },
    ],
  };
  return (
    <CompareProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }} />
      <SiteTheme s={settings} />
      <ScrollTop />
      <PageViewTracker />
      <EntryGate logoSrc={settings.logo_image || undefined} />
      <RolePreviewBanner />
      <SiteHeader />
      {children}
      <footer className="footer">
        <div className="shell footer-grid">
          <div className="footer-brand">
            <Logo src={settings.footer_logo_image || settings.logo_image || undefined} size={settings.footer_logo_image ? settings.footer_logo_size : settings.logo_size} />
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
            <Link href="/creator/apply">成為創作者</Link>
            <Link href="/terms">服務條款</Link>
            <Link href="/privacy">隱私權政策</Link>
          </div>
        </div>
        <div className="shell footer-bottom">
          <span>{settings.footer_copyright}</span>
          <span className="tagline">{settings.footer_tagline}</span>
        </div>
        {/* 蜜罐:真人看不到也不會點;盲抓所有連結的爬蟲會踩到 → middleware 封該 IP。
            刻意用純 <a>(非 <Link>)避免 Next 預抓誤觸,並加 nofollow 讓正派爬蟲略過。 */}
        <a href="/api/_t" className="hp-trap" aria-hidden="true" tabIndex={-1} rel="nofollow noindex">請勿點擊</a>
      </footer>
      <CompareBar />
      <TripDraftBadge />
      <BottomNav />
      <LoginGateModal />
    </CompareProvider>
  );
}
