"use client";
/** Browser-only: open a CAS PDF with pdf.js (in a web worker) and parse it. Nothing is uploaded. */
import { extractLines } from "./extract";
import { parseCASLines } from "./parser";
import type { CASData } from "./types";

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

export async function parseCASFile(data: ArrayBuffer, password?: string): Promise<CASData> {
  const lib = await pdfjs();
  // pdf.js transfers the buffer to its worker, so pass a copy and keep the original for retries.
  const lines = await extractLines(lib as never, new Uint8Array(data.slice(0)), password);
  return parseCASLines(lines);
}
