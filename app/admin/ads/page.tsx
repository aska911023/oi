import { createClient } from "@/lib/supabase/server";
import AdsManager, { type Ad } from "@/components/admin/ads-manager";
import type { Plan } from "@/components/admin/plans-editor";

export const dynamic = "force-dynamic";

export default async function AdminAdsPage() {
  const sb = await createClient();
  const [{ data: ads }, { data: plans }] = await Promise.all([
    sb.from("ad_campaigns").select("*").order("status").order("created_at", { ascending: false }),
    sb.from("plans").select("*").order("sort"),
  ]);
  return <AdsManager initial={(ads as Ad[]) || []} mode="admin" plans={(plans as Plan[]) || []} />;
}
