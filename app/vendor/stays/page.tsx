import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StaysAdmin from "@/components/admin/stays-admin";
import { getSiteSettings } from "@/lib/site-settings";
import type { Stay } from "@/lib/types";
import type { Plan } from "@/components/admin/plans-editor";

export const dynamic = "force-dynamic";

export default async function VendorStaysPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor/stays");
  const [{ data }, { data: plans }] = await Promise.all([
    sb.from("stays").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    sb.from("plans").select("*").order("sort"),
  ]);
  return (
    <>
      <div className="vendor-page-head">
        <h2>我的民宿</h2>
        <p>新增、編輯你的民宿並送審上架;上架後即對外曝光。點「訂房管理」設定房況與處理訂單。</p>
      </div>
      <StaysAdmin initial={(data as Stay[]) || []} ownerId={user.id} plans={(plans as Plan[]) || []} bookingLive={(await getSiteSettings()).booking_live} />
    </>
  );
}
