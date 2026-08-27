import ExcelJS from "exceljs";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
}

// Produces a clean, professionally formatted workbook buffer: styled header row,
// frozen header pane, auto column widths, number formatting.
export async function buildExcelReport(
  title: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Construction Cost Control System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title.substring(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  rows.forEach((r) => sheet.addRow(r));

  columns.forEach((c, idx) => {
    if (c.numFmt) sheet.getColumn(idx + 1).numFmt = c.numFmt;
  });

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
