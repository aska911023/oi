import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StaysAdmin from "@/components/admin/stays-admin";
import type { Stay } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VendorStaysPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor");
  const { data } = await sb.from("stays").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
  return <StaysAdmin initial={(data as Stay[]) || []} ownerId={user.id} />;
}
