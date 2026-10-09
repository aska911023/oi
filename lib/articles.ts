import { createPublicClient } from "./supabase/public";
import { hasSupabase } from "./stays";

export interface Article {
  id: string;
  slug?: string;
  title: string;
  excerpt?: string;
  cover_image?: string;
  body?: string;
  region?: string;
  tag?: string;
  published?: boolean;
  created_at?: string;
  updated_at?: string;
}

const LIST_COLS = "id,slug,title,excerpt,cover_image,region,tag,created_at";

// 已發布攻略(可選縣市)
export async function getArticles(region?: string, limit = 60): Promise<Article[]> {
  if (!hasSupabase()) return [];
  try {
    const sb = createPublicClient();
    let q = sb.from("articles").select(LIST_COLS).eq("published", true).order("created_at", { ascending: false }).limit(limit);
    if (region) q = q.eq("region", region);
    const { data } = await q;
    return (data || []) as Article[];
  } catch { return []; }
}

// 單篇(slug,找不到再試 id)
export async function getArticleBySlug(param: string): Promise<Article | null> {
  if (!hasSupabase()) return null;
  try {
    const sb = createPublicClient();
    let { data } = await sb.from("articles").select("*").eq("slug", param).maybeSingle();
    if (!data) ({ data } = await sb.from("articles").select("*").eq("id", param).maybeSingle());
    return (data as Article) || null;
  } catch { return null; }
}
