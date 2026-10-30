import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MessagesInbox, { type ConvItem } from "@/components/messages-inbox";

export const dynamic = "force-dynamic";

// 業者訊息:房客私訊(booking)+ 與平台客服(support)
export default async function VendorMessagesPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor/messages");
  const { data: convs } = await sb.from("conversations").select("*").eq("vendor_id", user.id).order("last_at", { ascending: false });
  const list = (convs || []) as { id: string; kind: string; stay_id: string | null; last_at: string }[];
  const stayIds = Array.from(new Set(list.map((c) => c.stay_id).filter(Boolean))) as string[];
  const { data: stays } = stayIds.length ? await sb.from("stays").select("id,name").in("id", stayIds) : { data: [] };
  const sm = new Map(((stays as { id: string; name: string }[]) || []).map((s) => [s.id, s.name]));
  const items: ConvItem[] = list.map((c) => ({
    id: c.id,
    label: c.kind === "support" ? "平台客服" : `房客諮詢 · ${sm.get(c.stay_id || "") || "民宿"}`,
    sub: new Date(c.last_at).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
  }));
  return <MessagesInbox convs={items} meId={user.id} canStartSupport emptyHint="還沒有訊息。房客私訊你的民宿、或你點「聯絡平台客服」後,會出現在這裡。" />;
}
