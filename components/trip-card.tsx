"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import HeroCarousel from "@/components/hero-carousel";
import MediaEmbed from "@/components/media-embed";
import SaveTripButton from "@/components/save-trip-button";
import TripLikeButton from "@/components/trip-like-button";
import ShareLinkButton from "@/components/share-link-button";
import TripComments from "@/components/trip-comments";
import Avatar from "@/components/avatar";
import type { Trip } from "@/lib/types";

// IG 貼文式行程卡:頭像+暱稱 → 大圖 → 動作列 → 標題/摘要 → 留言。看別人/看自己共用。
export default function TripCard({ trip: t, manageSlot, viewerId }: { trip: Trip; manageSlot?: ReactNode; viewerId?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [pub, setPub] = useState(!!t.is_public);
  const photos = (t.items || []).map((it) => it.image).filter(Boolean) as string[];
  const isMedia = t.kind === "media";
  const embedUrl = (t.embed_urls || [])[0];
  const to = `/trips/${t.slug || t.id}`; // 帶標題的網址(分享好看 + SEO)
  const isOwner = !!viewerId && viewerId === t.owner_id;

  // 作者自己的貼文:到哪都給 ⋯ 管理選單(公開切換/複製連結/刪除;行程才有編輯)
  async function ownerToggle() {
    const sb = createClient();
    await sb.from("trips").update({ is_public: !pub }).eq("id", t.id);
    setPub((p) => !p);
    router.refresh();
  }
  async function ownerCopy() {
    const url = `${window.location.origin}${to}`;
    try { await navigator.clipboard.writeText(url); alert("已複製分享連結:\n" + url); }
    catch { prompt("複製這個連結分享:", url); }
  }
  async function ownerRemove() {
    if (!confirm(`確定刪除「${t.title}」?此動作無法復原。`)) return;
    const sb = createClient();
    const { error } = await sb.from("trips").delete().eq("id", t.id);
    if (error) { alert("刪除失敗:" + error.message); return; }
    setRemoved(true);
    router.refresh();
  }
  const ownerMenu = (
    <>
      {pub ? <span className="pill live">公開</span> : <span className="pill draft">私人</span>}
      {!isMedia && <Link className="lnk" href={`/plan?load=${t.id}`}>編輯</Link>}
      <button className="lnk" onClick={ownerToggle}>{pub ? "取消公開" : "公開"}</button>
      {pub && <button className="lnk" onClick={ownerCopy}>複製連結</button>}
      <button className="lnk danger" onClick={ownerRemove}>刪除</button>
    </>
  );
  const slot = manageSlot ?? (isOwner ? ownerMenu : null);
  if (removed) return null;

  // 整張卡片可點進行程;但按到互動元素(連結/按鈕/輸入框/留言區/影音)時不導航,交給它們自己處理。
  function cardClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("a, button, input, textarea, iframe, .ig-comments, .ig-menu, .ig-media-embed")) return;
    router.push(to);
  }
  const author = t.owner_name || "旅人";
  const sub = isMedia ? "影音分享" : `${t.days} 天${t.nights ? ` ${t.nights} 夜` : ""}${t.region ? " · " + t.region : ""}`;

  return (
    <article className="ig-post ig-clickable" onClick={cardClick}>
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
        {slot && (
          <div className="ig-menu-wrap">
            <button type="button" className="ig-menu-btn" aria-label="更多" onClick={() => setMenuOpen((o) => !o)}>⋯</button>
            {menuOpen && (
              <>
                <div className="ig-menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="ig-menu" onClick={() => setMenuOpen(false)}>{slot}</div>
              </>
            )}
          </div>
        )}
      </header>

      {isMedia && embedUrl ? (
        <div className="ig-media ig-media-embed"><MediaEmbed url={embedUrl} /></div>
      ) : photos.length > 0 ? (
        <Link href={to} className="ig-media"><HeroCarousel images={photos} height={300} /></Link>
      ) : (
        <Link href={to} className="ig-media ig-media-ph">
          <span>{t.title}</span>
          <small>{t.days} 天{t.nights ? ` ${t.nights} 夜` : ""}{t.region ? ` · ${t.region}` : ""}</small>
        </Link>
      )}

      <div className="ig-actions">
        <TripLikeButton tripId={t.id} count={t.like_count || 0} />
        <button className={"trip-act" + (open ? " on" : "")} title="留言" onClick={() => setOpen((o) => !o)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.6L3 21l1.9-5.8A8.5 8.5 0 1 1 21 11.5z" /></svg>
          {(t.comment_count || 0) > 0 && <span className="trip-act-n">{t.comment_count}</span>}
        </button>
        <ShareLinkButton path={to} tripId={t.id} />
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
        <Link href={to} className="ig-title">{t.title}</Link>
        {t.summary && <p className="ig-cap-sum" style={{ whiteSpace: "pre-line" }}>{t.summary}</p>}
      </div>
      {!isMedia && (
        <div className="ig-tags">
          <span>{t.headcount} 人</span>
          {t.transport && <span>{t.transport}</span>}
          {t.budget != null && <span>每人 NT${t.budget.toLocaleString()}</span>}
          <span>{t.items?.length || 0} 個停靠點</span>
        </div>
      )}

      {!open && (t.comment_count || 0) > 0 && (
        <button className="ig-viewc" onClick={() => setOpen(true)}>查看全部 {t.comment_count} 則留言</button>
      )}
      {open && <div className="ig-comments"><TripComments tripId={t.id} compact policy={t.comment_policy || "all"} ownerId={t.owner_id} /></div>}
    </article>
  );
}
