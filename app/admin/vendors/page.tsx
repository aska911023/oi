import { createClient } from "@/lib/supabase/server";
import VendorReview from "@/components/admin/vendor-review";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const sb = await createClient();
  const { data } = await sb.from("vendor_applications").select("*").order("created_at", { ascending: false });
  return <VendorReview initial={data || []} />;
}
