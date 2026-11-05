// Builds public/data/schemes.json from AMFI's public NAVAll.txt.
// Usage: node scripts/build-scheme-index.mjs [path-to-NAVAll.txt]
// Without an argument the file is downloaded from amfiindia.com.
import { readFile, writeFile } from "node:fs/promises";

const SRC = "https://www.amfiindia.com/spages/NAVAll.txt";
const MAX_AGE_DAYS = 730; // drop schemes whose last NAV is older than ~2 years

async function load() {
  const arg = process.argv[2];
  if (arg) return readFile(arg, "utf8");
  const res = await fetch(SRC);
  if (!res.ok) throw new Error(`AMFI download failed: ${res.status}`);
  return res.text();
}

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function parseDate(s) {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(s.trim());
  if (!m) return null;
  return new Date(Date.UTC(+m[3], MONTHS[m[2]], +m[1]));
}

const text = await load();
const categories = [];
const amcs = [];
const idx = (arr, v) => {
  let i = arr.indexOf(v);
  if (i === -1) { arr.push(v); i = arr.length - 1; }
  return i;
};
let category = "Unknown";
let amc = "Unknown";
let latest = 0;
const rows = [];
for (const raw of text.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("Scheme Code")) continue;
  const parts = line.split(";");
  if (parts.length < 8) {
    const cm = /^(Open Ended|Close Ended|Interval Fund)[^(]*\((.+)\)\s*$/i.exec(line);
    if (cm) category = cm[2].trim();
    else amc = line;
    continue;
  }
  const [code, isinG, isinR, name, plan, option, nav, date] = parts.map((p) => p.trim());
  const d = parseDate(date);
  if (!d) continue;
  latest = Math.max(latest, d.getTime());
  const fullName = [name.replace(/\s*-\s*$/, ""), plan, option].filter(Boolean).join(" - ");
  rows.push({ code: +code, isinG: isinG === "-" ? "" : isinG, isinR: isinR === "-" ? "" : isinR, fullName, category, amc, nav: +nav || 0, d });
}
const cutoff = latest - MAX_AGE_DAYS * 86400000;
const schemes = rows
  .filter((r) => r.d.getTime() >= cutoff)
  .map((r) => [r.code, r.isinG, r.isinR, r.fullName, idx(categories, r.category), idx(amcs, r.amc), r.nav, r.d.toISOString().slice(0, 10)]);

const out = { source: SRC, generatedAt: new Date().toISOString().slice(0, 10), categories, amcs, schemes };
await writeFile(new URL("../public/data/schemes.json", import.meta.url), JSON.stringify(out));
console.log(`Wrote ${schemes.length} schemes, ${categories.length} categories, ${amcs.length} AMCs`);
