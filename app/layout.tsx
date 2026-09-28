import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "偶宿 O! · 台灣民宿搜尋",
  description: "偶爾出走,找到喜歡的一宿。以地區、風格與預算,找到喜歡的台灣民宿。",
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
