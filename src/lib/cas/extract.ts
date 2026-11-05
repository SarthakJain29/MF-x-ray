/**
 * Turns PDF text items into lines, joining visually separate columns with "\t\t".
 * Works with any pdf.js build (browser or Node legacy) – the caller passes the module in.
 */
import { CASParseError } from "./types";

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  height?: number;
}

interface PdfjsLike {
  getDocument(src: { data: Uint8Array; password?: string; isEvalSupported?: boolean; useSystemFonts?: boolean; verbosity?: number }): {
    promise: Promise<PdfDocumentLike>;
  };
}
interface PdfDocumentLike {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
  destroy?: () => Promise<void>;
}

/** Group text items into rows by their y coordinate and order them left→right. */
export function itemsToLines(items: TextItemLike[], columnGap = 8): string[] {
  const rows: { y: number; items: TextItemLike[] }[] = [];
  const sorted = items
    .filter((i) => typeof i.str === "string" && i.str.length > 0)
    .sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  for (const item of sorted) {
    const y = item.transform[5];
    const tol = Math.max(2, (item.height ?? 8) * 0.35);
    const row = rows.find((r) => Math.abs(r.y - y) <= tol);
    if (row) row.items.push(item);
    else rows.push({ y, items: [item] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((row) => {
    const its = row.items.sort((a, b) => a.transform[4] - b.transform[4]);
    let out = "";
    let prevEnd: number | null = null;
    for (const it of its) {
      // pdf.js inserts whitespace-only items to fill gaps; measure gaps between real glyph runs instead.
      if (it.str.trim() === "") continue;
      const x = it.transform[4];
      if (prevEnd !== null) {
        const gap = x - prevEnd;
        if (gap > columnGap) out = out.replace(/\s+$/, "") + "\t\t";
        else if (gap > 0.8 && !out.endsWith(" ") && !it.str.startsWith(" ")) out += " ";
      }
      out += it.str;
      prevEnd = x + it.width;
    }
    return out.replace(/[ ]+/g, " ").trimEnd();
  });
}

export async function extractLines(pdfjs: PdfjsLike, data: Uint8Array, password?: string): Promise<string[]> {
  let doc: PdfDocumentLike;
  try {
    doc = await pdfjs.getDocument({ data, password, isEvalSupported: false, useSystemFonts: true, verbosity: 0 }).promise;
  } catch (e: unknown) {
    const err = e as { name?: string; code?: number; message?: string };
    if (err?.name === "PasswordException") {
      // pdf.js: code 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
      if (err.code === 2) throw new CASParseError("INCORRECT_PASSWORD", "That password didn't work. Try again.");
      throw new CASParseError("PASSWORD_REQUIRED", "This statement is password-protected.");
    }
    throw new CASParseError("UNKNOWN", `Could not open the PDF: ${err?.message ?? String(e)}`);
  }
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    lines.push(...itemsToLines(content.items as TextItemLike[]));
  }
  await doc.destroy?.();
  return lines;
}
