/**
 * Generic parser for SEBI-format monthly portfolio disclosures (one sheet per scheme, a header row with
 * "ISIN" and "% to NAV/Net Assets", sections for equity / debt / derivatives). Works across AMCs because SEBI
 * prescribes the columns; only the layout details (column order, %-as-fraction vs percent, title rows) vary.
 */
import * as XLSX from "xlsx";

export interface ParsedHolding {
  isin: string;
  name: string;
  industry: string;
  /** % of net assets (0-100) */
  weight: number;
  kind: "equity" | "foreign-equity" | "debt" | "fund-units" | "reit-invit" | "other";
}

export interface ParsedScheme {
  sheet: string;
  name: string;
  holdings: ParsedHolding[];
  /** % of net assets in equity (Indian + foreign) */
  equityPct: number;
  /** derivatives seen (hedged / arbitrage positions) */
  hasDerivatives: boolean;
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

export function isinKind(isin: string, section: string): ParsedHolding["kind"] {
  if (isin.startsWith("INF")) return "fund-units";
  if (isin.startsWith("IN") && isin[2] === "E") {
    const type = isin.slice(7, 9);
    if (type === "01" || type === "02") return "equity"; // equity shares (01) / partly-paid (02)
    if (type === "23" || type === "24") return "reit-invit";
    return "debt";
  }
  if (isin.startsWith("IN")) return /equity/.test(section) ? "equity" : "debt"; // IN0/IN1/IN2 govt securities, IN9 partly paid
  return /equity|foreign|overseas|international/.test(section) ? "foreign-equity" : "other";
}

const cellStr = (v: unknown) => (v == null ? "" : String(v)).replace(/\s+/g, " ").trim();

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = cellStr(v).replace(/[,%$]/g, "");
  if (!s || s === "-" || /^n\.?a\.?$/i.test(s)) return null;
  const n = parseFloat(s.replace(/^\((.*)\)$/, "-$1"));
  return Number.isFinite(n) ? n : null;
}

function findHeader(rows: unknown[][]) {
  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    const cells = rows[r].map(cellStr);
    const isinCol = cells.findIndex((c) => /^isin( code| no\.?| number)?$/i.test(c) || /\bisin\b/i.test(c) && c.length < 20);
    const pctCol = cells.findIndex((c) => /%|percent|perc\./i.test(c) && /(net ?asset|nav|aum|total|portfolio|net)/i.test(c));
    if (isinCol >= 0 && pctCol >= 0) {
      const nameCol = cells.findIndex((c, i) => i !== isinCol && /(name of (the )?(instrument|security|issuer)|instrument|security name|company|name of the issuer|issuer)/i.test(c));
      const industryCol = cells.findIndex((c) => /industry|sector|rating/i.test(c));
      return { row: r, isinCol, pctCol, nameCol, industryCol };
    }
  }
  return null;
}

const TITLE_SKIP = /investment manager|asset management|registered office|\bCIN\b|trustee|^an? open[ -]?ended|monthly portfolio|portfolio (statement )?as on|as on \d|statement of|suitable for|risk-?o-?meter|^index$|^back to index|^sr\.? ?no|benchmark|^\(an? /i;

export function cleanSchemeName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^(monthly |half yearly )?portfolio( statement)? of /i, "")
    .replace(/^scheme name\s*:?\s*/i, "")
    .replace(/\s*\((an? |erstwhile|formerly|previously|earlier|known)[^)]*\)?.*$/i, "")
    .replace(/\s*-\s*portfolio.*$/i, "")
    .replace(/\s+as on .*$/i, "")
    .replace(/[\s:,-]+$/, "")
    .trim();
}

function schemeNameFrom(rows: unknown[][], headerRow: number, sheet: string): string {
  const candidates: string[] = [];
  for (let r = 0; r < Math.min(headerRow + 1, 15); r++) {
    const row = rows[r] ?? [];
    for (let i = 0; i < row.length; i++) {
      const s = cellStr(row[i]);
      // "SCHEME NAME :" | "SBI Large and Midcap Fund"
      if (/^(scheme|fund)( name)?\s*:?$/i.test(s)) {
        const next = row.slice(i + 1).map(cellStr).find((x) => x.length > 3);
        if (next) return cleanSchemeName(next);
      }
    }
    for (const c of row) {
      const s = cellStr(c);
      if (s.length < 6 || s.length > 220 || TITLE_SKIP.test(s) || /^[\w& .-]*mutual fund$/i.test(s)) continue;
      if (/\b(fund|etf|fof|scheme|plan|index|bees|portfolio)\b/i.test(s)) candidates.push(s);
    }
  }
  const best = candidates.find((s) => /\b(fund|etf|fof)\b/i.test(s)) ?? candidates[0];
  return best ? cleanSchemeName(best) : sheet;
}

export function parseSheet(sheetName: string, rows: unknown[][]): ParsedScheme | null {
  const h = findHeader(rows);
  if (!h) return null;
  const raw: { isin: string; name: string; industry: string; w: number; section: string }[] = [];
  let section = "equity";
  let hasDerivatives = false;
  for (let r = h.row + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const isin = cellStr(row[h.isinCol]).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const label = cellStr(h.nameCol >= 0 ? row[h.nameCol] : row.find((c) => typeof c === "string" && c.trim())) || cellStr(row.find((c) => typeof c === "string" && cellStr(c).length > 3));
    if (!ISIN_RE.test(isin)) {
      // section headers have no ISIN
      const t = label.toLowerCase();
      if (/derivative|futures?|options?\b|stock future|index future/.test(t)) section = "derivatives";
      else if (/^(a\)|b\)|\(a\)|\(b\))?\s*equity|equity & equity|equity and equity|equity shares/.test(t)) section = "equity";
      else if (/foreign|overseas|international|adr|gdr/.test(t) && /equit|securit|share/.test(t)) section = "foreign equity";
      else if (/debt|money market|treasury|t-?bill|commercial paper|certificate of deposit|government|g-?sec|bonds?|debenture|ncd|repo|treps|cblo|cash|net receivable|net current|margin|fixed deposit|deposits/.test(t)) section = "debt";
      else if (/mutual fund units|units of|investment funds|reit|invit|alternative/.test(t)) section = "other";
      continue;
    }
    const w = toNumber(row[h.pctCol]);
    if (w == null || w === 0) continue;
    if (section === "derivatives") hasDerivatives = true;
    raw.push({ isin, name: label, industry: h.industryCol >= 0 ? cellStr(row[h.industryCol]) : "", w, section });
  }
  if (!raw.length) return null;

  const positives = raw.filter((x) => x.w > 0 && x.section !== "derivatives");
  const sum = positives.reduce((s, x) => s + x.w, 0);
  const scale = sum > 2.5 ? 1 : 100; // fraction (0-1) vs percent (0-100)

  const byIsin = new Map<string, ParsedHolding>();
  for (const x of positives) {
    const kind = isinKind(x.isin, x.section);
    const prev = byIsin.get(x.isin);
    const weight = x.w * scale;
    if (prev) prev.weight += weight;
    else byIsin.set(x.isin, { isin: x.isin, name: x.name, industry: /^(aaa|aa|a1|sov|crisil|icra|care|ind|fitch|brickwork|unrated)/i.test(x.industry) ? "" : x.industry, weight, kind });
  }
  const holdings = [...byIsin.values()].sort((a, b) => b.weight - a.weight);
  const equityPct = holdings.filter((x) => x.kind === "equity" || x.kind === "foreign-equity").reduce((s, x) => s + x.weight, 0);
  return { sheet: sheetName, name: schemeNameFrom(rows, h.row, sheetName), holdings, equityPct, hasDerivatives };
}

/** Many AMC workbooks have an "Index" sheet mapping sheet codes to full scheme names. */
function indexNames(wb: XLSX.WorkBook): Map<string, string> {
  const map = new Map<string, string>();
  const sheets = new Set(wb.SheetNames.map((s) => s.trim().toUpperCase()));
  for (const name of wb.SheetNames.filter((n) => /index|contents|summary/i.test(n))) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: "", blankrows: false });
    for (const row of rows) {
      const cells = row.map(cellStr);
      const code = cells.find((c) => sheets.has(c.toUpperCase()));
      const full = cells.filter((c) => c.length > 8 && /fund|etf|fof|plan|scheme/i.test(c)).sort((a, b) => b.length - a.length)[0];
      if (code && full) map.set(code.toUpperCase(), cleanSchemeName(full));
    }
  }
  return map;
}

export function parseWorkbook(data: ArrayBuffer | Uint8Array | Buffer): ParsedScheme[] {
  const wb = XLSX.read(data, { type: "buffer", cellDates: false, dense: true });
  const idx = indexNames(wb);
  const out: ParsedScheme[] = [];
  for (const sheet of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, raw: true, defval: "", blankrows: false });
    const s = parseSheet(sheet, rows);
    if (!s) continue;
    const fromIndex = idx.get(sheet.trim().toUpperCase());
    // Prefer the in-sheet title when it looks like a real scheme name; else the index entry.
    if (fromIndex && (!/\b(fund|etf|fof)\b/i.test(s.name) || s.name === sheet)) s.name = fromIndex;
    out.push(s);
  }
  return out;
}
