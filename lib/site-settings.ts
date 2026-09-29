import { unstable_cache } from "next/cache";
import { createPublicClient } from "./supabase/public";
import { DEFAULT_SETTINGS, type SiteSettings, type Block, type BlockType } from "./site-settings-types";

export * from "./site-settings-types";

const TYPES: BlockType[] = ["heading", "text", "image", "carousel", "button", "spacer", "split"];

function sanitizeBlock(raw: unknown, i: number): Block | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const type = TYPES.includes(b.type as BlockType) ? (b.type as BlockType) : null;
  if (!type) return null;
  return {
    id: typeof b.id === "string" ? b.id : `b${i}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    text: typeof b.text === "string" ? b.text : undefined,
    image: typeof b.image === "string" ? b.image : undefined,
    images: Array.isArray(b.images) ? (b.images as string[]).filter((x) => typeof x === "string") : undefined,
    href: typeof b.href === "string" ? b.href : undefined,
    height: typeof b.height === "number" ? b.height : undefined,
    color: typeof b.color === "string" ? b.color : undefined,
    font: b.font === "serif" || b.font === "sans" ? b.font : undefined,
    size: typeof b.size === "number" ? b.size : undefined,
    align: b.align === "left" || b.align === "center" || b.align === "right" ? b.align : undefined,
    width: typeof b.width === "number" ? b.width : undefined,
    nowrap: typeof b.nowrap === "boolean" ? b.nowrap : undefined,
  };
}

export const getSiteSettings = unstable_cache(async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const sb = createPublicClient();
    const { data } = await sb.from("site_settings").select("*").eq("id", 1).maybeSingle();
    if (data) {
      const d = data as Record<string, unknown>;
      const s: SiteSettings = { ...DEFAULT_SETTINGS };
      if (typeof d.color_primary === "string" && d.color_primary) s.color_primary = d.color_primary;
      if (typeof d.color_accent === "string" && d.color_accent) s.color_accent = d.color_accent;
      if (typeof d.bg_color === "string" && d.bg_color) s.bg_color = d.bg_color;
      if (typeof d.search_hint === "string" && d.search_hint) s.search_hint = d.search_hint;
      if (d.hero_layout === "stack" || d.hero_layout === "split") s.hero_layout = d.hero_layout;
      if (typeof d.hero_split_ratio === "number" && d.hero_split_ratio >= 20 && d.hero_split_ratio <= 80) s.hero_split_ratio = d.hero_split_ratio;
      if (typeof d.logo_image === "string") s.logo_image = d.logo_image;
      if (typeof d.logo_size === "number" && d.logo_size > 0) s.logo_size = d.logo_size;
      if (Array.isArray(d.blocks) && d.blocks.length) {
        const parsed = d.blocks.map(sanitizeBlock).filter(Boolean) as Block[];
        if (parsed.length) s.blocks = parsed;
      }
      return s;
    }
  } catch {}
  return DEFAULT_SETTINGS;
}, ["site-settings"], { tags: ["settings"], revalidate: 300 });
