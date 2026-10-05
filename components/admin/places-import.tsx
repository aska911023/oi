"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GEOGRAPHIC_AREAS } from "@/lib/data";
import { KIND_TABLE, DETAILS } from "@/lib/places-config";
import type { PoiKind } from "@/lib/types";

const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);

const KIND_LABEL: Record<PoiKind, string> = { attraction: "景點", food: "美食", parking: "停車" };
// 第 9 欄(門票/價位/收費)依類型寫進不同的 details key
const PRICE_KEY: Record<PoiKind, string> = { attraction: "ticket", food: "price_level", parking: "fee" };

const HEADER_MAP: Record<string, string> = {
  名稱: "name", 縣市: "region", 鄉鎮市區: "town", 地址: "address",
  簡介: "description", 官網網址: "website", 標籤: "tags",
  開放時間: "hours", 營業時間: "hours", 門票價位: "price", 建議停留: "stay_time",
};

interface Parsed {
  row: number;
  name: string; region: string; town: string; address: string;
  description: string; website: string;
  tags: string[]; unknownTags: string[];
  hours: string; price: string; stay_time: string;
  errors: string[];
  duplicate: boolean;
}

// read-excel-file 依版本可能回傳「列陣列」或「工作表陣列」({sheet,data}),兩種都接
function firstSheetRows(res: unknown): unknown[][] {
  if (!Array.isArray(res) || res.length === 0) return [];
  const head = res[0] as { data?: unknown } | unknown[];
  if (!Array.isArray(head) && head && Array.isArray((head as { data?: unknown }).data)) {
    return (head as { data: unknown[][] }).data;
  }
  return res as unknown[][];
}

const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

export default function PlacesImport({ kind, existingNames, onDone }: {
  kind: PoiKind;
  existingNames: string[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Parsed[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const tagOptions = ((DETAILS[kind].find((f) => f.type === "tags") as { options?: string[] } | undefined)?.options) || [];
  const label = KIND_LABEL[kind];

  function reset() {
    setRows(null); setFileName(""); setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function pick(file: File) {
    setResult(null);
    setFileName(file.name);
    const readXlsxFile = (await import("read-excel-file/browser")).default;
    let raw: unknown[][];
    try {
      raw = firstSheetRows(await readXlsxFile(file));
    } catch {
      setRows([]); setResult("讀不到這個檔案,請確認是 .xlsx(Excel 活頁簿)格式。"); return;
    }
    if (!raw.length) { setRows([]); setResult("檔案是空的。"); return; }

    const headers = raw[0].map((h) => txt(h).replace(/\s*\*$/, ""));
    const idx: Record<string, number> = {};
    headers.forEach((h, i) => { if (HEADER_MAP[h] !== undefined) idx[HEADER_MAP[h]] = i; });

    const missing = ["name", "region", "town"]
      .filter((k) => idx[k] === undefined)
      .map((k) => Object.keys(HEADER_MAP).find((z) => HEADER_MAP[z] === k));
    if (missing.length) {
      setRows([]); setResult("缺少必要欄位:" + missing.join("、") + "。請用下載的範本填寫。"); return;
    }

    const seen = new Set(existingNames);
    const out: Parsed[] = [];
    for (let r = 1; r < raw.length; r++) {
      const cell = (k: string) => (idx[k] === undefined ? "" : raw[r][idx[k]]);
      const name = txt(cell("name"));
      if (!name || name.startsWith("↑")) continue;

      const rawTags = txt(cell("tags")).split(/[、,，/／]/).map((t) => t.trim()).filter(Boolean);
      const p: Parsed = {
        row: r + 1,
        name,
        region: txt(cell("region")),
        town: txt(cell("town")),
        address: txt(cell("address")),
        description: txt(cell("description")),
        website: txt(cell("website")),
        tags: rawTags.filter((t) => tagOptions.includes(t)),
        unknownTags: rawTags.filter((t) => !tagOptions.includes(t)),
        hours: txt(cell("hours")),
        price: txt(cell("price")),
        stay_time: txt(cell("stay_time")),
        errors: [],
        duplicate: seen.has(name),
      };
      if (!REGIONS.includes(p.region)) p.errors.push(`縣市「${p.region || "空白"}」不在清單中`);
      if (!p.town) p.errors.push("鄉鎮市區必填");
      if (p.website && !/^https?:\/\//i.test(p.website)) p.errors.push("官網網址要以 http(s):// 開頭");

      seen.add(name);
      out.push(p);
    }
    setRows(out);
    if (!out.length) setResult("這份檔案沒有可讀的資料列(第 2 列起要填資料)。");
  }

  const ok = (rows || []).filter((r) => !r.errors.length && !r.duplicate);
  const bad = (rows || []).filter((r) => r.errors.length);
  const dup = (rows || []).filter((r) => !r.errors.length && r.duplicate);

  async function doImport() {
    if (!ok.length) return;
    setBusy(true);
    const sb = createClient();
    const payload = ok.map((r) => {
      const details: Record<string, unknown> = { source: "excel" };
      if (r.tags.length) details.tags = r.tags;
      if (r.hours) details.hours = r.hours;
      if (r.price) details[PRICE_KEY[kind]] = r.price;
      if (r.stay_time && kind === "attraction") details.stay_time = r.stay_time;
      return {
        name: r.name, region: r.region, town: r.town, address: r.address,
        description: r.description, website: r.website,
        image: "", images: [], details, published: publish,
      };
    });
    const { data, error } = await sb.from(KIND_TABLE[kind]).insert(payload).select("id");
    setBusy(false);
    if (error) { setResult("匯入失敗:" + error.message); return; }
    setResult(`已匯入 ${data?.length ?? ok.length} 筆${label}。`);
    setRows(null);
    if (fileRef.current) fileRef.current.value = "";
    onDone();
  }

  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(true)}>📥 Excel 匯入</button>

      {open && (
        <>
          <div className="overlay" onClick={() => { setOpen(false); reset(); }} />
          <div className="editor" role="dialog" aria-modal="true" style={{ width: "min(1040px, 96vw)" }}>
            <h2>Excel 批次匯入{label}</h2>

            <ol className="imp-steps">
              <li>
                下載範本並填寫(第 1 列欄位名稱別動,範例列請刪掉)
                <a className="btn btn-ghost btn-sm" style={{ marginLeft: 10 }}
                  href="/places-import-template.xlsx" download={`偶宿_${label}匯入範本.xlsx`}>下載範本</a>
              </li>
              <li>
                選擇填好的檔案
                <input ref={fileRef} type="file" accept=".xlsx" style={{ marginLeft: 10 }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); }} />
              </li>
              <li>確認下方檢查結果,再按「確認匯入」</li>
            </ol>

            <p className="imp-hint">
              目前匯入的是「<b>{label}</b>」。可用標籤:{tagOptions.join("、")}
              (填不在清單中的字會被忽略,不會擋下整列)
            </p>

            {result && <p className="imp-result">{result}</p>}

            {rows && rows.length > 0 && (
              <>
                <div className="imp-summary">
                  <span className="pill approved">可匯入 {ok.length}</span>
                  {dup.length > 0 && <span className="pill draft">已存在略過 {dup.length}</span>}
                  {bad.length > 0 && <span className="pill rejected">有錯誤 {bad.length}</span>}
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>{fileName}</span>
                </div>

                <div className="atable-wrap" style={{ maxHeight: 330, overflow: "auto" }}>
                  <table className="atable">
                    <thead>
                      <tr><th>列</th><th>名稱</th><th>地區</th><th>標籤</th><th>檢查結果</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.row}>
                          <td style={{ color: "var(--muted)" }}>{r.row}</td>
                          <td><b>{r.name}</b></td>
                          <td style={{ whiteSpace: "nowrap" }}>{r.region} {r.town}</td>
                          <td>
                            {r.tags.join("、") || "—"}
                            {r.unknownTags.length > 0 &&
                              <span style={{ color: "#8a7736" }}>(忽略:{r.unknownTags.join("、")})</span>}
                          </td>
                          <td>
                            {r.errors.length
                              ? <span style={{ color: "#a5303a" }}>{r.errors.join("；")}</span>
                              : r.duplicate
                                ? <span style={{ color: "#8a7736" }}>站上已有同名,略過</span>
                                : <span style={{ color: "var(--green)" }}>可匯入</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <label className="check" style={{ marginTop: 14 }}>
                  <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                  匯入後直接上架
                </label>
              </>
            )}

            <div className="editor-actions">
              <button className="btn btn-ghost" onClick={() => { setOpen(false); reset(); }}>關閉</button>
              <button className="btn btn-primary" onClick={doImport} disabled={busy || !ok.length}>
                {busy ? "匯入中…" : `確認匯入 ${ok.length} 筆`}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
