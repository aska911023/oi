import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStayBySlug, stayHref } from "@/lib/city";
import { decodeParam } from "@/lib/slug";
import StayDetail from "@/components/stay-detail";

export const dynamic = "force-dynamic";

// 舊民宿網址 /stay/{slug|uuid}。slug 帶縣市前綴者由 middleware 308 到 /{region}/hotel/{slug};
// 推不出縣市(uuid 等)會落到這裡 —— 正常渲染,但 canonical 指向新網址讓 Google 收斂。
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const param = decodeParam((await params).id);
  const s = await getStayBySlug(param);
  if (!s) return { title: "找不到民宿" };
  const place = `${s.region || ""}${s.town || ""}`;
  const title = `${s.name} · ${place}${s.category || "民宿"}`;
  const description = (s.description || `位於${place}的${s.category || "民宿"}「${s.name}」。在偶宿 O! 看房型、價格與周邊景點,一鍵聯繫訂房。`).slice(0, 150);
  const img = (s.images && s.images[0]) || s.image || undefined;
  const canonical = stayHref(s.region, s.slug || s.id);
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, type: "website", images: img ? [img] : undefined }, twitter: { card: "summary_large_image", title, description, images: img ? [img] : undefined } };
}

export default async function LegacyStayPage({ params }: { params: Promise<{ id: string }> }) {
  const param = decodeParam((await params).id);
  const s = await getStayBySlug(param);
  if (!s) notFound();
  return <StayDetail stay={s} />;
}
