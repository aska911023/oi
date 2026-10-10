import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TripCard from "@/components/trip-card";
import Avatar from "@/components/avatar";
import FollowBar from "@/components/follow-bar";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UserTripsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const [{ data }, { data: followStats }, { data: { user } }, prof, arts] = await Promise.all([
    sb.rpc("user_public_trips", { p_uid: id, lim: 50, off: 0 }),
    sb.rpc("follow_stats", { p_uid: id }),
    sb.auth.getUser(),
    sb.from("profiles").select("role").eq("id", id).maybeSingle(),
    sb.from("articles").select("id,slug,title,excerpt,cover_image,region,tag").eq("author_id", id).eq("published", true).order("created_at", { ascending: false }),
  ]);
  const d = (data || {}) as { name?: string | null; avatar?: string | null; total?: number; rows?: Trip[] };
  const name = d.name || "旅人";
  const rows = (d.rows || []) as Trip[];
  const isCreator = (prof.data as { role?: string } | null)?.role === "creator";
  const articles = (arts.data || []) as { id: string; slug?: string; title: string; excerpt?: string; cover_image?: string; region?: string; tag?: string }[];

  return (
    <main className="shell" style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="profile-head">
        <Avatar src={d.avatar} name={name} size={64} className="profile-avatar" />
        <div>
          <h1 className="serif" style={{ margin: 0 }}>{name} {isCreator && <span className="creator-badge">✍ 創作者</span>}</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{rows.length} 篇公開行程{articles.length > 0 ? ` · ${articles.length} 篇攻略` : ""}</p>
          <FollowBar uid={id} initial={followStats as { followers: number; following: number; is_following: boolean } | undefined} viewer={user?.id ?? null} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty" style={{ marginTop: 20 }}>這位旅人還沒有公開的行程。</div>
      ) : (
        <div className="ig-feed" style={{ marginTop: 24 }}>
          {rows.map((t) => <TripCard key={t.id} trip={t} viewerId={user?.id ?? null} />)}
        </div>
      )}

      {articles.length > 0 && (
        <section style={{ marginTop: 36 }}>
          <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>{name} 的攻略</h2>
          <div className="guide-grid">
            {articles.map((g) => (
              <Link key={g.id} href={`/guides/${g.slug || g.id}`} className="guide-card">
                <div className={"guide-cover" + (g.cover_image ? "" : " noimg")}>
                  {g.cover_image
                    ? // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.cover_image} alt={g.title} loading="lazy" />
                    : null}
                  {g.tag && <span className="guide-tag">{g.tag}</span>}
                </div>
                <div className="guide-cardbody"><h2>{g.title}</h2>{g.excerpt && <p>{g.excerpt}</p>}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div style={{ textAlign: "center", marginTop: 26 }}>
        <Link className="lnk" href="/trips">← 回行程分享牆</Link>
      </div>
    </main>
  );
}
