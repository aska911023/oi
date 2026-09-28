import Link from "next/link";
import { Logo } from "@/components/logo";
import Explore from "@/components/explore";
import { getPublishedStays } from "@/lib/stays";

export const dynamic = "force-dynamic";

export default async function Home() {
  // 有 Supabase 且有資料 → 讀已上架民宿;否則用範例(fallback)。
  const { stays } = await getPublishedStays();

  return (
    <>
      <header className="topbar on-green">
        <div className="shell">
          <Logo />
          <nav className="topnav">
            <Link href="/">探索民宿</Link>
            <Link href="/login" className="cta">登入 / 註冊</Link>
          </nav>
        </div>
      </header>

      <main>
        <Explore stays={stays} />
      </main>

      <footer className="footer">
        <div className="shell">
          <Logo />
          <span className="tagline">一段旅行,一處喜歡的日常。</span>
          <Link href="/admin" style={{ fontSize: 13, color: "var(--muted)" }}>管理後台</Link>
        </div>
      </footer>
    </>
  );
}
