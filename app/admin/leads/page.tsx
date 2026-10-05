import { createClient } from "@/lib/supabase/server";
import LeadsBoard, { type Lead } from "@/components/admin/leads-board";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const sb = await createClient();
  const { data } = await sb
    .from("leads")
    .select("*")
    .order("kind", { ascending: true })
    .order("priority", { ascending: true, nullsFirst: false })
    .order("county", { ascending: true })
    .order("name", { ascending: true });

  return <LeadsBoard initial={(data as Lead[]) || []} />;
}
