// SEO 結構化資料輔助
const BASE = "https://www.oi-stay.com";

// 麵包屑 JSON-LD(path 為站內相對路徑,會補上網域)
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${BASE}${it.path}`,
    })),
  };
}
