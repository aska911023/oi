import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RentalsAdmin from "@/components/admin/rentals-admin";
import type { RentalShop } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VendorRentalsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor/rentals");
  const { data } = await sb.from("rental_shops").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
  return (
    <>
      <div className="vendor-page-head">
        <h2>我的租車</h2>
        <p>上架你的租車服務並送審;上架後旅客在「租車」頁找得到你。</p>
      </div>
      <RentalsAdmin initial={(data as RentalShop[]) || []} ownerId={user.id} />
    </>
  );
}
