import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AboutPage() {
  return (
    <main className="legal">
      <h1>品牌故事</h1>
      <p className="updated">關於偶宿 O!</p>

      <p>偶宿 O!(O! Stay)相信,旅行最美的部分,常常發生在「住下來」之後——慢下來的早晨、民宿主人隨口的推薦、轉角遇見的小店。</p>

      <h2>我們在做什麼</h2>
      <p>我們把全台的民宿,連同周邊的景點、美食、停車與租車,整理在同一個地方;並提供行程規劃工具,讓你把想去的地方排進每一天,和旅伴一起討論、分享。</p>
      <p>我們不經手訂房、不抽佣金——而是把你導回民宿的官方管道(官網 / LINE),讓好客人回到店家手上。</p>

      <h2>為什麼叫「偶宿」</h2>
      <p>「偶爾出走,找一處喜歡的一宿。」偶宿,是偶爾給自己的一段留白。</p>

      <div className="box">
        <p style={{ margin: 0 }}>想合作或上架你的民宿?歡迎<Link href="/apply">申請成為業者</Link>,或到<Link href="/contact">聯絡我們</Link>找到我們。</p>
      </div>
    </main>
  );
}
