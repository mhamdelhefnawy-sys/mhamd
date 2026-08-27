import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

export interface PdfKpi {
  label: string;
  value: string;
}

export interface PdfTableRow {
  [key: string]: string | number;
}

export interface PdfReportOptions {
  companyName: string;
  projectName: string;
  reportTitle: string;
  reportingDate: string;
  preparedBy?: string;
  reviewedBy?: string;
  approvedBy?: string;
  executiveSummary?: string;
  kpis: PdfKpi[];
  tableColumns: { key: string; header: string; width?: number }[];
  tableRows: PdfTableRow[];
  notes?: string;
}

export async function buildPdfReport(opts: PdfReportOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    doc.pipe(stream);

    doc.fontSize(18).fillColor("#111827").text(opts.companyName, { continued: false });
    doc.fontSize(14).fillColor("#374151").text(opts.projectName);
    doc.moveDown(0.5);
    doc.fontSize(16).fillColor("#111827").text(opts.reportTitle, { underline: true });
    doc.fontSize(10).fillColor("#6B7280").text(`Reporting Date: ${opts.reportingDate}`);
    doc.moveDown(0.5);

    const sigLine = [
      opts.preparedBy ? `Prepared By: ${opts.preparedBy}` : null,
      opts.reviewedBy ? `Reviewed By: ${opts.reviewedBy}` : null,
      opts.approvedBy ? `Approved By: ${opts.approvedBy}` : null,
    ]
      .filter(Boolean)
      .join("   |   ");
    if (sigLine) {
      doc.fontSize(9).fillColor("#6B7280").text(sigLine);
    }
    doc.moveDown(0.5);

    if (opts.executiveSummary) {
      doc.fontSize(11).fillColor("#111827").text("Executive Summary", { underline: true });
      doc.fontSize(10).fillColor("#374151").text(opts.executiveSummary);
      doc.moveDown(0.5);
    }

    if (opts.kpis.length) {
      doc.fontSize(11).fillColor("#111827").text("Key Performance Indicators", { underline: true });
      doc.moveDown(0.2);
      const colWidth = 130;
      let x = doc.x;
      let y = doc.y;
      opts.kpis.forEach((kpi, i) => {
        if (i > 0 && i % 4 === 0) {
          y += 34;
          x = doc.page.margins.left;
        }
        doc.rect(x, y, colWidth - 8, 30).fill("#F3F4F6");
        doc.fillColor("#6B7280").fontSize(8).text(kpi.label, x + 6, y + 5, { width: colWidth - 20 });
        doc.fillColor("#111827").fontSize(11).text(kpi.value, x + 6, y + 16, { width: colWidth - 20 });
        x += colWidth;
      });
      doc.y = y + 40;
      doc.x = doc.page.margins.left;
      doc.moveDown(1);
    }

    if (opts.tableColumns.length) {
      doc.fontSize(11).fillColor("#111827").text("Detail", { underline: true });
      doc.moveDown(0.3);
      const startX = doc.page.margins.left;
      let y = doc.y;
      const colWidths = opts.tableColumns.map((c) => c.width ?? 90);

      const drawHeader = () => {
        let x = startX;
        doc.fontSize(9).fillColor("#FFFFFF");
        opts.tableColumns.forEach((c, i) => {
          doc.rect(x, y, colWidths[i], 20).fill("#1F2937");
          doc.fillColor("#FFFFFF").text(c.header, x + 4, y + 5, { width: colWidths[i] - 8 });
          x += colWidths[i];
        });
        y += 20;
      };

      drawHeader();
      opts.tableRows.forEach((row, rowIdx) => {
        if (y > doc.page.height - doc.page.margins.bottom - 30) {
          doc.addPage();
          y = doc.page.margins.top;
          drawHeader();
        }
        let x = startX;
        if (rowIdx % 2 === 0) {
          doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 18).fill("#F9FAFB");
        }
        doc.fontSize(8).fillColor("#111827");
        opts.tableColumns.forEach((c, i) => {
          doc.text(String(row[c.key] ?? ""), x + 4, y + 4, { width: colWidths[i] - 8 });
          x += colWidths[i];
        });
        y += 18;
      });
      doc.y = y;
    }

    if (opts.notes) {
      doc.moveDown(1);
      doc.fontSize(9).fillColor("#6B7280").text(`Notes: ${opts.notes}`);
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor("#9CA3AF")
        .text(`Page ${i + 1} of ${range.count}`, 0, doc.page.height - 30, { align: "center" });
    }

    doc.end();
  });
}
