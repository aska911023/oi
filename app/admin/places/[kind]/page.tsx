import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlacesAdmin from "@/components/admin/places-admin";
import { POI_KINDS, type PoiKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPlacesKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const meta = POI_KINDS.find((k) => k.slug === kind);
  if (!meta) notFound();
  const sb = await createClient();
  const { data } = await sb.from("pois").select("*").eq("kind", meta.kind).order("created_at", { ascending: false });
  return <PlacesAdmin initial={data || []} kind={meta.kind as PoiKind} />;
}
