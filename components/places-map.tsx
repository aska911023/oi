"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type MapPoint = { id: string; name: string; lat: number; lng: number; href?: string; kind?: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// 互動地圖(OpenStreetMap + Leaflet,免金鑰)。Leaflet 需 window → 只在 client 動態載入。
export default function PlacesMap({ points, height = 360, zoom }: { points: MapPoint[]; height?: number; zoom?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      const L = (mod as unknown as { default?: typeof import("leaflet") }).default ?? mod;
      if (cancelled || !ref.current) return;
      const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (!pts.length) return;

      map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      for (const p of pts) {
        const icon = L.divIcon({ className: "oi-pin", html: `<span class="oi-pin-dot oi-pin-${p.kind || "default"}"></span>`, iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8] });
        const m = L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(map);
        const body = p.href ? `<a href="${esc(p.href)}" class="oi-pin-link">${esc(p.name)}</a>` : esc(p.name);
        m.bindPopup(body, { closeButton: true });
      }

      if (pts.length === 1) {
        map.setView([pts[0].lat, pts[0].lng], zoom || 15);
      } else {
        map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng])).pad(0.18));
      }
      // 容器初次渲染可能尺寸未定,補一次尺寸校正
      setTimeout(() => map && map.invalidateSize(), 120);
    })();

    return () => { cancelled = true; if (map) map.remove(); };
  }, [points, zoom]);

  const hasPts = points.some((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!hasPts) return null;
  return <div ref={ref} className="oi-map" style={{ height }} aria-label="地圖" />;
}
