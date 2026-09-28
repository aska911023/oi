import type { SiteSettings } from "@/lib/site-settings-types";

// 注入品牌色與底色(區塊各自帶 inline 樣式,不需在這裡處理文字)
export function siteThemeCss(s: SiteSettings) {
  return `:root{--green:${s.color_primary};--yellow:${s.color_accent};--page:${s.bg_color};}`;
}

export default function SiteTheme({ s }: { s: SiteSettings }) {
  return <style dangerouslySetInnerHTML={{ __html: siteThemeCss(s) }} />;
}
