import type { SiteSettings } from "@/lib/site-settings";

// 依設定注入 CSS 變數(顏色/字體/大標尺寸),覆蓋 globals 預設。
export default function SiteTheme({ s }: { s: SiteSettings }) {
  const headingFamily =
    s.heading_font === "sans"
      ? '"Noto Sans TC","Microsoft JhengHei",sans-serif'
      : '"Noto Serif TC",Georgia,serif';
  const size = s.hero_title_size || 44;
  const css = `:root{--green:${s.color_primary};--yellow:${s.color_accent};--serif:${headingFamily};}
.disc-copy h1{font-size:${size}px;line-height:1.35;}
@media(max-width:600px){.disc-copy h1{font-size:${Math.max(22, Math.round(size * 0.66))}px;}}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
