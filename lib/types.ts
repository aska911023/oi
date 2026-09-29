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
