import { createClient } from "@/lib/supabase/server";
import EventsExplore, { type EventItem } from "@/components/events-explore";
import type { Metadata } from "next";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "活動專頁 | 偶宿 O!",
  description: "宜蘭、花蓮、北海岸的市集、手作體驗、展覽與季節活動——找個週末出門走走,住進好風景。",
};

export default async function EventsPage() {
  const sb = await createClient();
  const today = new Date().toLocaleDateString("en-CA");
  const { data } = await sb.from("happenings")
    .select("id,slug,title,image,category,region,town,start_date,end_date,start_time,is_free,indoor")
    .eq("published", true).eq("approved", true)
    .order("featured", { ascending: false })
    .order("start_date", { ascending: true, nullsFirst: false })
    .limit(200);
  // 只留「未結束」:迄日(或單日起日)>= 今天,或長期無日期
  const all = ((data as (EventItem & { end_date: string | null })[]) || []).filter((e) => {
    const end = e.end_date || e.start_date;
    return !end || end >= today;
  });

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="plan-head">
        <h1 className="serif">活動專頁</h1>
        <p>市集、手作、展覽、季節活動——找個週末,出門走走。</p>
      </div>
      <EventsExplore events={all} />
    </main>
  );
}
