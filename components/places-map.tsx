"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, Marker } from "leaflet";

export type MapPoint = { id: string; name: string; lat: number; lng: number; href?: string; kind?: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const pinHtml = (kind?: string, hi = false) => `<span class="oi-pin-dot oi-pin-${kind || "default"}${hi ? " hi" : ""}"></span>`;

// 互動地圖(OpenStreetMap + Leaflet,免金鑰)。highlightId 用於「左列表右地圖」hover 聯動。
export default function PlacesMap({ points, height = 360, zoom, highlightId }: { points: MapPoint[]; height?: number; zoom?: number; highlightId?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<string, { marker: Marker; kind?: string }>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);

  // 建圖 + 標記(只在 points 變動時重建)
  useEffect(() => {
    let map: LMap | null = null;
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      const L = (mod as unknown as { default?: typeof import("leaflet") }).default ?? mod;
      LRef.current = L;
      if (cancelled || !ref.current) return;
      const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (!pts.length) return;

      map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).addTo(map);

      markersRef.current = {};
      for (const p of pts) {
        const icon = L.divIcon({ className: "oi-pin", html: pinHtml(p.kind), iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8] });
        const m = L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(map);
        m.bindPopup(p.href ? `<a href="${esc(p.href)}" class="oi-pin-link">${esc(p.name)}</a>` : esc(p.name), { closeButton: true });
        markersRef.current[p.id] = { marker: m, kind: p.kind };
      }

      if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], zoom || 15);
      else map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng])).pad(0.18));
      setTimeout(() => map && map.invalidateSize(), 120);
    })();

    return () => { cancelled = true; if (map) map.remove(); markersRef.current = {}; };
  }, [points, zoom]);

  // 高亮(hover 聯動):只換被指到的標記圖示,不重建整張圖
  useEffect(() => {
    const L = LRef.current;
    if (!L) return;
    for (const id of Object.keys(markersRef.current)) {
      const entry = markersRef.current[id];
      const hi = id === highlightId;
      entry.marker.setIcon(L.divIcon({ className: "oi-pin", html: pinHtml(entry.kind, hi), iconSize: hi ? [22, 22] : [16, 16], iconAnchor: hi ? [11, 11] : [8, 8], popupAnchor: [0, -10] }));
      entry.marker.setZIndexOffset(hi ? 1000 : 0);
    }
  }, [highlightId]);

  const hasPts = points.some((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!hasPts) return null;
  return <div ref={ref} className="oi-map" style={{ height }} aria-label="地圖" />;
}
