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
  | { key: string; label: string; type: "tags"; options: string[] }
  | { key: string; label: string; type: "list"; cols: { key: string; label: string }[] }
  | { key: string; label: string; type: "weekhours" };

// 每週各日營業時間(每天可不同、可休息)
export const WEEKDAYS = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"] as const;
export interface WeekHour { day: string; closed?: boolean; open?: string; close?: string; }

export const DETAILS: Record<PoiKind, DetailField[]> = {
  attraction: [
    { key: "tags", label: "類型 / 主題", type: "tags", options: ["離島", "海邊", "山林", "農場", "動物農場", "國家公園", "博物館", "遊樂園", "漁港", "老街", "溫泉", "DIY體驗", "衝浪", "坐船"] },
    { key: "ticket", label: "門票", type: "text" },
    { key: "hours", label: "開放時間", type: "text" },
    { key: "stay_time", label: "建議停留", type: "text" },
    { key: "events", label: "活動", type: "list", cols: [{ key: "title", label: "標題" }, { key: "note", label: "說明" }] },
  ],
  food: [
    { key: "tags", label: "類型", type: "tags", options: ["網紅推薦", "合作店家", "在地小吃", "餐廳", "咖啡廳", "甜點", "伴手禮", "夜市", "早午餐", "燒烤"] },
    { key: "price_level", label: "價位 / 均消", type: "text" },
    { key: "week_hours", label: "營業時間(每天可不同)", type: "weekhours" },
    { key: "booking_phone", label: "訂位電話", type: "text" },
    { key: "menu_pdf", label: "菜單(PDF)", type: "pdf" },
    { key: "events", label: "活動 / 優惠", type: "list", cols: [{ key: "title", label: "標題" }, { key: "note", label: "說明" }] },
  ],
  parking: [
    { key: "tags", label: "可停車種", type: "tags", options: ["汽車", "機車", "重機", "室內", "平面", "立體", "有充電"] },
    { key: "lot_type", label: "類型(地下/平面/立體)", type: "text" },
    { key: "spaces", label: "車位數", type: "text" },
    { key: "charging", label: "充電(無 / 幾支)", type: "text" },
    { key: "height_limit", label: "限高", type: "text" },
    { key: "fee", label: "收費方式", type: "text" },
    { key: "week_hours", label: "營業時間(每天可不同)", type: "weekhours" },
  ],
};

// 去掉 PostgREST .or() 會誤判的字元
export const safeKw = (kw: string) => kw.replace(/[,()%*]/g, " ").trim();
