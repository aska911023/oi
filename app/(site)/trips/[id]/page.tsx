import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { sbMaybeRetry } from "@/lib/retry";
import TripLikeButton from "@/components/trip-like-button";
import ShareLinkButton from "@/components/share-link-button";
import SaveTripButton from "@/components/save-trip-button";
import TripComments from "@/components/trip-comments";
import MediaEmbed from "@/components/media-embed";
import { TRIP_ITEM_LABEL, type Trip, type TripItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const sb = await createClient();
  const { data } = await sb.from("trips").select("title, days, nights, region, headcount, summary, is_public").eq("id", id).maybeSingle();
  if (!data) return { title: "找不到行程" };
  const t = data as Partial<Trip>;
  if (!t.is_public) return { title: t.title || "行程", robots: { index: false } }; // 私人行程不收錄
  const meta = `${t.days} 天${t.nights ? ` ${t.nights} 夜` : ""}${t.region ? " · " + t.region : ""} · ${t.headcount} 人`;
  const title = `${t.title}(${meta})`;
  const description = (t.summary || `${meta}的旅遊行程「${t.title}」。在偶宿 O! 看完整每日安排、住宿與景點，一鍵複製成自己的行程。`).slice(0, 150);
  return {
    title, description,
    alternates: { canonical: `/trips/${id}` },
    openGraph: { title, description, url: `/trips/${id}`, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TripDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  // 連線抖動會重試;真的查無才 404
  const data = await sbMaybeRetry<Trip>(() => sb.from("trips").select("*").eq("id", id).maybeSingle(), "trip");
  if (!data) notFound();
  const trip = data as Trip;

  const { data: { user } } = await sb.auth.getUser();
  const isOwner = !!user && trip.owner_id === user.id;
  const { count: likeCount } = await sb.from("trip_likes").select("*", { count: "exact", head: true }).eq("trip_id", id);
  const isMedia = trip.kind === "media";
  const dayList = isMedia ? [] : Array.from({ length: trip.days }, (_, i) => i + 1);
  const itemsOfDay = (d: number) => (trip.items || []).filter((it: TripItem) => it.day === d);

  return (
      <main className="shell" style={{ paddingTop: 100, paddingBottom: 60, maxWidth: 780 }}>
        <Link href="/trips" className="lnk">← 回行程分享牆</Link>
        <div className="trip-view">
          <div className="trip-view-head">
            <div className="trip-view-headmain">
              <h1 className="serif">{trip.title}</h1>
              <p className="trip-view-meta">
                {isMedia ? "影音分享" : (
                  <>
                    {trip.days} 天{trip.nights ? ` ${trip.nights} 夜` : ""} · {trip.headcount} 人{trip.transport ? ` · ${trip.transport}` : ""}
                    {trip.budget != null ? ` · 每人 NT$${trip.budget.toLocaleString()}` : ""}{trip.region ? ` · ${trip.region}` : ""}
                  </>
                )}
              </p>
            </div>
            {!isMedia && <Link href={`/plan?load=${trip.id}`} className="btn btn-primary trip-view-cta">{isOwner ? "編輯這個行程" : "複製為我的行程規劃"}</Link>}
          </div>

          {trip.summary && <p className="trip-view-sum" style={{ whiteSpace: "pre-line" }}>{trip.summary}</p>}

          <div className="trip-view-actions">
            <span className="trip-actions" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
              <TripLikeButton tripId={trip.id} count={likeCount || 0} />
              <ShareLinkButton path={`/trips/${trip.id}`} tripId={trip.id} />
              <SaveTripButton tripId={trip.id} />
            </span>
          </div>

          {trip.embed_urls && trip.embed_urls.length > 0 && (
            <div className="embed-list" style={{ margin: "18px 0" }}>{trip.embed_urls.map((u, i) => <MediaEmbed key={i} url={u} />)}</div>
          )}

          {dayList.map((d) => (
            <div className="tv-day" key={d}>
              <h2>Day {d}</h2>
              {itemsOfDay(d).length === 0 ? <p className="tv-empty">(未安排)</p> : (
                <ul>
                  {itemsOfDay(d).map((it) => (
                    <li key={it.id}>
                      <span className="tv-time">{it.time || "彈性"}</span>
                      <span className={"ti-type ti-" + it.type}>{TRIP_ITEM_LABEL[it.type]}</span>
                      <span className="tv-name">{it.name}</span>
                      {it.note && <span className="tv-note">— {it.note}</span>}
                      {it.image && <img className="tv-img" src={it.image} alt="" />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <TripComments tripId={trip.id} policy={trip.comment_policy || "all"} ownerId={trip.owner_id} />
        </div>
      </main>
  );
}
