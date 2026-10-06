import { createClient } from "@/lib/supabase/server";
import PartnersBoard, { type Vendor, type OwnedStay } from "@/components/admin/partners-board";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const sb = await createClient();
  const { data: vendors } = await sb.from("vendors").select("*").order("created_at", { ascending: false });
  const { data: stays } = await sb
    .from("stays")
    .select("id,name,region,town,owner_id,published,visibility,featured,ad_tier,approved,image,category,price")
    .not("owner_id", "is", null);
  return <PartnersBoard vendors={(vendors as Vendor[]) || []} stays={(stays as OwnedStay[]) || []} />;
}
