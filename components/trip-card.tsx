"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import HeroCarousel from "@/components/hero-carousel";
import SaveTripButton from "@/components/save-trip-button";
import TripLikeButton from "@/components/trip-like-button";
import ShareLinkButton from "@/components/share-link-button";
import TripComments from "@/components/trip-comments";
import type { Trip } from "@/lib/types";

// IG 風格行程卡:看別人(/trips)與看自己(/me/trips)共用。manageSlot 傳入自己行程的管理按鈕。
export default function TripCard({ trip: t, manageSlot }: { trip: Trip; manageSlot?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const photos = (t.items || []).map((it) => it.image).filter(Boolean) as string[];

  return (
    <div className="trip-card">
      <Link href={`/trips/${t.id}`} className="trip-card-link">
        {photos.length > 0 && <div className="trip-photos"><HeroCarousel images={photos} height={160} /></div>}
        <div className="trip-card-top">
          <h3>{t.title}</h3>
          <span className="trip-days">{t.days} 天{t.nights ? ` ${t.nights} 夜` : ""}</span>
        </div>
        {t.owner_name && <div className="trip-by">by {t.owner_name}</div>}
        {t.summary && <p className="trip-sum">{t.summary}</p>}
        <div className="trip-tags">
          <span>{t.headcount} 人</span>
          {t.transport && <span>{t.transport}</span>}
          {t.budget != null && <span>每人 NT${t.budget.toLocaleString()}</span>}
          {t.region && <span>{t.region}</span>}
          <span>{t.items?.length || 0} 個停靠點</span>
        </div>
      </Link>
      <div className="trip-actions">
        <TripLikeButton tripId={t.id} count={t.like_count || 0} />
        <button className={"trip-act" + (open ? " on" : "")} title="留言" onClick={() => setOpen((o) => !o)}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.6L3 21l1.9-5.8A8.5 8.5 0 1 1 21 11.5z" /></svg>
          {(t.comment_count || 0) > 0 && <span className="trip-act-n">{t.comment_count}</span>}
        </button>
        <ShareLinkButton path={`/trips/${t.id}`} />
        <span style={{ marginLeft: "auto" }}><SaveTripButton tripId={t.id} /></span>
      </div>
      {open && <div className="trip-card-comments"><TripComments tripId={t.id} compact /></div>}
      {manageSlot && <div className="trip-manage">{manageSlot}</div>}
    </div>
  );
}
