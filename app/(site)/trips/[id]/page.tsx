import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
  const dayList = Array.from({ length: trip.days }, (_, i) => i + 1);
  const itemsOfDay = (d: number) => (trip.items || []).filter((it: TripItem) => it.day === d);

  return (
      <main className="shell" style={{ paddingTop: 100, paddingBottom: 60, maxWidth: 780 }}>
        <Link href="/trips" className="lnk">← 回行程分享牆</Link>
        <div className="trip-view">
          <h1 className="serif">{trip.title}</h1>
          <p className="trip-view-meta">
            {trip.days} 天 · {trip.headcount} 人{trip.transport ? ` · ${trip.transport}` : ""}
            {trip.budget != null ? ` · 每人 NT$${trip.budget.toLocaleString()}` : ""}{trip.region ? ` · ${trip.region}` : ""}
          </p>
          {trip.summary && <p className="trip-view-sum">{trip.summary}</p>}

          <div className="trip-view-actions">
            <Link href={`/plan?load=${trip.id}`} className="btn btn-primary">{isOwner ? "編輯這個行程" : "複製為我的行程規劃"}</Link>
          </div>

          {dayList.map((d) => (
            <div className="tv-day" key={d}>
              <h2>Day {d}</h2>
              {itemsOfDay(d).length === 0 ? <p className="tv-empty">(未安排)</p> : (
                <ul>
                  {itemsOfDay(d).map((it) => (
                    <li key={it.id}>
                      <span className="tv-time">{it.time || "—"}</span>
                      <span className={"ti-type ti-" + it.type}>{TRIP_ITEM_LABEL[it.type]}</span>
                      <span className="tv-name">{it.name}</span>
                      {it.note && <span className="tv-note">— {it.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </main>
  );
}
