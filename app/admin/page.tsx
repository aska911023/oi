import { createClient } from "@/lib/supabase/server";
import StaysAdmin from "@/components/admin/stays-admin";
import type { Stay } from "@/lib/types";
import type { Plan } from "@/components/admin/plans-editor";

export const dynamic = "force-dynamic";

export default async function AdminStaysPage() {
  const sb = await createClient();
  const [{ data, error }, { data: bd }] = await Promise.all([
    sb.from("stays").select("*").order("created_at", { ascending: false }),
    sb.from("stay_bd").select("stay_id,contacted,rejected,note"),   // 洽談紀錄(admin only)
  ]);
  const { data: plans } = await sb.from("plans").select("*").order("sort");

  // 只撈實際有被指派為業主的帳號,用來在列表顯示「歸屬於誰」
  const ownerIds = Array.from(new Set(((data as Stay[]) || []).map((s) => s.owner_id).filter(Boolean))) as string[];
  const { data: owners } = ownerIds.length
    ? await sb.from("profiles").select("id,display_name,full_name,role").in("id", ownerIds)
    : { data: [] };

  // 查詢失敗時 data 會是 null,若直接往下渲染會變成「0 筆」,看起來像資料不見了。
  // 寧可明講失敗讓人重試,也不要顯示錯的數字。
  return (
    <StaysAdmin
      initial={(data as Stay[]) || []}
      bdInitial={bd || []}
      ownersInitial={owners || []}
      loadError={error ? error.message : null}
      plans={(plans as Plan[]) || []}
    />
  );
}
