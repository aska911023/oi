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

  // 只撈實際有被指派為業主的帳號,用來在列表顯示「歸屬於誰」
  const ownerIds = Array.from(new Set(((data as Stay[]) || []).map((s) => s.owner_id).filter(Boolean))) as string[];
  const { data: owners } = ownerIds.length
    ? await sb.from("profiles").select("id,display_name,full_name,role").in("id", ownerIds)
    : { data: [] };

  return <StaysAdmin initial={(data as Stay[]) || []} bdInitial={bd || []} ownersInitial={owners || []} />;
}
