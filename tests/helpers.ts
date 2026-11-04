import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractLines } from "@/lib/cas/extract";
import { parseCASLines } from "@/lib/cas/parser";
import { SchemeIndex, type SchemeIndexFile } from "@/lib/data/schemeIndex";
import { TerIndex, type TerFile } from "@/lib/data/ter";

export const ROOT = path.resolve(__dirname, "..");

export async function samplePdfLines(password = "mfxray") {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(path.join(ROOT, "public/sample/sample-cas.pdf")));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return extractLines(pdfjs as any, data, password);
}

export async function sampleCas() {
  return parseCASLines(await samplePdfLines());
}

export async function loadIndexes() {
  const schemes = JSON.parse(await readFile(path.join(ROOT, "public/data/schemes.json"), "utf8")) as SchemeIndexFile;
  let ter: TerIndex | null = null;
  try {
    ter = new TerIndex(JSON.parse(await readFile(path.join(ROOT, "public/data/ter.json"), "utf8")) as TerFile);
  } catch {
    ter = null;
  }
  return { schemeIndex: new SchemeIndex(schemes), terIndex: ter };
}

export async function expected() {
  return JSON.parse(await readFile(path.join(ROOT, "tests/fixtures/sample-cas.expected.json"), "utf8"));
}
