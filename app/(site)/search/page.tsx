import type { Metadata } from "next";
import SearchAutocomplete from "@/components/search-autocomplete";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "搜尋",
  description: "搜尋台灣旅遊 —— 城市、民宿、景點、美食,一次找齊。",
  robots: { index: false }, // 搜尋頁不收錄
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q || "";
  return (
    <main className="shell" style={{ paddingTop: 110, paddingBottom: 90, maxWidth: 680 }}>
      <h1 className="serif" style={{ fontSize: 26, marginBottom: 16 }}>搜尋</h1>
      <SearchAutocomplete initialQ={q} autoFocus />
      <p style={{ color: "var(--muted)", marginTop: 16, fontSize: 14 }}>輸入城市(宜蘭、花蓮…)、民宿、景點或美食名稱,直接跳到該頁。</p>
    </main>
  );
}
