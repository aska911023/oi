import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventsAdmin, { type Happening } from "@/components/admin/events-admin";
import type { Plan } from "@/components/admin/plans-editor";

export const dynamic = "force-dynamic";

export default async function VendorEventsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor/events");
  const [{ data }, { data: plans }] = await Promise.all([
    sb.from("happenings").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    sb.from("plans").select("*").order("sort"),
  ]);
  return (
    <>
      <div className="vendor-page-head">
        <h2>活動投稿</h2>
        <p>投稿你的活動(市集 / 體驗 / 展覽…),送審通過後會在活動專頁與附近的民宿頁曝光。</p>
      </div>
      <EventsAdmin initial={(data as Happening[]) || []} mode="vendor" ownerId={user.id} plans={(plans as Plan[]) || []} />
    </>
  );
}
