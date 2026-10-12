import { createClient } from "@/lib/supabase/server";
import BookingsManager from "@/components/vendor/bookings-manager";

export const dynamic = "force-dynamic";

// 管理後台:全平台訂房(所有民宿)。admin 版可刪除、看全部。
export default async function AdminBookingsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const ownerId = user?.id ?? "";

  const { data: stays } = await sb
    .from("stays")
    .select("id,name,booking_deposit_pct,booking_enabled,booking_note")
    .order("name");
  const stayIds = (stays || []).map((s) => s.id);

  const rooms = stayIds.length
    ? (await sb.from("room_types")
        .select("id,stay_id,name,price,capacity,rooms_total,pricing,kind,sort")
        .in("stay_id", stayIds).order("sort")).data
    : [];

  // RLS:admin 看全部,不需過濾 owner
  const bookings = (await sb.from("bookings")
    .select("*, booking_rooms(*), payments(*)")
    .order("created_at", { ascending: false })).data;

  return (
    <BookingsManager
      ownerId={ownerId}
      isAdmin={true}
      stays={(stays as never) || []}
      rooms={(rooms as never) || []}
      initialBookings={(bookings as never) || []}
    />
  );
}
