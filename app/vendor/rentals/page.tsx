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
  return <RentalsAdmin initial={(data as RentalShop[]) || []} ownerId={user.id} />;
}
