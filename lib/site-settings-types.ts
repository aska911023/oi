// Client 安全的型別與預設值(不 import 任何 server-only 模組)

export type FontChoice = "serif" | "sans";
export type AlignChoice = "left" | "center" | "right";
export type BlockType = "heading" | "text" | "image" | "carousel" | "button" | "spacer" | "split" | "embeds";

export interface Block {
  id: string;
  type: BlockType;
  text?: string;
  image?: string;
  images?: string[];
  embeds?: string[]; // 影音 / IG 牆:YouTube / IG / TikTok 連結清單
  href?: string;
  height?: number;
  color?: string;
  font?: FontChoice;
  size?: number;
  align?: AlignChoice;
  width?: number;
  nowrap?: boolean;
}

export type HeroLayout = "stack" | "split" | "banner";

export interface SiteSettings {
  color_primary: string;
  color_accent: string;
  bg_color: string;
  search_hint: string;
  hero_layout: HeroLayout;
  hero_split_ratio: number; // 左文欄佔比 %(20–80),兩邊一致
  logo_image: string;
  logo_size: number;
  contact_email: string;
  contact_line: string;
  contact_phone: string;
  contact_ig: string;
  contact_fb: string;
  brand_philosophy: string;
  share_title: string; // 分享卡標題(og:title)
  share_desc: string;  // 分享卡說明(og:description)
  footer_about: string;
  footer_copyright: string;
  footer_tagline: string;
  about_body: string;
  contact_intro: string;
  comment_banned_words: string; // 行程留言關鍵字過濾(逗號/換行分隔,命中即擋下)
  blocks: Block[];
}

export const DEFAULT_IMG = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=85";

export const DEFAULT_BLOCKS: Block[] = [
  { id: "b1", type: "text", text: "TAIWAN · STAY A LITTLE LONGER", color: "#17635A", font: "sans", size: 12, align: "left" },
  { id: "b2", type: "heading", text: "找一間民宿,住進好風景。", color: "#12201C", font: "serif", size: 44, align: "left" },
  { id: "b3", type: "text", text: "選個地方、挑種步調,出發就這麼簡單。", color: "#5D706A", font: "sans", size: 16, align: "left" },
  { id: "b4", type: "carousel", images: [DEFAULT_IMG], width: 100 },
];

export const DEFAULT_SETTINGS: SiteSettings = {
  color_primary: "#17635A",
  color_accent: "#E5FA00",
  bg_color: "#F6F4EE",
  search_hint: "依每晚起價與最多入住人數篩選;實際房價與空房請向民宿確認。",
  hero_layout: "split",
  hero_split_ratio: 50,
  contact_email: "",
  contact_line: "",
  contact_phone: "",
  contact_ig: "",
  contact_fb: "",
  brand_philosophy: "偶爾出走,找一處喜歡的一宿。我們相信,旅行最美的部分,常常發生在「住下來」之後。",
  share_title: "偶宿 O! · 台灣民宿搜尋",
  share_desc: "彙整全台民宿 —— 宜蘭、花蓮、北海岸的包棟、親子、海景民宿一次搜尋,看房型、價格與周邊景點。不經手訂房,直接帶你聯繫民宿。",
  footer_about: "偶爾出走,找到喜歡的一宿。\n以地區、風格與預算,探索全台民宿。",
  footer_copyright: "© 2026 偶宿數位科技有限公司 · 台灣民宿搜尋平台",
  footer_tagline: "一段旅行,一處喜歡的日常。",
  about_body: "偶宿 O!(O! Stay)相信,旅行最美的部分,常常發生在「住下來」之後——慢下來的早晨、民宿主人隨口的推薦、轉角遇見的小店。\n\n我們把全台的民宿,連同周邊的景點、美食、停車與租車,整理在同一個地方;並提供行程規劃工具,讓你把想去的地方排進每一天,和旅伴一起討論、分享。\n\n我們不經手訂房、不抽佣金——而是把你導回民宿的官方管道(官網 / LINE),讓好客人回到店家手上。\n\n「偶爾出走,找一處喜歡的一宿。」偶宿,是偶爾給自己的一段留白。",
  contact_intro: "有任何問題、合作提案,或想把你的民宿 / 店家上架,歡迎透過以下方式與我們聯絡:",
  comment_banned_words: "",
  logo_image: "",
  logo_size: 42,
  blocks: DEFAULT_BLOCKS,
};
