import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SaveButton from "@/components/save-button";
import ReviewForm from "@/components/review-form";
import PhotoCarousel from "@/components/photo-carousel";
import RoomList from "@/components/room-list";
import BackLink from "@/components/back-link";
import TrackView from "@/components/track-view";
import OutboundLink from "@/components/outbound-link";
import MediaEmbed from "@/components/media-embed";
import type { Stay, RoomType } from "@/lib/types";

export const dynamic = "force-dynamic";

// 相簿優先,無相簿退回單張 image
const toImgs = (image?: string, images?: string[] | null) => (images && images.length ? images : image ? [image] : []);

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

  // 評價
  const { data: revData } = await sb.from("reviews").select("rating, comment, created_at, profiles(display_name)").eq("stay_id", id).order("created_at", { ascending: false });
  const reviews = (revData || []) as unknown as { rating: number; comment: string; created_at: string; profiles: { display_name: string } | null }[];
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;

  // 附近推薦(同縣市)
  const [na, nf, np, nr] = await Promise.all([
    sb.from("attractions").select("id,name,region,town,image").eq("published", true).eq("region", s.region).limit(4),
    sb.from("restaurants").select("id,name,region,town,image").eq("published", true).eq("region", s.region).limit(4),
    sb.from("parking_lots").select("id,name,region,town,image").eq("published", true).eq("region", s.region).limit(4),
    sb.from("rental_shops").select("id,name,region,town,image").eq("published", true).eq("approved", true).eq("region", s.region).limit(4),
  ]);
  const nearby: { label: string; href: string; items: { id: string; name: string; town?: string }[] }[] = [
    { label: "附近景點", href: "/places/attraction", items: (na.data || []) as { id: string; name: string; town?: string }[] },
    { label: "附近美食", href: "/places/food", items: (nf.data || []) as { id: string; name: string; town?: string }[] },
    { label: "附近停車", href: "/places/parking", items: (np.data || []) as { id: string; name: string; town?: string }[] },
    { label: "附近租車", href: "/rentals", items: (nr.data || []) as { id: string; name: string; town?: string }[] },
  ].filter((g) => g.items.length > 0);

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 70, maxWidth: 860 }}>
      <BackLink fallback="/" label="← 回探索" />

      <div className="shop">
        <TrackView stayId={s.id} />
        {toImgs(s.image, s.images).length > 0 && (
          <div className="shop-hero-c"><PhotoCarousel images={toImgs(s.image, s.images)} alt={s.name} /></div>
        )}
        <div className="card-eyebrow" style={{ marginTop: 18 }}>{s.region} · {s.town}<span className="dot" />{s.category}</div>
        <h1 className="serif shop-title">{s.name}</h1>
        {s.description && <p className="shop-desc">{s.description}</p>}

        {s.address && (
          <div className="card-eyebrow" style={{ textTransform: "none", letterSpacing: 0, fontSize: 14, color: "var(--text-2)", marginTop: 10 }}>📍 {s.address}</div>
        )}
        {(s.check_in || s.check_out) && (
          <div className="card-eyebrow" style={{ textTransform: "none", letterSpacing: 0, fontSize: 14, color: "var(--text-2)", marginTop: 6 }}>
            🕒 {s.check_in ? `入住 ${s.check_in} 後` : ""}{s.check_in && s.check_out ? " · " : ""}{s.check_out ? `退房 ${s.check_out} 前` : ""}
          </div>
        )}
        {s.license_no && (
          <div className="card-eyebrow" style={{ textTransform: "none", letterSpacing: 0, fontSize: 13.5, color: "var(--muted)", marginTop: 6 }}>
            🏛 合法民宿登記證號:{s.license_no}
          </div>
        )}

        <div className="detail-actions" style={{ margin: "16px 0 4px" }}>
          {s.website && <OutboundLink type="click_website" stayId={s.id} href={s.website} utm className="btn btn-primary">前往預訂 / 民宿官網 {OUT}</OutboundLink>}
          {(s.address || (s.lat != null && s.lng != null)) && (
            <OutboundLink type="click_map" stayId={s.id} className="btn btn-ghost"
              href={s.lat != null && s.lng != null
                ? `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((s.name + " " + s.region + s.town + (s.address || "")).trim())}`}>在地圖開啟 {OUT}</OutboundLink>
          )}
          <SaveButton stayId={s.id} />
        </div>

        {s.embed_url && (
          <div className="shop-block">
            <h2 className="serif shop-h">影片介紹 / 網紅推薦</h2>
            <MediaEmbed url={s.embed_url} />
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
            <RoomList rooms={rooms} />
          )}
        </div>

        {/* 評價 */}
        <div className="shop-block">
          <h2 className="serif shop-h">評價 {reviews.length > 0 && <span className="count">★ {avg.toFixed(1)} · {reviews.length} 則</span>}</h2>
          <ReviewForm stayId={s.id} />
          {reviews.length > 0 && (
            <div className="review-list">
              {reviews.map((r, i) => (
                <div className="review-row" key={i}>
                  <div className="review-top">
                    <span className="review-stars">{"★".repeat(r.rating)}<span className="review-off">{"★".repeat(5 - r.rating)}</span></span>
                    <span className="review-name">{r.profiles?.display_name || "旅人"}</span>
                  </div>
                  {r.comment && <p className="review-comment">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 附近推薦 */}
        {nearby.length > 0 && (
          <div className="shop-block">
            <h2 className="serif shop-h">附近推薦</h2>
            {nearby.map((g) => (
              <div className="nearby-group" key={g.label}>
                <div className="nearby-head"><span>{g.label}</span><Link className="lnk" href={g.href}>更多 →</Link></div>
                <div className="nearby-chips">
                  {g.items.map((it) => <Link key={it.id} href={g.href} className="am-chip">{it.name}</Link>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 充電 / 換電 / 加油(導流外部地圖) */}
        <div className="shop-block">
          <h2 className="serif shop-h">附近充電 / 換電 / 加油</h2>
          <div className="detail-actions">
            <a className="btn btn-ghost" target="_blank" rel="noopener noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((s.region + s.town + " 電動車充電站").trim())}`}>⚡ 找附近充電站</a>
            <a className="btn btn-ghost" target="_blank" rel="noopener noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((s.region + s.town + " Gogoro 換電站").trim())}`}>🔋 找附近換電站(Gogoro)</a>
            <a className="btn btn-ghost" target="_blank" rel="noopener noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((s.region + s.town + " 加油站").trim())}`}>⛽ 找附近加油站</a>
          </div>
        </div>

        <div className="notice">房價與空房為參考;實際訂房、加購與活動請透過上方民宿官方管道確認。</div>
      </div>
    </main>
  );
}
