import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ArticlesAdmin from "@/components/admin/articles-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "創作者後台", robots: { index: false } };

export default async function CreatorDashboard() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const profile = user ? (await sb.from("profiles").select("role").eq("id", user.id).maybeSingle()).data : null;
  const isCreator = profile?.role === "creator" || profile?.role === "admin";

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70 }}>
      <div className="plan-head"><h1 className="serif">創作者後台</h1><p>寫旅遊攻略、分享你的內容 —— 會掛上你的名字,出現在前台 /guides。</p></div>
      {!user ? (
        <div className="empty">請先<Link href="/login?next=/creator" className="lnk">登入</Link>。</div>
      ) : !isCreator ? (
        <div className="empty">你還不是創作者。<Link href="/creator/apply" className="lnk">申請成為創作者 →</Link></div>
      ) : (
        <>
          <div className="plan-actions" style={{ marginBottom: 14 }}>
            <Link href="/plan" className="btn btn-ghost">分享行程 / 影音 →</Link>
            <Link href="/guides" className="btn btn-ghost">看前台攻略 →</Link>
          </div>
          <ArticlesAdmin ownOnly />
        </>
      )}
    </main>
  );
}
