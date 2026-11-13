import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdsManager, { type Ad } from "@/components/admin/ads-manager";
import type { Plan } from "@/components/admin/plans-editor";

export const dynamic = "force-dynamic";

export default async function VendorAdsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor/ads");
  const [{ data: ads }, { data: plans }] = await Promise.all([
    sb.from("ad_campaigns").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    sb.from("plans").select("*").order("sort"),
  ]);
  return <AdsManager initial={(ads as Ad[]) || []} mode="vendor" ownerId={user.id} plans={(plans as Plan[]) || []} />;
}
