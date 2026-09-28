import { createClient } from "./supabase/server";

export type FontChoice = "serif" | "sans";
export type AlignChoice = "left" | "center" | "right";
export interface ElStyle { color: string; font: FontChoice; size: number; align: AlignChoice; }

export interface HeroStyles { eyebrow: ElStyle; title: ElStyle; subtitle: ElStyle; }

export interface SiteSettings {
  hero_eyebrow: string;
  hero_title: string;
  hero_subtitle: string;
  hero_caption: string;
  search_hint: string;
  hero_images: string[];
  color_primary: string;
  color_accent: string;
  hero_styles: HeroStyles;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  hero_eyebrow: "TAIWAN · STAY A LITTLE LONGER",
  hero_title: "找一間民宿,住進好風景。",
  hero_subtitle: "選個地方、挑種步調,出發就這麼簡單。",
  hero_caption: "留一點時間,給旅行。",
  search_hint: "依每晚起價與最多入住人數篩選;實際房價與空房請向民宿確認。",
  hero_images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=85"],
  color_primary: "#17635A",
  color_accent: "#E5FA00",
  hero_styles: {
    eyebrow: { color: "#17635A", font: "sans", size: 12, align: "left" },
    title: { color: "#12201C", font: "serif", size: 44, align: "left" },
    subtitle: { color: "#5D706A", font: "sans", size: 16, align: "left" },
  },
};

function mergeEl(base: ElStyle, override: unknown): ElStyle {
  if (!override || typeof override !== "object") return base;
  const o = override as Partial<ElStyle>;
  return {
    color: typeof o.color === "string" ? o.color : base.color,
    font: o.font === "serif" || o.font === "sans" ? o.font : base.font,
    size: typeof o.size === "number" ? o.size : base.size,
    align: o.align === "left" || o.align === "center" || o.align === "right" ? o.align : base.align,
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const sb = await createClient();
    const { data } = await sb.from("site_settings").select("*").eq("id", 1).maybeSingle();
    if (data) {
      const d = data as Record<string, unknown>;
      const s: SiteSettings = { ...DEFAULT_SETTINGS, hero_styles: { ...DEFAULT_SETTINGS.hero_styles } };
      for (const k of ["hero_eyebrow", "hero_title", "hero_subtitle", "hero_caption", "search_hint", "color_primary", "color_accent"] as const) {
        if (d[k]) (s as unknown as Record<string, unknown>)[k] = d[k];
      }
      if (Array.isArray(d.hero_images) && d.hero_images.length) s.hero_images = d.hero_images as string[];
      else if (typeof d.hero_image === "string" && d.hero_image) s.hero_images = [d.hero_image];
      if (d.hero_styles && typeof d.hero_styles === "object") {
        const hs = d.hero_styles as Record<string, unknown>;
        s.hero_styles = {
          eyebrow: mergeEl(DEFAULT_SETTINGS.hero_styles.eyebrow, hs.eyebrow),
          title: mergeEl(DEFAULT_SETTINGS.hero_styles.title, hs.title),
          subtitle: mergeEl(DEFAULT_SETTINGS.hero_styles.subtitle, hs.subtitle),
        };
      }
      return s;
    }
  } catch {}
  return DEFAULT_SETTINGS;
}
