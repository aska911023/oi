import { redirect } from "next/navigation";
import Link from "next/link";
import MyTrips from "@/components/my-trips";
import { createClient } from "@/lib/supabase/server";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MyTripsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/me/trips");
  const { data } = await sb.from("trips").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false });

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 60, maxWidth: 820 }}>
      <div className="plan-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 className="serif">我的行程</h1>
          <p>管理你儲存的行程,可編輯、公開分享或刪除。</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/account" className="btn btn-ghost">我的帳號</Link>
          <Link href="/plan" className="btn btn-primary">＋ 規劃新行程</Link>
        </div>
      </div>
      <MyTrips initial={(data as Trip[]) || []} />
    </main>
  );
}
