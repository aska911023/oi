import Link from "next/link";
import { getStayCities, getCityPlaces, placeHref } from "@/lib/city";

// 城市/分類落地頁底部的站內連結區塊:
//  1) 順遊周邊 —— 連到該縣市實際的景點/美食詳情頁(把爬取導進那些「已找到未索引」的詳情頁)
//  2) 其他縣市民宿 —— 跨縣市互連(擴散連結權重、幫 Google 爬得更廣)
// 全資料驅動,套用到每個縣市;沒資料的區塊自動不顯示。
export default async function CitySeoLinks({ city }: { city: string }) {
  const enc = encodeURIComponent;
  const [cities, attr, food] = await Promise.all([
    getStayCities(),
    getCityPlaces("attraction", city, 8),
    getCityPlaces("food", city, 6),
  ]);
  const others = cities.filter((c) => c !== city).slice(0, 14);
  const attrs = attr.places.slice(0, 8);
  const foods = food.places.slice(0, 6);

  return (
    <>
      {(attrs.length > 0 || foods.length > 0) && (
        <section style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 26 }}>
          <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>順遊 {city} 周邊</h2>
          {attrs.length > 0 && (
            <div className="region-links">
              {attrs.map((p) => (
                <Link key={p.id} href={placeHref("attraction", city, p.slug || p.id)} className="region-link">{p.name}</Link>
              ))}
              <Link href={`/${enc(city)}/attractions`} className="region-link">{city}全部景點 →</Link>
            </div>
          )}
          {foods.length > 0 && (
            <div className="region-links" style={{ marginTop: 10 }}>
              {foods.map((p) => (
                <Link key={p.id} href={placeHref("food", city, p.slug || p.id)} className="region-link">{p.name}</Link>
              ))}
              <Link href={`/${enc(city)}/restaurants`} className="region-link">{city}全部美食 →</Link>
            </div>
          )}
        </section>
      )}
      {others.length > 0 && (
        <section style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 26 }}>
          <h2 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>其他縣市民宿</h2>
          <div className="region-links">
            {others.map((c) => (
              <Link key={c} href={`/${enc(c)}/hotels`} className="region-link">{c}民宿</Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
