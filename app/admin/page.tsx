import { createClient } from "@/lib/supabase/server";
import StaysAdmin from "@/components/admin/stays-admin";
import type { Stay } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminStaysPage() {
  const sb = await createClient();
  const [{ data }, { data: bd }] = await Promise.all([
    sb.from("stays").select("*").order("created_at", { ascending: false }),
    sb.from("stay_bd").select("stay_id,contacted,rejected,note"),   // 洽談紀錄(admin only)
  ]);
  return <StaysAdmin initial={(data as Stay[]) || []} bdInitial={bd || []} />;
}
