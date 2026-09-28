// Client 安全的型別與預設值(不 import 任何 server-only 模組)

export type FontChoice = "serif" | "sans";
export type AlignChoice = "left" | "center" | "right";
export type BlockType = "heading" | "text" | "image" | "carousel" | "button" | "spacer" | "split";

export interface Block {
  id: string;
  type: BlockType;
  text?: string;
  image?: string;
  images?: string[];
  href?: string;
  height?: number;
  color?: string;
  font?: FontChoice;
  size?: number;
  align?: AlignChoice;
  width?: number;
  nowrap?: boolean;
}

export type HeroLayout = "stack" | "split";

export interface SiteSettings {
  color_primary: string;
  color_accent: string;
  bg_color: string;
  search_hint: string;
  hero_layout: HeroLayout;
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
  blocks: DEFAULT_BLOCKS,
};
