// Copies the pdf.js worker into /public so the browser can load it from our own origin (no CDN).
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const dest = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "public", "pdf.worker.min.mjs");
await mkdir(path.dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log("pdf.worker copied to public/");
