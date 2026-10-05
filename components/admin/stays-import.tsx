"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GEOGRAPHIC_AREAS, CATEGORIES } from "@/lib/data";

const REGIONS = GEOGRAPHIC_AREAS.flatMap((a) => a.regions);

// 用「欄位名稱」對應,所以使用者調換欄位順序也不會壞
const HEADER_MAP: Record<string, string> = {
  民宿名稱: "name", 縣市: "region", 鄉鎮市區: "town", 風格: "category",
  可住人數: "guests", 每晚最低價: "price", 地址: "address",
  官網網址: "website", 簡介: "description", 設施: "amenities", 民宿登記證號: "license_no",
};

interface Parsed {
  row: number;
  name: string; region: string; town: string; category: string;
  guests: number | null; price: number | null;
  address: string; website: string; description: string; amenities: string; license_no: string;
  errors: string[];
  duplicate: boolean;   // 站上或檔案內已有同名
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
const num = (v: unknown) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/[,$\sNT＄]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

export default function StaysImport({ existingNames, onDone }: {
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

    // 第 1 列是欄位名稱(容許「民宿名稱 *」這種帶星號的寫法)
    const headers = raw[0].map((h) => txt(h).replace(/\s*\*$/, ""));
    const idx: Record<string, number> = {};
    headers.forEach((h, i) => { if (HEADER_MAP[h] !== undefined) idx[HEADER_MAP[h]] = i; });

    const missing = ["name", "region", "town", "category", "guests"]
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
      // 整列空白 / 範本的提示列 → 直接跳過
      if (!name || name.startsWith("↑")) continue;

      const guests = num(cell("guests"));
      const price = num(cell("price"));
      const p: Parsed = {
        row: r + 1,
        name,
        region: txt(cell("region")),
        town: txt(cell("town")),
        category: txt(cell("category")),
        guests: Number.isNaN(guests) ? null : guests,
        price: Number.isNaN(price) ? null : price,
        address: txt(cell("address")),
        website: txt(cell("website")),
        description: txt(cell("description")),
        amenities: txt(cell("amenities")),
        license_no: txt(cell("license_no")),
        errors: [],
        duplicate: seen.has(name),
      };
      if (!REGIONS.includes(p.region)) p.errors.push(`縣市「${p.region || "空白"}」不在清單中`);
      if (!p.town) p.errors.push("鄉鎮市區必填");
      if (!CATEGORIES.includes(p.category as never)) p.errors.push(`風格「${p.category || "空白"}」不在清單中`);
      if (Number.isNaN(guests)) p.errors.push("可住人數不是數字");
      else if (p.guests === null || p.guests < 1 || p.guests > 100) p.errors.push("可住人數需為 1~100");
      if (Number.isNaN(price)) p.errors.push("每晚最低價不是數字");
      else if (p.price !== null && p.price < 0) p.errors.push("每晚最低價不可為負");
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
    const payload = ok.map((r) => ({
      name: r.name, region: r.region, town: r.town, category: r.category,
      guests: r.guests, price: r.price ?? 0,
      address: r.address, website: r.website, description: r.description,
      amenities: r.amenities, license_no: r.license_no,
      image: "", images: [],
      published: publish, approved: true, visibility: publish ? "published" : "draft",
      sample: false, origin: "excel",
    }));
    const { data, error } = await sb.from("stays").insert(payload).select("id,name,guests,price");
    if (error || !data) { setBusy(false); setResult("匯入失敗:" + (error?.message || "未知錯誤")); return; }

    // 每家自動配一筆「包棟」房型 — 首頁搜尋是 room_types JOIN stays,沒房型不會出現
    const rt = data.map((s: { id: string; name: string; guests: number; price: number }) => ({
      stay_id: s.id, name: "包棟", price: s.price ?? 0, capacity: s.guests ?? 1,
      beds: s.guests ? `可住 ${s.guests} 人` : "", description: "", image: "", images: [],
      amenities: "", kind: "whole", published: true, sort: 0, pricing: {},
    }));
    const { error: e2 } = await sb.from("room_types").insert(rt);
    setBusy(false);
    setResult(e2
      ? `民宿已新增 ${data.length} 家,但房型建立失敗(${e2.message}),請到各民宿手動加房型。`
      : `已匯入 ${data.length} 家民宿,每家自動建立一個「包棟」房型。`);
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
            <h2>Excel 批次匯入民宿</h2>

            <ol className="imp-steps">
              <li>
                下載範本並填寫(第 1 列欄位名稱別動,範例列請刪掉)
                <a className="btn btn-ghost btn-sm" style={{ marginLeft: 10 }}
                  href="/stays-import-template.xlsx" download="偶宿_民宿匯入範本.xlsx">下載範本</a>
              </li>
              <li>
                選擇填好的檔案
                <input ref={fileRef} type="file" accept=".xlsx" style={{ marginLeft: 10 }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); }} />
              </li>
              <li>確認下方檢查結果,再按「確認匯入」</li>
            </ol>

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
                      <tr><th>列</th><th>民宿名稱</th><th>地區</th><th>風格</th><th>人數</th><th>價格</th><th>檢查結果</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.row}>
                          <td style={{ color: "var(--muted)" }}>{r.row}</td>
                          <td><b>{r.name}</b></td>
                          <td style={{ whiteSpace: "nowrap" }}>{r.region} {r.town}</td>
                          <td>{r.category}</td>
                          <td>{r.guests ?? "—"}</td>
                          <td>{r.price === null ? "洽詢" : r.price.toLocaleString()}</td>
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
                  匯入後直接上架(不勾選則存為草稿,之後再逐家確認上架)
                </label>
              </>
            )}

            <div className="editor-actions">
              <button className="btn btn-ghost" onClick={() => { setOpen(false); reset(); }}>關閉</button>
              <button className="btn btn-primary" onClick={doImport} disabled={busy || !ok.length}>
                {busy ? "匯入中…" : `確認匯入 ${ok.length} 家`}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
