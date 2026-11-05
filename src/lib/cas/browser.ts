"use client";
/** Browser-only: open a CAS PDF with pdf.js (in a web worker) and parse it. Nothing is uploaded. */
import { extractLines } from "./extract";
import { findSuspectLines, parseCASLines } from "./parser";
import { redactPersonal, type DiagnosticLines } from "./diagnostic";
import { CASParseError, type CASData } from "./types";

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return m;
    });
  }
  return pdfjsPromise;
}

/** Everything personal we know about from a successful parse — used to scrub the diagnostic. */
export function secretsOf(cas: CASData): string[] {
  const out: (string | null)[] = [cas.investor.name, cas.investor.email, cas.investor.mobile, cas.investor.address];
  for (const f of cas.folios) out.push(f.pan, f.folio, ...f.folio.split(/[\s/]+/));
  return out.filter((x): x is string => !!x && x.length >= 3);
}

export interface ParsedFile {
  cas: CASData;
  /** Redacted layout, kept in memory only so the user can opt to share it if something looks wrong. */
  diagnostic: DiagnosticLines;
}

export async function parseCASFile(data: ArrayBuffer, password?: string): Promise<ParsedFile> {
  const lib = await pdfjs();
  // pdf.js transfers the buffer to its worker, so pass a copy and keep the original for retries.
  const lines = await extractLines(lib as never, new Uint8Array(data.slice(0)), password);
  const suspects = findSuspectLines(lines);
  try {
    const cas = parseCASLines(lines);
    return { cas, diagnostic: { lines: redactPersonal(lines, secretsOf(cas)), suspects, error: null } };
  } catch (e) {
    const err =
      e instanceof CASParseError ? e : new CASParseError("UNKNOWN", `Something unexpected happened while reading this statement (${(e as Error)?.message ?? "unknown error"}).`);
    // Raw text is dropped here; only the redacted layout survives.
    err.diagnostic = { lines: redactPersonal(lines), suspects, error: { code: err.code, message: err.message } };
    throw err;
  }
}
