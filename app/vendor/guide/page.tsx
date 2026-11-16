import PrintButton from "@/components/print-button";

export const dynamic = "force-dynamic";

// 業者使用教學(可列印 / 存 PDF)。內容涵蓋所有上架與加值功能。
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 12, marginBottom: 10 }}>
      <span style={{ flex: "none", width: 24, height: 24, borderRadius: "50%", background: "var(--green)", color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 }}>{n}</span>
      <span style={{ fontSize: 14.5, lineHeight: 1.7, paddingTop: 1 }}>{children}</span>
    </li>
  );
}
function Section({ icon, title, sub, children }: { icon: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px", background: "var(--surface)", breakInside: "avoid" }}>
      <h2 style={{ fontSize: 19, margin: "0 0 2px", display: "flex", alignItems: "center", gap: 8 }}><span>{icon}</span>{title}</h2>
      {sub && <p style={{ color: "var(--text-2)", margin: "0 0 14px", fontSize: 14 }}>{sub}</p>}
      <ol style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>{children}</ol>
    </section>
  );
}

export default function VendorGuide() {
  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>📖 業者使用教學</h1>
        <span style={{ marginLeft: "auto" }}><PrintButton /></span>
      </div>
      <p style={{ color: "var(--text-2)", marginTop: 0, marginBottom: 20 }}>從上架到收款,一步一步照做就會。<b>上架完全免費</b>;訂房、廣告等加值功能才收費(見最後「方案與收費」)。</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Section icon="🧭" title="整體概念(先看這個)" sub="搞懂這 3 句,後面都很好懂。">
          <Step n={1}><b>上架 = 免費</b>:把你的民宿 / 餐廳 / 景點放上平台,被旅客搜尋到,完全不用錢。</Step>
          <Step n={2}><b>加值 = 收費</b>:想開放線上訂房、買廣告版位、或精選置頂,才需要付費方案。</Step>
          <Step n={3}>任何上架 / 廣告都要<b>平台審核通過</b>才會對外顯示(通常很快)。</Step>
        </Section>

        <Section icon="🏠" title="上架民宿" sub="在「我的民宿」頁。">
          <Step n={1}>點右上 <b>「＋ 新增民宿」</b>。</Step>
          <Step n={2}>填名稱、縣市、地址、介紹;<b>一定要放照片</b>(第一張是封面,越好看越多人點)。</Step>
          <Step n={3}>按 <b>儲存</b> → 狀態變「待審核」。平台核准後就自動上架、對外曝光。</Step>
          <Step n={4}>之後要改,隨時點該列的 <b>「編輯」</b>;不想曝光就按「隱藏」。</Step>
        </Section>

        <Section icon="📅" title="開放線上訂房(加值)" sub="在「我的民宿 → 訂房管理」。需要訂房方案。">
          <Step n={1}>到 <b>訂房管理 → ⚙ 訂房設定</b>:打開「啟用訂房」、設「訂金比例」、填「💳 付款 / 轉帳資訊」(訂房後會顯示給房客)。</Step>
          <Step n={2}>到 <b>房況日曆</b>:設定每天的空房數、關閉不接的日期、特殊日價。</Step>
          <Step n={3}>房客下單後,你會收到 <b>Email + 站內通知</b>。到「訂單」分頁按 <b>確認接單</b>(先確定有房)。</Step>
          <Step n={4}>房客匯訂金後會回報(帳號後五碼),你到 <b>「待核對訂金」</b> 分頁核對入帳,按 <b>「確認收到訂金」</b>。</Step>
          <Step n={5}>完成!房客收到「訂房完成」通知。整個流程雙方都有紀錄,少糾紛。</Step>
        </Section>

        <Section icon="🏪" title="上架據點 / 租車" sub="在「我的據點」「我的租車」。">
          <Step n={1}>選分類(景點 / 餐廳 / 娛樂 / 外燴),點 <b>「＋ 新增」</b>。</Step>
          <Step n={2}>填資料、放照片 → 儲存 → 送審 → 核准後上架。流程跟民宿一樣。</Step>
        </Section>

        <Section icon="📢" title="投放活動廣告(加值)" sub="在「活動廣告」。買廣告方案後曝光在詳情頁中間輪播。">
          <Step n={1}>點 <b>「＋ 新增廣告」</b>,上傳廣告圖(建議寬幅)、填連結、選 <b>投放地區</b> 與檔期。</Step>
          <Step n={2}>按 <b>送審核</b>。平台核准後,就會在你選的地區、所有民宿 / 景點詳情頁中間輪播。</Step>
          <Step n={3}>狀態看得到:待審核 / 已核准 / 未通過(未通過會寫原因)。</Step>
        </Section>

        <Section icon="📊" title="看懂數據分析" sub="在「數據分析」。選一間民宿看成效。">
          <Step n={1}><b>瀏覽 / 點擊 / 收藏</b>:有多少人看到你、有沒有興趣(↑↓ 是跟上個月比)。</Step>
          <Step n={2}><b>轉換漏斗</b>:瀏覽 → 互動 → 訂房 → 成交,一眼看出卡在哪關。</Step>
          <Step n={3}>瀏覽高但沒人訂?通常是 <b>價格或照片</b> 要調。</Step>
        </Section>

        <Section icon="💰" title="方案與收費" sub="上架永遠免費,加值功能才收費。">
          <Step n={1}><b>免費版</b>:上架 + 被搜尋 + 導流(官網 / LINE / 地圖)+ 基礎數據。</Step>
          <Step n={2}><b>成長版</b>:加線上訂房 + 進階數據 + 排序提升。</Step>
          <Step n={3}><b>旗艦版</b>:再加精選置頂 + 每月廣告檔期 + 優先客服。</Step>
          <Step n={4}>想升級或單買廣告 / 置頂,請 <b>聯絡平台客服</b>(右上角)。</Step>
        </Section>

        <Section icon="💬" title="需要幫忙?">
          <Step n={1}>點右上角 <b>「聯絡平台客服」</b>,透過官方 LINE 直接問我們。</Step>
        </Section>
      </div>
    </div>
  );
}
