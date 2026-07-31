import type { ReportResult } from "@examora/types";
import { ReportExportService } from "./report-export.service";

const SAMPLE_REPORT: ReportResult = {
  reportType: "ENROLLMENT",
  generatedAt: "2026-07-30T00:00:00.000Z",
  columns: ["studentEmail", "courseTitle", "status"],
  rows: [
    { studentEmail: "a@example.test", courseTitle: "Design 101", status: "ACTIVE" },
    { studentEmail: "b@example.test", courseTitle: 'Advanced, "Fashion"', status: "REVOKED" },
    { studentEmail: "c@example.test", courseTitle: null, status: "ACTIVE" },
  ],
};

describe("ReportExportService", () => {
  const service = new ReportExportService();

  describe("toCsv", () => {
    it("renders a header row followed by one row per record", () => {
      const csv = service.toCsv(SAMPLE_REPORT);
      const lines = csv.split("\n");
      expect(lines[0]).toBe("studentEmail,courseTitle,status");
      expect(lines).toHaveLength(4);
    });

    it("quotes and escapes fields containing commas or quotes", () => {
      const csv = service.toCsv(SAMPLE_REPORT);
      expect(csv).toContain('"Advanced, ""Fashion"""');
    });

    it("renders null values as empty fields", () => {
      const csv = service.toCsv(SAMPLE_REPORT);
      const lastLine = csv.split("\n").at(-1);
      expect(lastLine).toBe("c@example.test,,ACTIVE");
    });

    it("renders a header-only CSV for an empty report", () => {
      const csv = service.toCsv({ ...SAMPLE_REPORT, rows: [] });
      expect(csv).toBe("studentEmail,courseTitle,status");
    });
  });

  describe("toPdf", () => {
    it("produces a non-empty PDF buffer", async () => {
      const pdf = await service.toPdf(SAMPLE_REPORT);
      expect(pdf.length).toBeGreaterThan(0);
      expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    });

    it("handles an empty report without throwing", async () => {
      const pdf = await service.toPdf({ ...SAMPLE_REPORT, rows: [] });
      expect(pdf.length).toBeGreaterThan(0);
    });
  });
});
