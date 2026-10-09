import Script from "next/script";

// Google Analytics 4 —— 只有設定了 NEXT_PUBLIC_GA_ID(G-XXXX)才載入;沒設就不動作。
export default function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}</Script>
    </>
  );
}
