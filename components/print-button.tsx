"use client";

// 列印 / 存成 PDF(瀏覽器列印對話框選「儲存為 PDF」)
export default function PrintButton({ label = "🖨 列印 / 存成 PDF" }: { label?: string }) {
  return <button type="button" className="btn btn-ghost" onClick={() => window.print()}>{label}</button>;
}
