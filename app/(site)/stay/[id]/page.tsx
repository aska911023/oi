import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { priceLabel } from "@/lib/data";
import type { Stay, RoomType } from "@/lib/types";

export const dynamic = "force-dynamic";

const OUT = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8" /></svg>;

export default async function StayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: stay } = await sb.from("stays").select("*").eq("id", id).maybeSingle();
  if (!stay) notFound();
  const s = stay as Stay;
  const { data: roomsData } = await sb.from("room_types").select("*").eq("stay_id", id).eq("published", true).order("sort").order("price");
  const rooms = (roomsData as RoomType[]) || [];
  const amenities = (s.amenities || "").split("、").map((a) => a.trim()).filter(Boolean);

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70, maxWidth: 860 }}>
      <Link href="/" className="lnk">← 回探索</Link>

      <div className="shop">
        {s.image && <img className="shop-hero" src={s.image} alt={s.name} />}
        <div className="card-eyebrow" style={{ marginTop: 18 }}>{s.region} · {s.town}<span className="dot" />{s.category}</div>
        <h1 className="serif shop-title">{s.name}</h1>
        {s.description && <p className="shop-desc">{s.description}</p>}

        {s.website && (
          <div className="detail-actions" style={{ margin: "16px 0 4px" }}>
            <a className="btn btn-primary" href={s.website} target="_blank" rel="noopener noreferrer">前往預訂 / 民宿官網 {OUT}</a>
          </div>
        )}

        {amenities.length > 0 && (
          <div className="shop-block">
            <h2 className="serif shop-h">設施 / 服務</h2>
            <div className="m-amenities">{amenities.map((a) => <span key={a} className="am-chip">{a}</span>)}</div>
          </div>
        )}

        <div className="shop-block">
          <h2 className="serif shop-h">房型 <span className="count">{rooms.length}</span></h2>
          {rooms.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>這間目前尚未提供房型資訊。</p>
          ) : (
            <div className="room-list" style={{ borderTop: "none", paddingTop: 0 }}>
              {rooms.map((r) => (
                <div className="room-row" key={r.id}>
                  {r.image && <img className="room-thumb" src={r.image} alt="" />}
                  <div className="room-main">
                    <div className="room-name">{r.name}</div>
                    {r.description && <div className="room-desc">{r.description}</div>}
                    <div className="room-tags">
                      <span>可住 {r.capacity} 人</span>
                      {r.beds && <span>{r.beds}</span>}
                      {r.rooms_left != null && <span className={r.rooms_left <= 1 ? "room-left low" : "room-left"}>剩 {r.rooms_left} 間</span>}
                    </div>
                  </div>
                  <div className="room-price">{priceLabel(r.price)}<small>/晚</small></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="notice">房價與空房為參考;實際訂房、加購與活動請透過上方民宿官方管道確認。</div>
      </div>
    </main>
  );
}
