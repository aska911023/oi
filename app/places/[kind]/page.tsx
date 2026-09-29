import { notFound } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteTheme from "@/components/site-theme";
import PlacesExplore from "@/components/places-explore";
import { Logo } from "@/components/logo";
import { getSiteSettings } from "@/lib/site-settings";
import { getPublishedPois } from "@/lib/pois";
import { POI_KINDS, type PoiKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlacesPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const meta = POI_KINDS.find((k) => k.slug === kind);
  if (!meta) notFound();

  const settings = await getSiteSettings();
  const pois = await getPublishedPois(meta.kind as PoiKind);

  return (
    <>
      <SiteTheme s={settings} />
      <SiteHeader />
      <main>
        <PlacesExplore pois={pois} kind={meta.kind as PoiKind} />
      </main>

      <footer className="footer">
        <div className="shell footer-grid">
          <div className="footer-brand">
            <Logo />
            <p>偶爾出走,找到喜歡的一宿。<br />以地區、風格與預算,探索全台民宿。</p>
          </div>
          <div className="footer-col">
            <h4>探索</h4>
            <Link href="/">全部民宿</Link>
            {POI_KINDS.map((k) => <Link key={k.slug} href={`/places/${k.slug}`}>{k.label}</Link>)}
          </div>
          <div className="footer-col">
            <h4>業者</h4>
            <Link href="/apply">業者上架</Link>
            <Link href="/login">登入 / 註冊</Link>
          </div>
          <div className="footer-col">
            <h4>關於偶宿</h4>
            <Link href="/terms">服務條款</Link>
            <Link href="/privacy">隱私權政策</Link>
          </div>
        </div>
        <div className="shell footer-bottom">
          <span>© 2026 偶宿數位科技有限公司 · 台灣民宿搜尋平台</span>
          <span className="tagline">一段旅行,一處喜歡的日常。</span>
        </div>
      </footer>
    </>
  );
}
