import { createClient } from "@/lib/supabase/server";
import EventsAdmin, { type Happening } from "@/components/admin/events-admin";
import type { Plan } from "@/components/admin/plans-editor";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const sb = await createClient();
  const [{ data }, { data: plans }] = await Promise.all([
    sb.from("happenings").select("*").order("start_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
    sb.from("plans").select("*").order("sort"),
  ]);
  return <EventsAdmin initial={(data as Happening[]) || []} mode="admin" plans={(plans as Plan[]) || []} />;
}
