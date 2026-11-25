import { createClient } from "@/lib/supabase/server";
import ClaimsAdmin, { type Claim, type Applicant } from "@/components/admin/claims-admin";

export const dynamic = "force-dynamic";

export default async function AdminClaimsPage() {
  const sb = await createClient();
  const { data } = await sb.from("claims").select("*").order("created_at", { ascending: false });
  const claims = (data as Claim[]) || [];
  const ids = Array.from(new Set(claims.map((c) => c.applicant_id)));
  const { data: profs } = ids.length ? await sb.from("profiles").select("id,display_name,full_name").in("id", ids) : { data: [] };
  const applicants: Applicant[] = ((profs as { id: string; display_name?: string; full_name?: string }[]) || []).map((p) => ({ id: p.id, name: p.display_name || p.full_name || p.id.slice(0, 8) }));
  return <ClaimsAdmin initial={claims} applicants={applicants} />;
}
