// agent/tools/make_document.ts: Builds a CSV, Excel, Word, PowerPoint, or PDF file from a table the agent already has, and returns it as base64 so the chat app can save it.
import { defineTool } from "eve/tools";
import { z } from "zod";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, WidthType } from "docx";
import PptxGenJS from "pptxgenjs";
import { PDFDocument, StandardFonts } from "pdf-lib";

const MIME = {
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
} as const;

type Cell = string | number;

// Escapes one CSV cell: wraps it in quotes when it has a comma, quote, or line break.
function csvCell(value: Cell) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function tableCell(text: Cell) {
  return new TableCell({ children: [new Paragraph(String(text))] });
}

export default defineTool({
  description:
    "Make a CSV, Excel, Word, PowerPoint, or PDF file from a title and one table of rows. Use it after a report tool returns the data. Returns the file so the chat app can save it.",
  inputSchema: z.object({
    title: z.string().describe("The file title, for example 'WooCommerce sales, 2026'"),
    format: z.enum(["csv", "xlsx", "docx", "pptx", "pdf"]).describe("csv, xlsx for Excel, docx for Word, pptx for PowerPoint, pdf for PDF"),
    headers: z.array(z.string()).describe("Column headers, in order"),
    rows: z.array(z.array(z.union([z.string(), z.number()]))).describe("Rows of values, one array per row, in the same column order as headers"),
  }),
  async execute({ title, format, headers, rows }) {
    const fileName = `${title.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").toLowerCase() || "report"}.${format}`;
    const base = (bytes: Uint8Array | ArrayBuffer | Buffer) => ({
      fileName,
      mimeType: MIME[format],
      base64: Buffer.from(bytes as ArrayBuffer).toString("base64"),
    });

    if (format === "csv") {
      const text = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
      return base(new TextEncoder().encode(text));
    }

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet("Report");
      sheet.addRow(headers);
      rows.forEach((row) => sheet.addRow(row));
      return base(await wb.xlsx.writeBuffer());
    }

    if (format === "docx") {
      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({ children: headers.map(tableCell) }),
                  ...rows.map((row) => new TableRow({ children: row.map(tableCell) })),
                ],
              }),
            ],
          },
        ],
      });
      return base(await Packer.toBuffer(doc));
    }

    if (format === "pptx") {
      const pptx = new PptxGenJS();
      const slide = pptx.addSlide();
      slide.addText(title, { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 26, bold: true });
      slide.addTable(
        [headers.map((h) => ({ text: h })), ...rows.map((row) => row.map((v) => ({ text: String(v) })))],
        { x: 0.5, y: 1.3, w: 9, fontSize: 14 },
      );
      return base((await pptx.write({ outputType: "nodebuffer" })) as Buffer);
    }

    // PDF: a plain page with the title and one line per row.
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([595, 842]);
    let y = 800;
    const line = (text: string, size = 11) => {
      page.drawText(text, { x: 50, y, size, font });
      y -= size + 8;
    };
    line(title, 18);
    y -= 6;
    line(headers.join(" | "), 12);
    rows.forEach((row) => line(row.map(String).join(" | ")));
    return base(await pdf.save());
  },
});