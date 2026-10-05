import { createClient } from "@/lib/supabase/server";
import FeedList from "@/components/feed-list";
import type { Post } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data } = await sb.rpc("posts_feed", { lim: 20, off: 0 });

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 60, maxWidth: 620 }}>
      <div className="plan-head">
        <h1 className="serif">旅人圈</h1>
        <p>分享你的旅程、推薦的民宿與景點;按讚、留言、互相參考。</p>
      </div>
      <FeedList initial={(data as Post[]) || []} loggedIn={!!user} myId={user?.id || null} />
    </main>
  );
}
