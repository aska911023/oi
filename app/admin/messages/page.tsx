import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MessagesInbox, { type ConvItem } from "@/components/messages-inbox";

export const dynamic = "force-dynamic";

// 總後台訊息:業者 ↔ 平台客服(support)對話
export default async function AdminMessagesPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/admin/messages");
  const { data: convs } = await sb.from("conversations").select("*").eq("kind", "support").order("last_at", { ascending: false });
  const list = (convs || []) as { id: string; vendor_id: string | null; last_at: string }[];
  const vids = Array.from(new Set(list.map((c) => c.vendor_id).filter(Boolean))) as string[];
  const { data: profs } = vids.length ? await sb.from("profiles").select("id,display_name,full_name").in("id", vids) : { data: [] };
  const pm = new Map(((profs as { id: string; display_name?: string; full_name?: string }[]) || []).map((p) => [p.id, p.display_name || p.full_name || p.id.slice(0, 8)]));
  const items: ConvItem[] = list.map((c) => ({
    id: c.id,
    label: `業者 · ${pm.get(c.vendor_id || "") || "—"}`,
    sub: new Date(c.last_at).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
  }));
  return <MessagesInbox convs={items} meId={user.id} emptyHint="目前沒有業者的客服對話。" />;
}
