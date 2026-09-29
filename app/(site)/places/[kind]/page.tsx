import { notFound } from "next/navigation";
import PlacesExplore from "@/components/places-explore";
import { getPoisInitial } from "@/lib/pois";
import { POI_KINDS, type PoiKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlacesPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const meta = POI_KINDS.find((k) => k.slug === kind);
  if (!meta) notFound();

  const { pois, total, regions } = await getPoisInitial(meta.kind as PoiKind);

  return (
    <main>
      <PlacesExplore pois={pois} total={total} regions={regions} kind={meta.kind as PoiKind} />
    </main>
  );
}
