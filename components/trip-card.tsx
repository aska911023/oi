"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import HeroCarousel from "@/components/hero-carousel";
import SaveTripButton from "@/components/save-trip-button";
import TripLikeButton from "@/components/trip-like-button";
import ShareLinkButton from "@/components/share-link-button";
import TripComments from "@/components/trip-comments";
import Avatar from "@/components/avatar";
import type { Trip } from "@/lib/types";

// IG 貼文式行程卡:頭像+暱稱 → 大圖 → 動作列 → 標題/摘要 → 留言。看別人/看自己共用。
export default function TripCard({ trip: t, manageSlot }: { trip: Trip; manageSlot?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const photos = (t.items || []).map((it) => it.image).filter(Boolean) as string[];
  const author = t.owner_name || "旅人";
  const sub = `${t.days} 天${t.nights ? ` ${t.nights} 夜` : ""}${t.region ? " · " + t.region : ""}`;

  return (
    <article className="ig-post">
      <header className="ig-head">
        {t.owner_id ? (
          <Link href={`/u/${t.owner_id}`} className="ig-headlink">
            <Avatar src={t.owner_avatar} name={author} size={40} />
            <div className="ig-user"><div className="ig-name">{author}</div><div className="ig-sub">{sub}</div></div>
          </Link>
        ) : (
          <>
            <Avatar src={t.owner_avatar} name={author} size={40} />
            <div className="ig-user"><div className="ig-name">{author}</div><div className="ig-sub">{sub}</div></div>
          </>
        )}
        {manageSlot && (
          <div className="ig-menu-wrap">
            <button type="button" className="ig-menu-btn" aria-label="更多" onClick={() => setMenuOpen((o) => !o)}>⋯</button>
            {menuOpen && (
              <>
                <div className="ig-menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="ig-menu" onClick={() => setMenuOpen(false)}>{manageSlot}</div>
              </>
            )}
          </div>
        )}
      </header>

      {photos.length > 0 && (
        <Link href={`/trips/${t.id}`} className="ig-media"><HeroCarousel images={photos} height={430} /></Link>
      )}

      <div className="ig-actions">
        <TripLikeButton tripId={t.id} count={t.like_count || 0} />
        <button className={"trip-act" + (open ? " on" : "")} title="留言" onClick={() => setOpen((o) => !o)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.6L3 21l1.9-5.8A8.5 8.5 0 1 1 21 11.5z" /></svg>
          {(t.comment_count || 0) > 0 && <span className="trip-act-n">{t.comment_count}</span>}
        </button>
        <ShareLinkButton path={`/trips/${t.id}`} tripId={t.id} />
        <span style={{ marginLeft: "auto" }}><SaveTripButton tripId={t.id} /></span>
      </div>

      {(() => {
        const parts: string[] = [];
        if (t.like_count) parts.push(`${t.like_count} 讚`);
        if (t.comment_count) parts.push(`${t.comment_count} 留言`);
        if (t.share_count) parts.push(`${t.share_count} 分享`);
        if (t.save_count) parts.push(`${t.save_count} 收藏`);
        return parts.length > 0 ? <div className="ig-stats">{parts.join(" · ")}</div> : null;
      })()}

      <div className="ig-caption">
        <Link href={`/trips/${t.id}`} className="ig-title">{t.title}</Link>
        {t.summary && <p className="ig-cap-sum" style={{ whiteSpace: "pre-line" }}>{t.summary}</p>}
      </div>
      <div className="ig-tags">
        <span>{t.headcount} 人</span>
        {t.transport && <span>{t.transport}</span>}
        {t.budget != null && <span>每人 NT${t.budget.toLocaleString()}</span>}
        <span>{t.items?.length || 0} 個停靠點</span>
      </div>

      {!open && (t.comment_count || 0) > 0 && (
        <button className="ig-viewc" onClick={() => setOpen(true)}>查看全部 {t.comment_count} 則留言</button>
      )}
      {open && <div className="ig-comments"><TripComments tripId={t.id} compact /></div>}
    </article>
  );
}
