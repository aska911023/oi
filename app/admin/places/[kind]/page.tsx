import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlacesAdmin from "@/components/admin/places-admin";
import { KIND_TABLE } from "@/lib/places";
import { POI_KINDS, type Place, type PoiKind } from "@/lib/types";
import type { OwnerProfile, PlaceBd } from "@/components/admin/places-admin";
import type { Plan } from "@/components/admin/plans-editor";

export const dynamic = "force-dynamic";

export default async function AdminPlacesKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const meta = POI_KINDS.find((k) => k.slug === kind);
  if (!meta) notFound();
  const k = meta.kind as PoiKind;
  const sb = await createClient();
  const [{ data }, { data: bd }, { data: plans }] = await Promise.all([
    sb.from(KIND_TABLE[k]).select("*").order("created_at", { ascending: false }),
    sb.from("place_bd").select("kind,place_id,contacted,rejected,note").eq("kind", k),
    sb.from("plans").select("*").order("sort"),
  ]);
  const ownerIds = Array.from(new Set(((data as Place[]) || []).map((p) => p.owner_id).filter(Boolean))) as string[];
  const { data: owners } = ownerIds.length
    ? await sb.from("profiles").select("id,display_name,full_name,role").in("id", ownerIds)
    : { data: [] };
  return <PlacesAdmin initial={(data as Place[]) || []} kind={k}
    ownersInitial={(owners as OwnerProfile[]) || []} bdInitial={(bd as PlaceBd[]) || []} plans={(plans as Plan[]) || []} />;
}
