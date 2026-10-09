// 極簡、安全的 Markdown → HTML(後台攻略內文用;內容來自可信的管理員)。
// 先 escape 掉 HTML,再套基本語法:# 標題、**粗體**、*斜體*、[連結](url)、![圖](url)、- 清單、段落。
function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

export function renderMarkdown(md: string): string {
  const lines = (md || "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false, inPara = false;
  const inline = (t: string) =>
    esc(t)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  const closePara = () => { if (inPara) { out.push("</p>"); inPara = false; } };
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closePara(); closeList(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { closePara(); closeList(); const lv = Math.min(m[1].length + 1, 4); out.push(`<h${lv}>${inline(m[2])}</h${lv}>`); continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/))) { closePara(); if (!inList) { out.push("<ul>"); inList = true; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    closeList();
    if (!inPara) { out.push("<p>"); inPara = true; } else { out.push("<br />"); }
    out.push(inline(line));
  }
  closePara(); closeList();
  return out.join("");
}
