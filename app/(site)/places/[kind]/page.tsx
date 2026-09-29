import { notFound } from "next/navigation";
import PlacesExplore from "@/components/places-explore";
import { getPlaceInitial } from "@/lib/places";
import { POI_KINDS, type PoiKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlacesPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const meta = POI_KINDS.find((k) => k.slug === kind);
  if (!meta) notFound();

  const { places, total, regions } = await getPlaceInitial(meta.kind as PoiKind);

  return (
    <main>
      <PlacesExplore places={places} total={total} regions={regions} kind={meta.kind as PoiKind} />
    </main>
  );
}
