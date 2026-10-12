import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BookingsManager from "@/components/vendor/bookings-manager";

export const dynamic = "force-dynamic";

// 獨立隱藏頁:/vendor/bookings(不掛進 VendorTabs,靠網址進入)
export default async function VendorBookingsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/vendor/bookings");
  const ownerId = user.id;

  const { data: stays } = await sb
    .from("stays")
    .select("id,name,booking_deposit_pct,booking_enabled")
    .eq("owner_id", ownerId)
    .order("name");
  const stayIds = (stays || []).map((s) => s.id);

  const rooms = stayIds.length
    ? (await sb.from("room_types")
        .select("id,stay_id,name,price,capacity,rooms_total,pricing,kind,sort")
        .in("stay_id", stayIds).order("sort")).data
    : [];

  const bookings = stayIds.length
    ? (await sb.from("bookings")
        .select("*, booking_rooms(*), payments(*)")
        .in("stay_id", stayIds).order("created_at", { ascending: false })).data
    : [];

  return (
    <BookingsManager
      ownerId={ownerId}
      stays={(stays as never) || []}
      rooms={(rooms as never) || []}
      initialBookings={(bookings as never) || []}
    />
  );
}
