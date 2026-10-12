"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Map as LMap, Marker } from "leaflet";

export type MapPoint = { id: string; name: string; lat: number; lng: number; href?: string; kind?: string };

const KIND_LABEL: Record<string, string> = { hotel: "🟠 住宿", stay: "🟠 住宿", attraction: "🟢 景點", food: "🔴 美食", parking: "🔵 停車" };
const KIND_ORDER = ["hotel", "stay", "attraction", "food", "parking"];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const pinHtml = (kind?: string, hi = false) => `<span class="oi-pin-dot oi-pin-${kind || "default"}${hi ? " hi" : ""}"></span>`;
const finite = (p: MapPoint) => Number.isFinite(p.lat) && Number.isFinite(p.lng);

/* 自訂控制:我的位置 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addLocate(L: any, map: any) {
  const Ctl = L.Control.extend({
    onAdd() {
      const b = L.DomUtil.create("button", "oi-mapbtn");
      b.type = "button"; b.title = "我的位置"; b.innerHTML = "📍";
      L.DomEvent.on(b, "click", (e: Event) => {
        L.DomEvent.stop(e);
        if (!navigator.geolocation) { alert("此裝置不支援定位"); return; }
        b.innerHTML = "⏳";
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            b.innerHTML = "📍";
            const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude];
            if (map._meMarker) map._meMarker.setLatLng(ll);
            else map._meMarker = L.marker(ll, { icon: L.divIcon({ className: "oi-pin", html: '<span class="oi-pin-dot oi-pin-me"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }), title: "我的位置", zIndexOffset: 1200 }).addTo(map);
            map.setView(ll, Math.max(map.getZoom(), 14));
          },
          () => { b.innerHTML = "📍"; alert("無法取得定位,請允許定位權限"); },
          { enableHighAccuracy: true, timeout: 8000 },
        );
      });
      return b;
    },
  });
  new Ctl({ position: "topleft" }).addTo(map);
}

/* 自訂控制:全螢幕 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addFullscreen(L: any, map: any, el: HTMLElement) {
  const Ctl = L.Control.extend({
    onAdd() {
      const b = L.DomUtil.create("button", "oi-mapbtn");
      b.type = "button"; b.title = "全螢幕"; b.innerHTML = "⛶";
      L.DomEvent.on(b, "click", (e: Event) => {
        L.DomEvent.stop(e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = document as any;
        if (d.fullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else ((el as any).requestFullscreen || (el as any).webkitRequestFullscreen)?.call(el);
        setTimeout(() => map.invalidateSize(), 250);
      });
      return b;
    },
  });
  new Ctl({ position: "topleft" }).addTo(map);
}

// 互動地圖(OpenStreetMap + Leaflet,免金鑰)。
// highlightId:「左列表右地圖」hover 聯動(有傳=不聚合)。多點位自動聚合 + 分類開關 + 定位 + 底圖 + 全螢幕。
export default function PlacesMap({ points, height = 360, zoom, highlightId, cluster }:
  { points: MapPoint[]; height?: number; zoom?: number; highlightId?: string | null; cluster?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<string, { marker: Marker; kind?: string }>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);

  useEffect(() => {
    let map: LMap | null = null;
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L: any = (mod as any).default ?? mod;
      LRef.current = L;
      if (cancelled || !ref.current) return;
      const pts = points.filter(finite);
      if (!pts.length) return;

      const multi = pts.length > 1;
      const useCluster = cluster ?? (pts.length > 25 && highlightId === undefined);
      if (useCluster) { try { await import("leaflet.markercluster"); } catch { /* 無套件則退回一般標記 */ } }
      if (cancelled || !ref.current) return;

      map = L.map(ref.current, { scrollWheelZoom: true, attributionControl: true });

      // 底圖(免金鑰)
      const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 });
      const clean = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { attribution: "© OpenStreetMap, © CARTO", subdomains: "abcd", maxZoom: 20 });
      const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { attribution: "© OpenTopoMap (CC-BY-SA)", maxZoom: 17 });
      osm.addTo(map!);

      markersRef.current = {};
      const makeMarker = (p: MapPoint) => {
        const icon = L.divIcon({ className: "oi-pin", html: pinHtml(p.kind), iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8] });
        const m = L.marker([p.lat, p.lng], { icon, title: p.name });
        m.bindPopup(p.href ? `<a href="${esc(p.href)}" class="oi-pin-link">${esc(p.name)}</a>` : esc(p.name), { closeButton: true });
        markersRef.current[p.id] = { marker: m, kind: p.kind };
        return m;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const overlays: Record<string, any> = {};
      if (useCluster && L.markerClusterGroup) {
        const byKind: Record<string, MapPoint[]> = {};
        for (const p of pts) (byKind[p.kind || "default"] ||= []).push(p);
        const kinds = [...KIND_ORDER.filter((k) => byKind[k]), ...Object.keys(byKind).filter((k) => !KIND_ORDER.includes(k))];
        for (const k of kinds) {
          const grp = L.markerClusterGroup({ maxClusterRadius: 48, showCoverageOnHover: false, spiderfyOnMaxZoom: true, chunkedLoading: true });
          byKind[k].forEach((p) => grp.addLayer(makeMarker(p)));
          grp.addTo(map!);
          overlays[KIND_LABEL[k] || k] = grp;
        }
      } else {
        for (const p of pts) makeMarker(p).addTo(map!);
      }

      if (multi) {
        L.control.layers({ "標準": osm, "簡潔": clean, "地形": topo },
          Object.keys(overlays).length ? overlays : undefined,
          { collapsed: true, position: "topright" }).addTo(map!);
        addLocate(L, map!);
        addFullscreen(L, map!, ref.current);
      }

      if (pts.length === 1) map!.setView([pts[0].lat, pts[0].lng], zoom || 15);
      else map!.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng])).pad(0.18));
      setTimeout(() => map && map.invalidateSize(), 120);
    })();

    return () => { cancelled = true; if (map) map.remove(); markersRef.current = {}; };
    // highlightId 僅決定是否聚合(對每個用途固定),不放進 deps 以免 hover 時重建整張圖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, zoom, cluster]);

  // 高亮(hover 聯動):只換被指到的標記圖示,不重建整張圖(聚合模式無 highlightId,不受影響)
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

  const hasPts = points.some(finite);
  if (!hasPts) return null;
  return <div ref={ref} className="oi-map" style={{ height }} aria-label="地圖" />;
}
