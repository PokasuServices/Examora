import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import type { ReportResult } from "@examora/types";

/** Renders a ReportResult as CSV or PDF bytes (ADR-0020 §4) — no persistence, streamed on demand. */
@Injectable()
export class ReportExportService {
  toCsv(report: ReportResult): string {
    const escape = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const lines = [report.columns.map(escape).join(",")];
    for (const row of report.rows) {
      lines.push(report.columns.map((col) => escape(row[col])).join(","));
    }
    return lines.join("\n");
  }

  async toPdf(report: ReportResult): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(16).text(`${report.reportType.replace(/_/g, " ")} Report`, { align: "left" });
      doc
        .fontSize(9)
        .fillColor("gray")
        .text(`Generated ${report.generatedAt} — ${report.rows.length} row(s)`);
      doc.moveDown();
      doc.fillColor("black");

      const columnWidth = Math.max(
        60,
        Math.floor((doc.page.width - 80) / Math.max(1, report.columns.length)),
      );
      const startX = doc.x;

      const drawRow = (values: string[], bold: boolean): void => {
        const y = doc.y;
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
        values.forEach((value, i) => {
          doc.text(value, startX + i * columnWidth, y, { width: columnWidth - 4, ellipsis: true });
        });
        doc.moveDown(0.6);
      };

      drawRow(report.columns, true);
      for (const row of report.rows) {
        if (doc.y > doc.page.height - 60) {
          doc.addPage();
        }
        drawRow(
          report.columns.map((col) => {
            const value = row[col];
            return value === null || value === undefined ? "" : String(value);
          }),
          false,
        );
      }

      doc.end();
    });
  }
}
