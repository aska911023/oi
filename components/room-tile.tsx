import Link from "next/link";
import { priceLabel } from "@/lib/data";
import type { RoomCard } from "@/lib/types";

// 落地頁用的民宿房型卡(SSR、純 img,利於 SEO;樣式沿用首頁 .card)
export default function RoomTile({ r }: { r: RoomCard }) {
  const img = (r.images && r.images[0]) || r.image || "";
  return (
    <div className="card-wrap">
      <Link href={`/stay/${r.stay_slug || r.stay_id}`} className="card">
        <div className={"photo" + (img ? "" : " noimg")}>
          {img
            ? // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={`${r.stay_name} — ${r.region}${r.town}${r.category}`} loading="lazy" />
            : <div className="photo-ph" />}
          <div className="card-badges">
            {r.kind === "whole" && <span className="cbadge cbadge-whole">包棟</span>}
            {r.ad_tier && r.ad_tier !== "free" && <span className="cbadge cbadge-feat">精選</span>}
          </div>
        </div>
        <div className="card-body">
          <div className="card-eyebrow">{r.region} · {r.town}<span className="dot" />{r.category}</div>
          <h3>{r.stay_name}</h3>
          <div className="card-desc">{r.room_name}</div>
          <div className="card-bottom"><strong>{priceLabel(r.price)} <small>/ 晚起</small></strong></div>
        </div>
      </Link>
    </div>
  );
}
