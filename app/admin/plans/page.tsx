import { createClient } from "@/lib/supabase/server";
import PlansEditor, { type Plan } from "@/components/admin/plans-editor";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const sb = await createClient();
  const { data } = await sb.from("plans").select("*").order("sort");
  return <PlansEditor initial={(data as Plan[]) || []} />;
}
