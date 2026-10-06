import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TripLikeButton from "@/components/trip-like-button";
import ShareLinkButton from "@/components/share-link-button";
import SaveTripButton from "@/components/save-trip-button";
import TripComments from "@/components/trip-comments";
import MediaEmbed from "@/components/media-embed";
import { TRIP_ITEM_LABEL, type Trip, type TripItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TripDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data } = await sb.from("trips").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const trip = data as Trip;

  const { data: { user } } = await sb.auth.getUser();
  const isOwner = !!user && trip.owner_id === user.id;
  const { count: likeCount } = await sb.from("trip_likes").select("*", { count: "exact", head: true }).eq("trip_id", id);
  const dayList = Array.from({ length: trip.days }, (_, i) => i + 1);
  const itemsOfDay = (d: number) => (trip.items || []).filter((it: TripItem) => it.day === d);

  return (
      <main className="shell" style={{ paddingTop: 100, paddingBottom: 60, maxWidth: 780 }}>
        <Link href="/trips" className="lnk">← 回行程分享牆</Link>
        <div className="trip-view">
          <div className="trip-view-head">
            <div className="trip-view-headmain">
              <h1 className="serif">{trip.title}</h1>
              <p className="trip-view-meta">
                {trip.days} 天{trip.nights ? ` ${trip.nights} 夜` : ""} · {trip.headcount} 人{trip.transport ? ` · ${trip.transport}` : ""}
                {trip.budget != null ? ` · 每人 NT$${trip.budget.toLocaleString()}` : ""}{trip.region ? ` · ${trip.region}` : ""}
              </p>
            </div>
            <Link href={`/plan?load=${trip.id}`} className="btn btn-primary trip-view-cta">{isOwner ? "編輯這個行程" : "複製為我的行程規劃"}</Link>
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

          <TripComments tripId={trip.id} />
        </div>
      </main>
  );
}
