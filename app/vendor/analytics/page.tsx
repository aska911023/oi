import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StayAnalytics from "@/components/vendor/stay-analytics";

export const dynamic = "force-dynamic";

export default async function VendorAnalyticsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor/analytics");
  const { data } = await sb.from("stays").select("id,name").eq("owner_id", user.id).order("created_at", { ascending: false });
  return (
    <>
      <div className="vendor-page-head">
        <h2>數據分析</h2>
        <p>選一間民宿,看它的曝光、互動與訂房成效。瀏覽高但沒人訂,通常是價格或照片要調。</p>
      </div>
      <StayAnalytics stays={(data as { id: string; name: string }[]) || []} />
    </>
  );
}
