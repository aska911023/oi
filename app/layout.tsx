import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.oi-stay.com"),
  title: {
    default: "偶宿 O! · 台灣民宿搜尋",
    template: "%s｜偶宿 O!", // 子頁標題會自動補上「｜偶宿 O!」
  },
  description: "偶宿 O! 彙整全台民宿 —— 宜蘭、花蓮、北海岸的包棟、親子、海景民宿一次搜尋,附房型、價格與周邊景點,還能規劃行程。不經手訂房,直接帶你聯繫民宿官方管道。",
  applicationName: "偶宿 O!",
  keywords: ["民宿", "台灣民宿", "民宿推薦", "包棟民宿", "親子民宿", "訂房", "旅遊", "行程規劃", "宜蘭民宿", "花蓮民宿", "北海岸民宿"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "偶宿 O!",
    locale: "zh_TW",
    url: "https://www.oi-stay.com",
    title: "偶宿 O! · 台灣民宿搜尋",
    description: "彙整全台民宿 —— 宜蘭、花蓮、北海岸的包棟、親子、海景民宿一次搜尋,看房型、價格與周邊景點。不經手訂房,直接帶你聯繫民宿。",
  },
  twitter: { card: "summary_large_image", title: "偶宿 O! · 台灣民宿搜尋", description: "彙整全台民宿,包棟/親子/海景一次搜尋,看房型價格與周邊景點。" },
  manifest: "/manifest.json",
  // 明確宣告乾淨網址(不帶 Next 雜湊 query)— iOS Safari 對帶 query 的 favicon 常不載入
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "256x256" },
    ],
    apple: { url: "/apple-touch-icon.png" },
  },
};

// 手機正確縮放的關鍵:用裝置實際寬度,不讓手機假裝成寬螢幕再縮小
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;800&family=Noto+Serif+TC:wght@600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
