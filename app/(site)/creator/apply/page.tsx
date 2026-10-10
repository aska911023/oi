import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreatorApplyForm from "@/components/creator-apply-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "成為創作者", robots: { index: false } };

export default async function CreatorApplyPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  // 不用 redirect():(site) 的 error.tsx 自癒邊界會把頁面層 redirect 吃掉 → 未登入直接顯示登入提示
  const profile = user ? (await sb.from("profiles").select("role").eq("id", user.id).maybeSingle()).data : null;
  const role = profile?.role;
  const app = user ? (await sb.from("creator_applications").select("status").eq("applicant_id", user.id).maybeSingle()).data : null;

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70, maxWidth: 640 }}>
      <h1 className="serif" style={{ fontSize: 30, marginBottom: 10 }}>成為創作者</h1>
      <p style={{ color: "var(--text-2)", lineHeight: 1.7, marginBottom: 24 }}>
        創作者可以在分享牆分享 <b>IG / YouTube 影音</b> 與<b>行程</b>,內容會掛上你的名字 —— 把你的作品帶給更多想出遊的人。
      </p>
      {!user ? (
        <div className="empty">請先<Link href="/login?next=/creator/apply" className="lnk">登入 / 註冊</Link>,才能申請成為創作者。</div>
      ) : role === "creator" || role === "admin" ? (
        <div className="empty">你已經是創作者了 🎉 現在可以在<Link href="/trips" className="lnk">行程分享牆</Link>分享 IG / YouTube 影音。</div>
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
