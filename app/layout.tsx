import "./globals.css";
import type { Metadata } from "next";
import { Noto_Sans_TC, Noto_Serif_TC } from "next/font/google";

const noto = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-noto",
  display: "swap",
});

const serif = Noto_Serif_TC({
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "偶宿 O! · 台灣民宿搜尋",
  description: "偶爾出走,找到喜歡的一宿。以地區、風格與預算,找到喜歡的台灣民宿。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={`${noto.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
