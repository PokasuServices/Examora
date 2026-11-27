import { BadRequestException, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import type { Response } from "express";

export interface SheetColumn {
  key: string;
  header: string;
  width?: number;
  /** Fixed values: becomes an in-cell dropdown in templates */
  options?: readonly string[];
  /** Hidden helper columns (ids used to match rows on upload) */
  hidden?: boolean;
  required?: boolean;
  note?: string;
}

export interface SheetSpec {
  name: string;
  columns: SheetColumn[];
  rows: Record<string, string | number | null | undefined>[];
  /** Lines for the "How to fill" sheet */
  instructions?: string[];
  /** Extra blank rows (with dropdowns) for templates */
  blankRows?: number;
  /** Rows to show above the header (titles, period) */
  title?: string;
}

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const BRAND = "FF4F46E5";

/**
 * Shared Excel toolkit (mentor module): every download has a matching
 * template in the same columns, and an upload reads it back by header.
 */
@Injectable()
export class ExcelService {
  async build(sheets: SheetSpec[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Examora";
    wb.created = new Date();
    const instructions = sheets.flatMap((s) => s.instructions ?? []);
    for (const spec of sheets) {
      const ws = wb.addWorksheet(spec.name.slice(0, 31));
      let headerRow = 1;
      if (spec.title) {
        ws.addRow([spec.title]).font = { bold: true, size: 13 };
        ws.addRow([]);
        headerRow = 3;
      }
      ws.addRow(spec.columns.map((c) => c.header + (c.required ? " *" : "")));
      const header = ws.getRow(headerRow);
      header.font = { bold: true, color: { argb: "FFFFFFFF" } };
      header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
      header.alignment = { vertical: "middle" };
      header.height = 20;
      spec.columns.forEach((c, i) => {
        const col = ws.getColumn(i + 1);
        col.width = c.width ?? Math.max(12, c.header.length + 4);
        if (c.hidden) col.hidden = true;
        if (c.note) header.getCell(i + 1).note = c.note;
      });
      for (const r of spec.rows) {
        ws.addRow(spec.columns.map((c) => r[c.key] ?? ""));
      }
      const last = headerRow + spec.rows.length + (spec.blankRows ?? 0);
      spec.columns.forEach((c, i) => {
        if (!c.options?.length) return;
        for (let row = headerRow + 1; row <= Math.max(last, headerRow + 1); row++) {
          ws.getCell(row, i + 1).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [`"${c.options.join(",")}"`],
            showErrorMessage: true,
            errorTitle: "Pick from the list",
            error: `Use one of: ${c.options.join(", ")}`,
          };
        }
      });
      ws.views = [{ state: "frozen", ySplit: headerRow }];
    }
    if (instructions.length) {
      const ws = wb.addWorksheet("How to fill");
      ws.getColumn(1).width = 110;
      ws.addRow(["How to fill this sheet"]).font = { bold: true, size: 13 };
      for (const line of instructions) ws.addRow([line]);
      ws.addRow([]);
      ws.addRow(["Columns marked * are required. Keep the header row as it is."]);
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  send(res: Response, fileName: string, buffer: Buffer): void {
    res.setHeader("Content-Type", XLSX);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName.replace(/[^\w.\- ]+/g, "_")}"`,
    );
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  }

  /**
   * Reads the first sheet back as rows keyed by column key, matched on the
   * header text (a trailing " *" is ignored). Empty rows are skipped; each
   * row carries its sheet row number as `__row`.
   */
  async read(
    contentBase64: string,
    columns: SheetColumn[],
  ): Promise<(Record<string, string> & { __row: string })[]> {
    let buffer: Buffer;
    try {
      buffer = Buffer.from(contentBase64, "base64");
    } catch {
      throw new BadRequestException("That file couldn't be read");
    }
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException("Upload an .xlsx file (use the template)");
    }
    const ws = wb.worksheets.find((w) => w.name !== "How to fill") ?? wb.worksheets[0];
    if (!ws) throw new BadRequestException("The file has no sheets");
    const clean = (v: string) =>
      v
        .replace(/\s*\*$/, "")
        .trim()
        .toLowerCase();
    // Find the header row (first row that names at least one known column).
    let headerAt = 0;
    let map = new Map<number, string>();
    for (let r = 1; r <= Math.min(ws.rowCount, 10) && !headerAt; r++) {
      const m = new Map<number, string>();
      ws.getRow(r).eachCell((cell, colNo) => {
        const text = clean(this.text(cell.value));
        const col = columns.find((c) => clean(c.header) === text);
        if (col) m.set(colNo, col.key);
      });
      if (m.size >= Math.min(2, columns.length)) {
        headerAt = r;
        map = m;
      }
    }
    if (!headerAt) {
      throw new BadRequestException(
        `Couldn't find the header row. Expected columns: ${columns.map((c) => c.header).join(", ")}`,
      );
    }
    const out: (Record<string, string> & { __row: string })[] = [];
    for (let r = headerAt + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const rec: Record<string, string> = {};
      let any = false;
      for (const [colNo, key] of map) {
        const v = this.text(row.getCell(colNo).value).trim();
        rec[key] = v;
        if (v && !columns.find((c) => c.key === key)?.hidden) any = true;
      }
      if (any) out.push({ ...rec, __row: String(r) });
    }
    return out;
  }

  /**
   * Reads a sheet whose columns aren't fixed (e.g. one column per class):
   * returns the header texts and each non-empty row's cell texts.
   */
  async readRaw(
    contentBase64: string,
    headerHint: string,
  ): Promise<{ headers: string[]; rows: { row: number; cells: string[] }[] }> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(Buffer.from(contentBase64, "base64") as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException("Upload an .xlsx file (use the template)");
    }
    const ws = wb.worksheets.find((w) => w.name !== "How to fill") ?? wb.worksheets[0];
    if (!ws) throw new BadRequestException("The file has no sheets");
    let headerAt = 0;
    for (let r = 1; r <= Math.min(ws.rowCount, 10) && !headerAt; r++) {
      ws.getRow(r).eachCell((cell) => {
        if (
          this.text(cell.value)
            .replace(/\s*\*$/, "")
            .trim()
            .toLowerCase() === headerHint.toLowerCase()
        ) {
          headerAt = r;
        }
      });
    }
    if (!headerAt) throw new BadRequestException(`Couldn't find the "${headerHint}" header row`);
    const width = ws.getRow(headerAt).cellCount;
    const cellsOf = (r: number) =>
      Array.from({ length: width }, (_, i) => this.text(ws.getRow(r).getCell(i + 1).value).trim());
    const headers = cellsOf(headerAt).map((h) => h.replace(/\s*\*$/, ""));
    const rows: { row: number; cells: string[] }[] = [];
    for (let r = headerAt + 1; r <= ws.rowCount; r++) {
      const cells = cellsOf(r);
      if (cells.some(Boolean)) rows.push({ row: r, cells });
    }
    return { headers, rows };
  }

  /** The failed rows of an upload with an "Error" column, base64. */
  async errorFile(
    name: string,
    columns: SheetColumn[],
    failed: { values: Record<string, string>; message: string }[],
  ): Promise<string | null> {
    if (failed.length === 0) return null;
    const buffer = await this.build([
      {
        name,
        columns: [...columns, { key: "__error", header: "Error", width: 50 }],
        rows: failed.map((f) => ({ ...f.values, __error: f.message })),
        instructions: ["Fix the rows below and upload this file again."],
      },
    ]);
    return buffer.toString("base64");
  }

  private text(v: ExcelJS.CellValue): string {
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "object") {
      if ("text" in v && typeof v.text === "string") return v.text;
      if ("result" in v) return this.text(v.result as ExcelJS.CellValue);
      if ("richText" in v) return v.richText.map((t) => t.text).join("");
      if ("hyperlink" in v) return String((v as { hyperlink: string }).hyperlink);
    }
    return String(v);
  }
}
