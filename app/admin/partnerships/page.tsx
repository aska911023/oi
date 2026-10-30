import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PartnershipsBoard, { type Post } from "@/components/partnerships-board";

export const dynamic = "force-dynamic";

// 總後台：所有業者的異業合作 / 合作需求（可檢視、刪除）
export default async function AdminPartnershipsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/admin/partnerships");
  const { data: posts } = await sb.from("partnership_posts").select("*").order("created_at", { ascending: false });
  return (
    <PartnershipsBoard
      initial={(posts as Post[]) || []}
      ownerId={user.id}
      isAdmin={true}
      myStays={[]}
    />
  );
}
