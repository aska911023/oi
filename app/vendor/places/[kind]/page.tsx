import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlacesAdmin from "@/components/admin/places-admin";
import { KIND_TABLE } from "@/lib/places";
import { POI_KINDS, type Place, type PoiKind } from "@/lib/types";

export const dynamic = "force-dynamic";

// 業者後台：上架自己的景點 / 餐廳 / 娛樂 / 外燴 / 停車（owner 綁定,只看/改自己的）
export default async function VendorPlacesKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const meta = POI_KINDS.find((k) => k.slug === kind);
  if (!meta) notFound();
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(`/login?next=/vendor/places/${kind}`);
  const { data } = await sb.from(KIND_TABLE[meta.kind as PoiKind]).select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
  return (
    <>
      <div className="vendor-page-head">
        <h2>我的據點 · {meta.label}</h2>
        <p>上架你的{meta.label}並送審;上架後出現在前台的「{meta.label}」與地區頁。用上方分頁切換類別。</p>
      </div>
      <PlacesAdmin initial={(data as Place[]) || []} kind={meta.kind as PoiKind} ownerId={user.id} />
    </>
  );
}
