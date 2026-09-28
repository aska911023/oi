import type { SiteSettings, ElStyle } from "@/lib/site-settings";

const fam = (f: string) =>
  f === "sans" ? '"Noto Sans TC","Microsoft JhengHei",sans-serif' : '"Noto Serif TC",Georgia,serif';

function elCss(sel: string, st: ElStyle, mobileScale: number) {
  return `${sel}{color:${st.color};font-family:${fam(st.font)};font-size:${st.size}px;text-align:${st.align};}
@media(max-width:600px){${sel}{font-size:${Math.max(12, Math.round(st.size * mobileScale))}px;}}`;
}

// 依設定注入 CSS(品牌色 + 每段文字的字體/顏色/大小/對齊)
export function siteThemeCss(s: SiteSettings) {
  const hs = s.hero_styles;
  return `:root{--green:${s.color_primary};--yellow:${s.color_accent};}
${elCss(".disc-copy .eyebrow", hs.eyebrow, 1)}
${elCss(".disc-copy h1", hs.title, 0.66)}
${elCss(".disc-copy p", hs.subtitle, 0.9)}`;
}

export default function SiteTheme({ s }: { s: SiteSettings }) {
  return <style dangerouslySetInnerHTML={{ __html: siteThemeCss(s) }} />;
}
