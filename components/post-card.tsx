"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import HeroCarousel from "@/components/hero-carousel";
import PostLikeButton from "@/components/post-like-button";
import PlaceComments from "@/components/place-comments";
import ShareLinkButton from "@/components/share-link-button";
import type { Post } from "@/lib/types";

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "剛剛";
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day} 天前`;
  return new Date(iso).toLocaleDateString("zh-TW");
}

export default function PostCard({ post, myId }: { post: Post; myId: string | null }) {
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;

  async function del() {
    if (!confirm("刪除這則貼文?")) return;
    const sb = createClient();
    await sb.from("posts").delete().eq("id", post.id);
    setDeleted(true);
  }

  const imgs = post.images || [];
  const author = post.name || "旅人";

  return (
    <div className="post-card">
      <div className="post-head">
        <div className="post-avatar" aria-hidden>{author.slice(0, 1)}</div>
        <div className="post-meta">
          <div className="post-author">{author}</div>
          <div className="post-time">{timeAgo(post.created_at)}</div>
        </div>
        {myId === post.user_id && <button className="lnk danger post-del" onClick={del}>刪除</button>}
      </div>
      {post.body && <p className="post-body">{post.body}</p>}
      {imgs.length > 0 && <div className="post-photos"><HeroCarousel images={imgs} height={380} /></div>}
      <div className="trip-actions">
        <PostLikeButton postId={post.id} count={post.like_count || 0} liked={post.liked} />
        <button className={"trip-act" + (open ? " on" : "")} title="留言" onClick={() => setOpen((o) => !o)}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.6L3 21l1.9-5.8A8.5 8.5 0 1 1 21 11.5z" /></svg>
          {(post.comment_count || 0) > 0 && <span className="trip-act-n">{post.comment_count}</span>}
        </button>
        <ShareLinkButton path="/feed" />
      </div>
      {open && <div className="trip-card-comments"><PlaceComments kind="post" placeId={post.id} /></div>}
    </div>
  );
}
