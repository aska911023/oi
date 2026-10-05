// 頭貼:有圖顯示圖、沒圖顯示暱稱首字(server/client 皆可用,無 hooks)
export default function Avatar({ src, name, size = 40, className = "" }: { src?: string | null; name?: string | null; size?: number; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={"avatar " + className} src={src} alt={name || ""} style={{ width: size, height: size }} />;
  }
  return (
    <div className={"avatar avatar-initial " + className} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden>
      {(name || "旅").slice(0, 1)}
    </div>
  );
}
