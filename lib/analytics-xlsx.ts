import ExcelJS from "exceljs";

const TIER_LABEL: Record<string, string> = { free: "免費", featured: "精選", flagship: "旗艦" };
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

export interface Totals { views: number; click_web: number; click_map: number; shares: number; saves: number }
export interface TopRow { name: string; ad_tier: string; views: number; click_web: number; shares: number; saves: number }
export interface TierRow { ad_tier: string; stays: number; views: number; click_web: number; shares: number; saves: number }

const GREEN = "FF17635A";
const GREEN_SOFT = "FFE7EFEC";
const INK = "FF12201C";
const GREY = "FF7C8A84";
const LINE = "FFDCE4E0";
const thin = { style: "thin" as const, color: { argb: LINE } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

export async function buildAnalyticsXlsx(rangeLabel: string, totals: Totals, tiers: TierRow[], top: TopRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "偶宿 O!";
  const ws = wb.addWorksheet("營運數據");
  ws.columns = [{ width: 22 }, { width: 26 }, { width: 12 }, { width: 14 }, { width: 9 }, { width: 9 }, { width: 14 }, { width: 11 }];

  const titleCell = (row: number, text: string, sub?: boolean) => {
    ws.mergeCells(row, 1, row, 8);
    const c = ws.getCell(row, 1);
    c.value = text;
    if (sub) { c.font = { size: 11, color: { argb: GREY } }; }
    else { c.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } }; }
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(row).height = sub ? 18 : 30;
  };
  const sectionHead = (row: number, text: string) => {
    ws.mergeCells(row, 1, row, 8);
    const c = ws.getCell(row, 1);
    c.value = text;
    c.font = { size: 13, bold: true, color: { argb: INK } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_SOFT } };
    c.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(row).height = 24;
  };
  const headRow = (row: number, cells: string[]) => {
    const r = ws.getRow(row);
    cells.forEach((v, i) => {
      const c = r.getCell(i + 1);
      c.value = v;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
      c.alignment = { vertical: "middle", horizontal: i === 0 || v === "民宿" ? "left" : "center" };
      c.border = border;
    });
    r.height = 22;
  };
  const dataRow = (row: number, cells: (string | number)[], pctCols: number[] = []) => {
    const r = ws.getRow(row);
    cells.forEach((v, i) => {
      const c = r.getCell(i + 1);
      c.value = v;
      c.border = border;
      c.alignment = { vertical: "middle", horizontal: typeof v === "number" || pctCols.includes(i) ? "right" : "left", indent: typeof v === "string" ? 1 : 0 };
      if (pctCols.includes(i)) c.numFmt = "0.0%";
      else if (typeof v === "number") c.numFmt = "#,##0";
    });
  };

  let r = 1;
  titleCell(r++, "  偶宿 O! 營運數據報表");
  titleCell(r++, `  ${rangeLabel} · 數據隨消費者瀏覽、導流、分享、收藏累積`, true);
  r++;

  // 總覽
  sectionHead(r++, "總覽");
  headRow(r++, ["指標", "數值", "", "", "", "", "", ""]);
  const ov: [string, number | string, boolean?][] = [
    ["民宿頁瀏覽", totals.views], ["導流點擊(前往商家)", totals.click_web],
    ["導流率", ratio(totals.click_web, totals.views), true], ["地圖點擊", totals.click_map],
    ["分享次數", totals.shares], ["被收藏", totals.saves],
  ];
  for (const [k, v, isPct] of ov) {
    const rr = ws.getRow(r);
    rr.getCell(1).value = k; rr.getCell(1).border = border; rr.getCell(1).alignment = { indent: 1, vertical: "middle" };
    const vc = rr.getCell(2); vc.value = v; vc.border = border; vc.alignment = { horizontal: "right", vertical: "middle" };
    vc.numFmt = isPct ? "0.0%" : "#,##0";
    for (let i = 3; i <= 8; i++) rr.getCell(i).border = border;
    r++;
  }
  r++;

  // 曝光方案成效
  sectionHead(r++, "曝光方案成效(付費 vs 免費)");
  headRow(r++, ["方案", "上架數", "瀏覽", "導流點擊", "分享", "收藏", "平均瀏覽/間", "導流率"]);
  for (const t of tiers) {
    dataRow(r++, [TIER_LABEL[t.ad_tier] || t.ad_tier, t.stays, t.views, t.click_web, t.shares, t.saves,
      t.stays > 0 ? Math.round(t.views / t.stays) : 0, ratio(t.click_web, t.views)], [7]);
  }
  r++;

  // 熱門民宿
  sectionHead(r++, `熱門民宿 Top ${top.length || 30}`);
  headRow(r++, ["#", "民宿", "方案", "瀏覽", "導流點擊", "分享", "收藏", "導流率"]);
  top.forEach((row2, i) => {
    dataRow(r++, [i + 1, row2.name, TIER_LABEL[row2.ad_tier] || row2.ad_tier, row2.views, row2.click_web, row2.shares, row2.saves,
      ratio(row2.click_web, row2.views)], [7]);
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
