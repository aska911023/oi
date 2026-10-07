import { unstable_cache } from "next/cache";
import { createPublicClient } from "./supabase/public";
import { DEFAULT_SETTINGS, type SiteSettings, type Block, type BlockType } from "./site-settings-types";

export * from "./site-settings-types";

const TYPES: BlockType[] = ["heading", "text", "image", "carousel", "button", "spacer", "split", "embeds"];

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
    embeds: Array.isArray(b.embeds) ? (b.embeds as string[]).filter((x) => typeof x === "string") : undefined,
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
      if (d.hero_layout === "stack" || d.hero_layout === "split" || d.hero_layout === "banner") s.hero_layout = d.hero_layout;
      if (typeof d.hero_split_ratio === "number" && d.hero_split_ratio >= 20 && d.hero_split_ratio <= 80) s.hero_split_ratio = d.hero_split_ratio;
      if (typeof d.logo_image === "string") s.logo_image = d.logo_image;
      if (typeof d.logo_size === "number" && d.logo_size > 0) s.logo_size = d.logo_size;
      if (typeof d.contact_email === "string") s.contact_email = d.contact_email;
      if (typeof d.contact_line === "string") s.contact_line = d.contact_line;
      if (typeof d.contact_phone === "string") s.contact_phone = d.contact_phone;
      if (typeof d.contact_ig === "string") s.contact_ig = d.contact_ig;
      if (typeof d.contact_fb === "string") s.contact_fb = d.contact_fb;
      if (typeof d.brand_philosophy === "string" && d.brand_philosophy) s.brand_philosophy = d.brand_philosophy;
      if (typeof d.footer_about === "string" && d.footer_about) s.footer_about = d.footer_about;
      if (typeof d.footer_copyright === "string" && d.footer_copyright) s.footer_copyright = d.footer_copyright;
      if (typeof d.footer_tagline === "string" && d.footer_tagline) s.footer_tagline = d.footer_tagline;
      if (typeof d.about_body === "string" && d.about_body) s.about_body = d.about_body;
      if (typeof d.contact_intro === "string" && d.contact_intro) s.contact_intro = d.contact_intro;
      if (typeof d.comment_banned_words === "string") s.comment_banned_words = d.comment_banned_words;
      if (Array.isArray(d.blocks) && d.blocks.length) {
        const parsed = d.blocks.map(sanitizeBlock).filter(Boolean) as Block[];
        if (parsed.length) s.blocks = parsed;
      }
      return s;
    }
  } catch {}
  return DEFAULT_SETTINGS;
}, ["site-settings"], { tags: ["settings"], revalidate: 300 });
