import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Stay } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Saved { id: string; name: string; region?: string | null; town?: string | null; image?: string | null; description?: string | null }

// 各收藏類型 → 資料表與點擊後要去的頁面
const KINDS: { kind: string; label: string; table: string; href: (id: string) => string }[] = [
  { kind: "attraction", label: "景點", table: "attractions", href: () => "/places/attraction" },
  { kind: "food", label: "美食", table: "restaurants", href: () => "/places/food" },
  { kind: "parking", label: "停車", table: "parking_lots", href: () => "/places/parking" },
  { kind: "rental", label: "租車", table: "rental_shops", href: () => "/rentals" },
];

function Section({ title, items, href }: { title: string; items: Saved[]; href: (id: string) => string }) {
  if (!items.length) return null;
  return (
    <section style={{ marginTop: 34 }}>
      <h2 className="serif shop-h">{title} <span className="count">{items.length}</span></h2>
      <div className="cards">
        {items.map((p) => (
          <Link key={p.id} href={href(p.id)} className="card">
            <div className={"photo" + (p.image ? "" : " noimg")}>
              {p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : <div className="photo-ph" />}
            </div>
            <div className="card-body">
              <div className="card-eyebrow">{p.region}{p.town ? " · " + p.town : ""}</div>
              <h3>{p.name}</h3>
              {p.description && <div className="card-desc">{p.description}</div>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function SavedPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/me/saved");

  // 收藏分兩張表:民宿頁的「♡ 收藏」寫 saved(民宿層級),
  // 列表上的書籤寫 saved_places(kind + place_id)。兩邊都要讀,否則按了會看不到。
  const [{ data: bySt }, { data: byPlace }] = await Promise.all([
    sb.from("saved").select("stay_id, created_at").eq("user_id", user.id),
    sb.from("saved_places").select("kind, place_id, created_at").eq("user_id", user.id),
  ]);
  const places = byPlace || [];
  const idsOf = (kind: string) => places.filter((p) => p.kind === kind).map((p) => p.place_id);

  // --- 民宿:saved(民宿) + saved_places(房型→所屬民宿),以民宿去重 ---
  const roomIds = idsOf("room");
  const { data: rooms } = roomIds.length
    ? await sb.from("room_types").select("id, stay_id").in("id", roomIds)
    : { data: [] };
  const roomToStay = Object.fromEntries((rooms || []).map((r) => [r.id, r.stay_id]));

  const latest = new Map<string, string>();
  const bump = (id: string | null | undefined, at: string) => {
    if (id && (!latest.has(id) || latest.get(id)! < at)) latest.set(id, at);
  };
  for (const r of bySt || []) bump(r.stay_id, r.created_at);
  for (const r of places) if (r.kind === "room") bump(roomToStay[r.place_id], r.created_at);

  const stayIds = Array.from(latest.keys());
  const { data: stayRows } = stayIds.length
    ? await sb.from("stays").select("*").in("id", stayIds)
    : { data: [] };
  const stays = ((stayRows || []) as Stay[])
    .sort((a, b) => (latest.get(b.id) || "").localeCompare(latest.get(a.id) || ""));

  // --- 景點 / 美食 / 停車 / 租車 ---
  const others = await Promise.all(KINDS.map(async (k) => {
    const ids = idsOf(k.kind);
    if (!ids.length) return { ...k, items: [] as Saved[] };
    const { data } = await sb.from(k.table).select("id,name,region,town,image,description").in("id", ids);
    return { ...k, items: (data || []) as Saved[] };
  }));

  const total = stays.length + others.reduce((n, o) => n + o.items.length, 0);

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="plan-head">
        <h1 className="serif">我的收藏</h1>
        <p>你收藏的民宿、景點、美食與停車,點進去看詳細資訊。</p>
      </div>

      {total === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>
          還沒有收藏。逛<Link href="/" style={{ color: "var(--green)", textDecoration: "underline" }}>探索</Link>時點卡片右上角的書籤就會收進來。
        </div>
      ) : (
        <>
          {stays.length > 0 && (
            <section style={{ marginTop: 28 }}>
              <h2 className="serif shop-h">民宿 <span className="count">{stays.length}</span></h2>
              <div className="cards">
                {stays.map((s) => (
                  <Link key={s.id} href={`/stay/${s.id}`} className="card">
                    <div className={"photo" + (s.image ? "" : " noimg")}>
                      {s.image ? <img src={s.image} alt={s.name} loading="lazy" /> : <div className="photo-ph" />}
                    </div>
                    <div className="card-body">
                      <div className="card-eyebrow">{s.region} · {s.town}<span className="dot" />{s.category}</div>
                      <h3>{s.name}</h3>
                      <div className="card-desc">{s.description}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {others.map((o) => <Section key={o.kind} title={o.label} items={o.items} href={o.href} />)}
        </>
      )}
    </main>
  );
}
