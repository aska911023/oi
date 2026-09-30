import RentalsExplore from "@/components/rentals-explore";
import { getRentalsInitial } from "@/lib/rentals";

export const dynamic = "force-dynamic";

export default async function RentalsPage() {
  const { shops, total } = await getRentalsInitial();
  return (
    <main>
      <RentalsExplore shops={shops} total={total} />
    </main>
  );
}
