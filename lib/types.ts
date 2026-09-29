// 偶宿 O! — 型別

export type StayCategory =
  | "海景度假"
  | "山林小屋"
  | "設計旅宿"
  | "親子友善"
  | "寵物友善"
  | "包棟民宿";

export interface Stay {
  id: string;
  name: string;
  region: string; // 縣市
  town: string; // 鄉鎮市區
  category: StayCategory;
  price: number; // 每晚起價 TWD
  guests: number; // 最多入住人數
  image: string;
  description: string;
  amenities: string; // 「、」分隔
  website: string; // 導流連結,空字串代表無
  rooms_left?: number | null; // 剩餘房數(null = 未設定,不顯示)
  published: boolean;
  sample: boolean;
  featured?: boolean; // 贊助置頂
}

export type SortMode = "default" | "low" | "high";

// 二級分類:探索景點 / 探索美食 / 停車區域
export type PoiKind = "attraction" | "food" | "parking";

export interface Poi {
  id: string;
  kind: PoiKind;
  name: string;
  region: string;
  town: string;
  address: string;
  description: string;
  image: string;
  website: string;
  lat?: number | null;
  lng?: number | null;
  published: boolean;
  featured?: boolean;
}

export const POI_KINDS: { kind: PoiKind; label: string; slug: string }[] = [
  { kind: "attraction", label: "探索景點", slug: "attraction" },
  { kind: "food", label: "探索美食", slug: "food" },
  { kind: "parking", label: "停車區域", slug: "parking" },
];

// ⑤ 行程規劃 / ⑥ 分享平台
export type TripItemType = "stay" | "attraction" | "food" | "parking" | "note";

export interface TripItem {
  id: string;
  day: number; // 第幾天(1-based)
  time?: string; // "09:30"
  type: TripItemType;
  refId?: string; // 對應 stays/pois id(自訂項為空)
  name: string;
  note?: string;
}

export interface Trip {
  id: string;
  owner_id?: string | null;
  title: string;
  days: number;
  headcount: number;
  budget?: number | null;
  transport?: string | null;
  region?: string | null;
  summary?: string | null;
  items: TripItem[];
  is_public: boolean;
  share_slug?: string | null;
  created_at?: string;
}

export const TRANSPORTS = ["開車", "機車", "大眾運輸", "其他"] as const;

export const TRIP_ITEM_LABEL: Record<TripItemType, string> = {
  stay: "住宿", attraction: "景點", food: "美食", parking: "停車", note: "自訂",
};
