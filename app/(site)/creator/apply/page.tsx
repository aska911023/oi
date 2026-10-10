import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreatorApplyForm from "@/components/creator-apply-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "成為創作者", robots: { index: false } };

export default async function CreatorApplyPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/creator/apply");

  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role;
  const { data: app } = await sb.from("creator_applications").select("status").eq("applicant_id", user.id).maybeSingle();

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70, maxWidth: 640 }}>
      <h1 className="serif" style={{ fontSize: 30, marginBottom: 10 }}>成為創作者</h1>
      <p style={{ color: "var(--text-2)", lineHeight: 1.7, marginBottom: 24 }}>
        創作者可以分享 <b>IG / YouTube 影音</b>、撰寫<b>旅遊攻略</b>,內容會掛上你的名字 —— 把你的作品帶給更多想出遊的人。
      </p>
      {role === "creator" || role === "admin" ? (
        <div className="empty">你已經是創作者了 🎉 <Link href="/creator" className="lnk">前往創作者後台 →</Link></div>
      ) : app?.status === "pending" ? (
        <div className="empty">你的申請<b>審核中</b>,我們會主動跟你聯絡 😊</div>
      ) : app?.status === "rejected" ? (
        <div className="empty">這次申請未通過。如有疑問歡迎<Link href="/contact" className="lnk">聯絡我們</Link>。</div>
      ) : (
        <CreatorApplyForm defaultEmail={user.email || ""} />
      )}
    </main>
  );
}
