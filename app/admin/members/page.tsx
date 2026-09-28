import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import MembersAdmin from "@/components/admin/members-admin";

export const dynamic = "force-dynamic";

export default async function Members() {
  const sb = await createClient();
  const { data: profiles } = await sb.from("profiles").select("*").order("created_at", { ascending: false });

  const emailById: Record<string, string> = {};
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
      data.users.forEach((u) => { emailById[u.id] = u.email || ""; });
    }
  } catch {}

  const rows = (profiles || []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    full_name: p.full_name,
    phone: p.phone,
    address: p.address,
    role: p.role || "user",
    created_at: p.created_at,
    email: emailById[p.id] || "",
  }));

  return <MembersAdmin initial={rows} />;
}
