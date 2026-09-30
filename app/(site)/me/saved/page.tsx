import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Stay } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/me/saved");
  const { data } = await sb.from("saved").select("stay_id, stays(*)").eq("user_id", user.id).order("created_at", { ascending: false });
  const stays = ((data || []) as unknown as { stays: Stay | null }[]).map((r) => r.stays).filter(Boolean) as Stay[];

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="plan-head"><h1 className="serif">我的收藏</h1><p>你收藏的民宿,點進去看房型與預訂。</p></div>
      {stays.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>還沒有收藏。逛<Link href="/" style={{ color: "var(--green)", textDecoration: "underline" }}>探索</Link>時點民宿頁的「♡ 收藏」吧。</div>
      ) : (
        <div className="cards">
          {stays.map((s) => (
            <Link key={s.id} href={`/stay/${s.id}`} className="card">
              <div className="photo">{s.image ? <img src={s.image} alt={s.name} loading="lazy" /> : <div className="photo-ph" />}</div>
              <div className="card-body">
                <div className="card-eyebrow">{s.region} · {s.town}<span className="dot" />{s.category}</div>
                <h3>{s.name}</h3>
                <div className="card-desc">{s.description}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
