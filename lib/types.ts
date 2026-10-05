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
  images?: string[]; // 封面相簿(第一張為封面);空則沿用 image
  description: string;
  amenities: string; // 「、」分隔
  website: string; // 導流連結,空字串代表無
  rooms_left?: number | null; // 剩餘房數(null = 未設定,不顯示)
  license_no?: string | null; // 合法民宿登記證號
  check_in?: string | null; // 最早入住(例 15:00)
  check_out?: string | null; // 最晚退房(例 11:00)
  address?: string; // 地址(Google Map / 導航用)
  lat?: number | null;
  lng?: number | null;
  approved?: boolean; // 上架審核通過
  published: boolean;
  sample: boolean;
  featured?: boolean; // 贊助置頂
  ad_tier?: string; // 曝光方案:free / featured / flagship
}

export type SortMode = "default" | "low" | "high";

// 租車店 + 方案
export interface RentalShop {
  id: string;
  name: string;
  region: string;
  town: string;
  address: string;
  phone?: string | null;
  image: string;
  description: string;
  website: string;
  line_url?: string | null;
  lat?: number | null;
  lng?: number | null;
  approved?: boolean;
  published: boolean;
  featured?: boolean;
  tags?: string[]; // 車種/品牌
  price_from?: number; // search_rentals 彙整:最低日租
  units_left?: number; // 方案可租數加總
}

export interface RentalPlan {
  id: string;
  shop_id: string;
  name: string;
  price_per_day: number;
  deposit?: number | null;
  includes: string;
  count_total?: number | null;
  count_left?: number | null;
  image: string;
  description: string;
  sort: number;
  published: boolean;
}

// 前台商品卡:一個房型 + 它所屬民宿(店家)的資訊
export interface RoomCard {
  id: string;
  room_name: string;
  price: number;
  capacity: number;
  rooms_left?: number | null;
  rooms_total?: number | null; // 總房數(前台顯示「共 N 間」)
  beds?: string | null;
  room_desc?: string | null;
  image: string;
  images?: string[]; // 房型相簿;空則退回民宿相簿/封面
  featured?: boolean;
  ad_tier?: string; // 曝光方案(民宿層級)
  tags?: string[];
  stay_id: string;
  stay_name: string;
  region: string;
  town: string;
  category: string;
  amenities: string;
  website: string;
  stay_desc?: string | null;
}

// 房型分時期價格 + 加人費(包棟用;單間可只填平日=price)
export interface RoomPricing {
  weekday?: number | null;       // 平日
  peak_weekday?: number | null;  // 旺季平日
  minor_holiday?: number | null; // 小假日
  holiday?: number | null;       // 假日
  rack?: number | null;          // 定價
  extra_weekday?: number | null; // 加人(平日)/人
  extra_holiday?: number | null; // 加人(假日)/人
}

export type RoomKind = "single" | "whole"; // 獨立單間 / 包棟

// 民宿房型(掛在 stays 下)
export interface RoomType {
  id: string;
  stay_id: string;
  kind?: RoomKind;
  name: string;
  price: number;
  capacity: number;
  rooms_total?: number | null;
  rooms_left?: number | null;
  beds?: string | null;
  amenities: string;
  image: string;
  images?: string[]; // 房型相簿(第一張為封面)
  description: string;
  pricing?: RoomPricing;      // 分時期價格 + 加人費
  includes_note?: string | null; // 包棟包含哪些房間
  sort: number;
  published: boolean;
  featured?: boolean;
  tags?: string[];
}

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

// 景點/美食/停車(三張獨立表共用形狀:base + details jsonb)
export interface Place {
  id: string;
  name: string;
  region: string;
  town: string;
  address: string;
  image: string;
  images?: string[]; // 相簿(第一張為封面)
  description: string;
  website: string;
  lat?: number | null;
  lng?: number | null;
  details: Record<string, unknown>;
  published: boolean;
  featured?: boolean;
}

export const POI_KINDS: { kind: PoiKind; label: string; slug: string }[] = [
  { kind: "attraction", label: "探索景點", slug: "attraction" },
  { kind: "food", label: "探索美食", slug: "food" },
  { kind: "parking", label: "停車區域", slug: "parking" },
];

// ⑤ 行程規劃 / ⑥ 分享平台
export interface Station { id: string; kind: "hsr" | "tra"; name: string; region: string; }

export type TripItemType = "stay" | "attraction" | "food" | "parking" | "rental" | "station" | "note";

export interface TripItem {
  id: string;
  day: number; // 第幾天(1-based)
  time?: string; // "09:30"
  type: TripItemType;
  refId?: string; // 對應 stays/pois id(住宿=民宿 id,連結用;自訂項為空)
  roomId?: string; // 住宿選到的房型 id(收藏比對/去重用)
  name: string;
  note?: string;
  image?: string; // 自行放的照片
  slot?: "day" | "night"; // 白天(景點/美食…)或 晚上(住宿)
}

export interface Trip {
  id: string;
  owner_id?: string | null;
  title: string;
  days: number;
  nights?: number;
  headcount: number;
  budget?: number | null;
  transport?: string | null;
  region?: string | null;
  summary?: string | null;
  items: TripItem[];
  is_public: boolean;
  share_slug?: string | null;
  created_at?: string;
  owner_name?: string | null; // 發布者暱稱(search_trips 帶回)
  like_count?: number;
  comment_count?: number;
}

// 社交貼文牆
export interface Post {
  id: string;
  user_id: string;
  body?: string | null;
  images?: string[];
  created_at: string;
  name?: string | null;      // 作者暱稱(posts_feed 帶回)
  like_count?: number;
  comment_count?: number;
  liked?: boolean;
}

export const TRANSPORTS = ["開車", "機車", "大眾運輸", "其他"] as const;

export const TRIP_ITEM_LABEL: Record<TripItemType, string> = {
  stay: "住宿", attraction: "景點", food: "美食", parking: "停車", rental: "租車", station: "車站", note: "自訂",
};
