import { createClient } from "@/lib/supabase/server";
import StaysAdmin from "@/components/admin/stays-admin";
import type { Stay } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminStaysPage() {
  const sb = await createClient();
  const { data } = await sb.from("stays").select("*").order("created_at", { ascending: false });
  return <StaysAdmin initial={(data as Stay[]) || []} />;
}
