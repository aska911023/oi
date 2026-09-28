import { createClient } from "./supabase/server";

export interface SiteSettings {
  hero_eyebrow: string;
  hero_title: string;
  hero_subtitle: string;
  hero_caption: string;
  search_hint: string;
  hero_image: string;
  color_primary: string;
  color_accent: string;
  heading_font: "serif" | "sans";
  hero_title_size: number; // px(桌機大標)
}

export const DEFAULT_SETTINGS: SiteSettings = {
  hero_eyebrow: "TAIWAN · STAY A LITTLE LONGER",
  hero_title: "找一間民宿,住進好風景。",
  hero_subtitle: "選個地方、挑種步調,出發就這麼簡單。",
  hero_caption: "留一點時間,給旅行。",
  search_hint: "依每晚起價與最多入住人數篩選;實際房價與空房請向民宿確認。",
  hero_image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=85",
  color_primary: "#17635A",
  color_accent: "#E5FA00",
  heading_font: "serif",
  hero_title_size: 44,
};

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const sb = await createClient();
    const { data } = await sb.from("site_settings").select("*").eq("id", 1).maybeSingle();
    if (data) {
      const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
      for (const [k, v] of Object.entries(data)) {
        if (v !== null && v !== undefined && v !== "" && k in DEFAULT_SETTINGS) merged[k] = v;
      }
      return merged as unknown as SiteSettings;
    }
  } catch {}
  return DEFAULT_SETTINGS;
}
