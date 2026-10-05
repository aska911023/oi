"use client";

import { useEffect, useState } from "react";
import { priceLabel } from "@/lib/data";
import ImageZoom from "@/components/image-zoom";
import PhotoCarousel from "@/components/photo-carousel";
import SaveBookmark from "@/components/save-bookmark";
import type { RoomType } from "@/lib/types";

const toImgs = (image?: string, images?: string[]) => (images && images.length ? images : image ? [image] : []);
const periodsOf = (r: RoomType) => {
  const pr = r.pricing || {};
  return ([["平日", pr.weekday], ["旺季平日", pr.peak_weekday], ["小假日", pr.minor_holiday], ["假日", pr.holiday], ["定價", pr.rack]] as [string, number | null | undefined][])
    .filter(([, v]) => v != null) as [string, number][];
};

export default function RoomList({ rooms }: { rooms: RoomType[] }) {
  const [active, setActive] = useState<RoomType | null>(null);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActive(null); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [active]);

  const extraLine = (r: RoomType) => {
    const pr = r.pricing || {};
    if (pr.extra_weekday == null && pr.extra_holiday == null) return null;
    return (
      <div className="room-extra">加人{pr.extra_weekday != null ? ` 平日 ${priceLabel(pr.extra_weekday)}/人` : ""}{pr.extra_holiday != null ? `${pr.extra_weekday != null ? " ·" : ""} 假日 ${priceLabel(pr.extra_holiday)}/人` : ""}</div>
    );
  };

  return (
    <>
      <div className="room-list" style={{ borderTop: "none", paddingTop: 0 }}>
        {rooms.map((r) => {
          const whole = r.kind === "whole";
          const imgs = toImgs(r.image, r.images);
          return (
            <div className="room-row clickable" key={r.id} role="button" tabIndex={0}
              onClick={() => setActive(r)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(r); } }}>
              {imgs.length > 0 && <div className="room-thumb-c"><PhotoCarousel images={imgs} dots={false} arrows={false} /></div>}
              <div className="room-main">
                <div className="room-name">{whole && <span className="room-kind">包棟</span>}{r.name}<span className="room-more">看更多 ›</span></div>
                {r.description && <div className="room-desc">{r.description}</div>}
                {whole && r.includes_note && <div className="room-desc">🛏 {r.includes_note}</div>}
                <div className="room-tags">
                  <span>可住 {r.capacity} 人</span>
                  {r.beds && <span>{r.beds}</span>}
                  {(r.tags || []).map((t) => <span key={t}>{t}</span>)}
                </div>
                {whole && periodsOf(r).length > 0 && (
                  <div className="room-price-table">
                    {periodsOf(r).map(([lab, v]) => <div key={lab} className="rpt-cell"><span>{lab}</span><b>{priceLabel(v)}</b></div>)}
                  </div>
                )}
                {extraLine(r)}
              </div>
              <div className="room-price-col">
                <div className="room-price">{priceLabel(r.price)}<small>/{whole ? "晚起" : "晚"}</small></div>
                {r.rooms_total != null && <span className="room-stock">共 {r.rooms_total} {whole ? "組" : "間"}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {active && (
        <>
          <div className="overlay" onClick={() => setActive(null)} />
          <div className="detail" role="dialog" aria-modal="true">
            <button className="close" onClick={() => setActive(null)} aria-label="關閉">✕</button>
            {toImgs(active.image, active.images).length > 0
              ? <div className="detail-imgwrap"><ImageZoom images={toImgs(active.image, active.images)} alt={active.name} imgClassName="detail-img" /><SaveBookmark type="room" id={active.id} floating nextPath={`/stay/${active.stay_id}`} /></div>
              : <div className="detail-img photo-ph" />}
            <div className="detail-body">
              <div className="card-eyebrow">{active.kind === "whole" ? "包棟方案" : "房型"}</div>
              <h2>{active.name}</h2>
              {active.description && <p>{active.description}</p>}
              {active.kind === "whole" && active.includes_note && <p style={{ color: "var(--text-2)" }}>🛏 {active.includes_note}</p>}

              <div className="m-amenities" style={{ marginTop: 6 }}>
                <span className="am-chip">可住 {active.capacity} 人</span>
                {active.beds && <span className="am-chip">{active.beds}</span>}
                {active.rooms_total != null && <span className="am-chip">共 {active.rooms_total} {active.kind === "whole" ? "組" : "間"}</span>}
                {(active.tags || []).map((t) => <span key={t} className="am-chip">{t}</span>)}
              </div>

              {active.kind === "whole" && periodsOf(active).length > 0 ? (
                <div className="room-price-table" style={{ marginTop: 14 }}>
                  {periodsOf(active).map(([lab, v]) => <div key={lab} className="rpt-cell"><span>{lab}</span><b>{priceLabel(v)}</b></div>)}
                </div>
              ) : (
                <div className="room-price" style={{ marginTop: 14, fontSize: 24 }}>{priceLabel(active.price)}<small>/{active.kind === "whole" ? "晚起" : "晚"}</small></div>
              )}
              {extraLine(active)}

              <div className="notice">實際房價與空房,請向民宿確認。</div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
