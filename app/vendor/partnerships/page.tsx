import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PartnershipsBoard, { type Post } from "@/components/partnerships-board";

export const dynamic = "force-dynamic";

// 業者後台：異業合作 / 合作需求（發布自己的需求 + 瀏覽其他業者的需求）
export default async function VendorPartnershipsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor/partnerships");
  const [{ data: posts }, { data: stays }] = await Promise.all([
    sb.from("partnership_posts").select("*").order("created_at", { ascending: false }),
    sb.from("stays").select("id,name").eq("owner_id", user.id).order("name"),
  ]);
  return (
    <PartnershipsBoard
      initial={(posts as Post[]) || []}
      ownerId={user.id}
      isAdmin={false}
      myStays={(stays as { id: string; name: string }[]) || []}
    />
  );
}
