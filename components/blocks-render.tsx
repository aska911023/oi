import HeroCarousel from "@/components/hero-carousel";
import type { Block, FontChoice, HeroLayout } from "@/lib/site-settings-types";

const fam = (f?: FontChoice) =>
  f === "sans" ? '"Noto Sans TC","Microsoft JhengHei",sans-serif'
    : f === "serif" ? '"Noto Serif TC",Georgia,serif'
      : undefined;

function textStyle(b: Block): React.CSSProperties {
  return { color: b.color, fontFamily: fam(b.font), fontSize: b.size, textAlign: b.align, margin: 0, lineHeight: 1.4 };
}

function renderBlock(b: Block) {
  switch (b.type) {
    case "heading":
      return <h1 key={b.id} className="blk-heading" style={textStyle(b)}>{b.text}</h1>;
    case "text":
      return <p key={b.id} className="blk-text" style={{ ...textStyle(b), lineHeight: 1.7 }}>{b.text}</p>;
    case "image":
      return b.image ? (
        <div key={b.id} style={{ textAlign: b.align || "left" }}>
          <img className="blk-image" src={b.image} alt="" style={
            b.height ? { width: `${b.width || 100}%`, height: b.height, objectFit: "cover" } : { maxWidth: `${b.width || 100}%` }
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
    case "split": {
      const imageRight = b.align !== "left";
      const imgEl = <div className="bs-img" key="img">{b.image ? <img src={b.image} alt="" style={b.height ? { height: b.height, objectFit: "cover" } : undefined} /> : null}</div>;
      const txtEl = <div className="bs-text" key="txt"><p style={{ color: b.color, fontFamily: fam(b.font), fontSize: b.size, margin: 0, lineHeight: 1.8 }}>{b.text}</p></div>;
      return <div key={b.id} className="blk-split">{imageRight ? [txtEl, imgEl] : [imgEl, txtEl]}</div>;
    }
    case "spacer":
      return <div key={b.id} style={{ height: b.height || 24 }} />;
    default:
      return null;
  }
}

export default function BlocksRender({ blocks, layout = "stack" }: { blocks: Block[]; layout?: HeroLayout }) {
  if (layout === "split") {
    const isMedia = (b: Block) => b.type === "image" || b.type === "carousel";
    const media = blocks.filter(isMedia);
    const rest = blocks.filter((b) => !isMedia(b));
    return (
      <div className="blocks-split">
        <div className="bs-left">{rest.map(renderBlock)}</div>
        <div className="bs-right">{media.map(renderBlock)}</div>
      </div>
    );
  }
  return <div className="blocks">{blocks.map(renderBlock)}</div>;
}
