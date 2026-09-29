// Client 安全:純設定,無任何 server-only import
import type { PoiKind } from "./types";

export const KIND_TABLE: Record<PoiKind, string> = {
  attraction: "attractions",
  food: "restaurants",
  parking: "parking_lots",
};

export type DetailField =
  | { key: string; label: string; type: "text" }
  | { key: string; label: string; type: "pdf" }
  | { key: string; label: string; type: "list"; cols: { key: string; label: string }[] };

export const DETAILS: Record<PoiKind, DetailField[]> = {
  attraction: [
    { key: "ticket", label: "門票", type: "text" },
    { key: "hours", label: "開放時間", type: "text" },
    { key: "stay_time", label: "建議停留", type: "text" },
    { key: "events", label: "活動", type: "list", cols: [{ key: "title", label: "標題" }, { key: "note", label: "說明" }] },
  ],
  food: [
    { key: "price_level", label: "價位 / 均消", type: "text" },
    { key: "hours", label: "營業時間", type: "text" },
    { key: "closed", label: "公休", type: "text" },
    { key: "booking_phone", label: "訂位電話", type: "text" },
    { key: "menu_pdf", label: "菜單(PDF)", type: "pdf" },
    { key: "events", label: "活動 / 優惠", type: "list", cols: [{ key: "title", label: "標題" }, { key: "note", label: "說明" }] },
  ],
  parking: [
    { key: "lot_type", label: "類型(地下/平面/立體)", type: "text" },
    { key: "spaces", label: "車位數", type: "text" },
    { key: "charging", label: "充電(無 / 幾支)", type: "text" },
    { key: "height_limit", label: "限高", type: "text" },
    { key: "fee", label: "收費方式", type: "text" },
    { key: "hours", label: "營業時間", type: "text" },
  ],
};

// 去掉 PostgREST .or() 會誤判的字元
export const safeKw = (kw: string) => kw.replace(/[,()%*]/g, " ").trim();
