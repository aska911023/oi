import StationsExplore from "@/components/stations-explore";
import { getStations } from "@/lib/stations";

export const revalidate = 600; // 車站列表(幾乎不變) → ISR

export default async function StationsPage() {
  const stations = await getStations();
  return (
    <main>
      <StationsExplore stations={stations} />
    </main>
  );
}
