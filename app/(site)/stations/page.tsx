import StationsExplore from "@/components/stations-explore";
import { getStations } from "@/lib/stations";

export const dynamic = "force-dynamic";

export default async function StationsPage() {
  const stations = await getStations();
  return (
    <main>
      <StationsExplore stations={stations} />
    </main>
  );
}
