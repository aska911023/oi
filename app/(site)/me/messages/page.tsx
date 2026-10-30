import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MessagesInbox, { type ConvItem } from "@/components/messages-inbox";

export const dynamic = "force-dynamic";

// 消費者訊息:我私訊過的民宿(booking)對話
export default async function MyMessagesPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/me/messages");
  const { data: convs } = await sb.from("conversations").select("*").eq("customer_id", user.id).order("last_at", { ascending: false });
  const list = (convs || []) as { id: string; stay_id: string | null; last_at: string }[];
  const stayIds = Array.from(new Set(list.map((c) => c.stay_id).filter(Boolean))) as string[];
  const { data: stays } = stayIds.length ? await sb.from("stays").select("id,name").in("id", stayIds) : { data: [] };
  const sm = new Map(((stays as { id: string; name: string }[]) || []).map((s) => [s.id, s.name]));
  const items: ConvItem[] = list.map((c) => ({
    id: c.id,
    label: sm.get(c.stay_id || "") || "民宿",
    sub: new Date(c.last_at).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
  }));
  return <MessagesInbox convs={items} meId={user.id} emptyHint="還沒有訊息。在民宿頁點「私訊民宿」就能開始對話。" />;
}
