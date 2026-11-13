import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StayAnalytics from "@/components/vendor/stay-analytics";

export const dynamic = "force-dynamic";

export default async function VendorAnalyticsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor/analytics");
  const { data } = await sb.from("stays").select("id,name").eq("owner_id", user.id).order("created_at", { ascending: false });
  return <StayAnalytics stays={(data as { id: string; name: string }[]) || []} />;
}
