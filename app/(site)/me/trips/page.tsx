import { redirect } from "next/navigation";
import Link from "next/link";
import MyTrips from "@/components/my-trips";
import SignOutButton from "@/components/signout-button";
import { createClient } from "@/lib/supabase/server";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MyTripsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/me/trips");
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role || "user";
  const { data } = await sb.from("trips").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false });

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 60, maxWidth: 820 }}>
      <div className="plan-head">
        <h1 className="serif">我的行程</h1>
        <p>管理你儲存的行程,可編輯、公開分享或刪除。</p>
      </div>

      <div className="account-actions" style={{ marginBottom: 26 }}>
        <Link href="/plan" className="btn btn-primary">＋ 規劃新行程</Link>
        <Link href="/me/saved" className="btn btn-ghost">我的收藏</Link>
        <Link href="/account" className="btn btn-ghost">我的帳號</Link>
        <Link href="/" className="btn btn-ghost">繼續探索民宿</Link>
        {role === "user" && <Link href="/apply" className="btn btn-ghost">申請成為業者</Link>}
        {(role === "partner" || role === "admin") && <Link href="/vendor" className="btn btn-ghost">業者後台</Link>}
        {role === "admin" && <Link href="/admin" className="btn btn-ghost">管理後台</Link>}
      </div>

      <MyTrips initial={(data as Trip[]) || []} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 30 }}>
        <SignOutButton />
      </div>
    </main>
  );
}
