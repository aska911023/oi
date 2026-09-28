import HeroCarousel from "@/components/hero-carousel";
import type { Block, FontChoice } from "@/lib/site-settings-types";

const fam = (f?: FontChoice) =>
  f === "sans" ? '"Noto Sans TC","Microsoft JhengHei",sans-serif'
    : f === "serif" ? '"Noto Serif TC",Georgia,serif'
      : undefined;

function textStyle(b: Block): React.CSSProperties {
  return { color: b.color, fontFamily: fam(b.font), fontSize: b.size, textAlign: b.align, margin: 0, lineHeight: 1.4 };
}

export default function BlocksRender({ blocks }: { blocks: Block[] }) {
  return (
    <div className="blocks">
      {blocks.map((b) => {
        switch (b.type) {
          case "heading":
            return <h1 key={b.id} className="blk-heading" style={textStyle(b)}>{b.text}</h1>;
          case "text":
            return <p key={b.id} className="blk-text" style={{ ...textStyle(b), lineHeight: 1.7 }}>{b.text}</p>;
          case "image":
            return b.image ? (
              <div key={b.id} style={{ textAlign: b.align || "left" }}>
                <img className="blk-image" src={b.image} alt="" style={
                  b.height
                    ? { width: `${b.width || 100}%`, height: b.height, objectFit: "cover" }
                    : { maxWidth: `${b.width || 100}%` }
                } />
              </div>
            ) : null;
          case "carousel":
            return (
              <div key={b.id} className="blk-carousel" style={{ maxWidth: `${b.width || 100}%` }}>
                <HeroCarousel images={(b.images || []).filter(Boolean)} height={b.height} />
              </div>
            );
          case "button":
            return b.text ? (
              <div key={b.id} style={{ textAlign: b.align || "left" }}>
                <a className="btn btn-primary" href={b.href || "#"}>{b.text}</a>
              </div>
            ) : null;
          case "spacer":
            return <div key={b.id} style={{ height: b.height || 24 }} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
