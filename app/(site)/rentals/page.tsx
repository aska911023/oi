import RentalsExplore from "@/components/rentals-explore";
import { getRentalsInitial } from "@/lib/rentals";

export const revalidate = 300; // 租車列表 → ISR;後台存檔走 revalidatePath("/rentals") 即時更新

export default async function RentalsPage() {
  const { shops, total } = await getRentalsInitial();
  return (
    <main>
      <RentalsExplore shops={shops} total={total} />
    </main>
  );
}
