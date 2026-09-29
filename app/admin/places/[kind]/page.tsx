import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlacesAdmin from "@/components/admin/places-admin";
import { KIND_TABLE } from "@/lib/places";
import { POI_KINDS, type Place, type PoiKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPlacesKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const meta = POI_KINDS.find((k) => k.slug === kind);
  if (!meta) notFound();
  const sb = await createClient();
  const { data } = await sb.from(KIND_TABLE[meta.kind as PoiKind]).select("*").order("created_at", { ascending: false });
  return <PlacesAdmin initial={(data as Place[]) || []} kind={meta.kind as PoiKind} />;
}
