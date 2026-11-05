// Builds public/data/ter.json (Total Expense Ratio, regular vs direct) from AMFI's public TER disclosure API.
// Usage: node scripts/build-ter-index.mjs [MM-YYYY ...]
// Defaults to last month + the current month. Later months override earlier ones, so schemes whose AMC
// hasn't filed for the current month yet still get last month's TER. (Last month is slow: ~650 pages.)
import { writeFile } from "node:fs/promises";

const BASE = "https://www.amfiindia.com/api/populate-te-rdata-revised";
const now = new Date();

const mm = (d) => `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
const months = process.argv.length > 2 ? process.argv.slice(2) : [mm(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))), mm(now)];
const PAGE = 100;
const CONCURRENCY = 6;

async function page(month, n, attempt = 0) {
  const url = `${BASE}?MF_ID=All&Month=${month}&strCat=-1&strType=-1&page=${n}&pageSize=${PAGE}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch (e) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      return page(month, n, attempt + 1);
    }
    console.warn(`page ${n} failed: ${e}`);
    return { data: [] };
  }
}

const latest = new Map(); // scheme name -> { d, r, dt, cat }
const ingest = (rows) => {
  for (const row of rows) {
    const name = String(row.Scheme_Name ?? "").trim();
    if (!name) continue;
    const prevRow = latest.get(name);
    if (prevRow && prevRow.dt >= row.TER_Date) continue;
    latest.set(name, { r: parseFloat(row.R_TER), d: parseFloat(row.D_TER), dt: row.TER_Date, cat: row.SchemeCat_Desc });
  }
};

async function write() {
  const schemes = {};
  for (const [name, v] of [...latest.entries()].sort()) {
    schemes[name] = [Number.isFinite(v.r) ? v.r : null, Number.isFinite(v.d) ? v.d : null];
  }
  const out = { source: "AMFI TER disclosure (amfiindia.com/ter-of-mf-schemes)", month: months[months.length - 1], months, generatedAt: new Date().toISOString().slice(0, 10), schemes };
  await writeFile(new URL("../public/data/ter.json", import.meta.url), JSON.stringify(out));
  console.log(`Wrote TER for ${latest.size} schemes`);
}

for (const month of months) {
  const first = await page(month, 1);
  const pageCount = first.meta?.pageCount ?? 1;
  console.log(`Month ${month}: ${first.meta?.total} rows over ${pageCount} pages`);
  ingest(first.data ?? []);
  let next = 2;
  let done = 1;
  const worker = async () => {
    while (next <= pageCount) {
      const n = next++;
      const res = await page(month, n);
      ingest(res.data ?? []);
      if (++done % 50 === 0) console.log(`  ${done}/${pageCount}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}
await write();
