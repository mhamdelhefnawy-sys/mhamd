import ExcelJS from "exceljs";

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

// Reads the first worksheet of an uploaded workbook into header + row-object form,
// used by the mapping UI (preview) and by commit-time validation.
export async function parseWorkbook(buffer: Buffer): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((h, idx) => {
      if (!h) return;
      const cell = row.getCell(idx + 1);
      const value = cell.value;
      obj[h] = typeof value === "object" && value !== null && "result" in (value as any) ? (value as any).result : value;
      if (obj[h] !== null && obj[h] !== undefined && obj[h] !== "") hasValue = true;
    });
    if (hasValue) rows.push(obj);
  });

  return { headers, rows };
}

export interface FieldMapping {
  [systemField: string]: string; // system field -> excel column header
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportValidationResult<T> {
  valid: T[];
  errors: ValidationError[];
  summary: { totalRows: number; validRows: number; failedRows: number };
}

// Generic row mapper + validator used by BOQ / Cost Code / other importers.
export function mapAndValidateRows<T>(
  sheet: ParsedSheet,
  mapping: FieldMapping,
  validateRow: (mapped: Record<string, unknown>, rowIndex: number) => { value?: T; errors: ValidationError[] }
): ImportValidationResult<T> {
  const valid: T[] = [];
  const errors: ValidationError[] = [];

  sheet.rows.forEach((row, idx) => {
    const mapped: Record<string, unknown> = {};
    for (const [systemField, excelColumn] of Object.entries(mapping)) {
      mapped[systemField] = row[excelColumn];
    }
    const result = validateRow(mapped, idx + 2); // +2: header row + 1-indexed
    if (result.errors.length > 0) {
      errors.push(...result.errors);
    } else if (result.value !== undefined) {
      valid.push(result.value);
    }
  });

  return {
    valid,
    errors,
    summary: { totalRows: sheet.rows.length, validRows: valid.length, failedRows: sheet.rows.length - valid.length },
  };
}
