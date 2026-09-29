import { createClient } from "@/lib/supabase/server";
import RentalsAdmin from "@/components/admin/rentals-admin";
import type { RentalShop } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminRentalsPage() {
  const sb = await createClient();
  const { data } = await sb.from("rental_shops").select("*").order("created_at", { ascending: false });
  return <RentalsAdmin initial={(data as RentalShop[]) || []} />;
}
