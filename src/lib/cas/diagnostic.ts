/**
 * "Statement didn't parse right?" — builds an anonymised, redacted diagnostic the user can choose to share.
 *
 * Redaction happens in two stages and the raw statement text is never kept:
 *   1. redactPersonal(): runs once, right after text extraction. Removes name/address/e-mail/phone/PAN/folio/nominee
 *      lines, replaces every digit with 9 and every date with 99-Mmm-9999 (so amounts, units and folio numbers
 *      are gone but number *formats* survive). Only this redacted form is held in memory.
 *   2. maskFundNames(): optional, applied on demand — every word that isn't generic statement vocabulary becomes xxxx.
 * Nothing is ever sent anywhere by this code; the user copies or downloads the text themselves.
 */
import type { CASData } from "./types";

export interface DiagnosticLines {
  /** stage-1 redacted lines */
  lines: string[];
  /** indices into `lines` the parser couldn't make sense of */
  suspects: number[];
  error: { code: string; message: string } | null;
  pageCount?: number;
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PAN = /\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g;
const PHONE = /(?:\+\s?91[\s-]?)?\b[6-9]\d{9}\b/g;
const DATE = /\b\d{1,2}-[A-Za-z]{3}-\d{4}\b/g;
const FOLIO = /(Folio\s*No\.?\s*:?\s*)([A-Za-z0-9/ -]+?)(?=\s{2,}|\t|\s+PAN\b|\s+KYC\b|$)/gi;
const NOMINEE = /(Nominee\s*\d\s*:)(?:(?!Nominee\s*\d)[^\t])*/gi;

/** Generic statement vocabulary that is safe to keep when masking everything else. */
const SAFE_WORDS = new Set(
  `folio no pan kyc ok nominee opening closing unit units balance nav on inr rs total cost value market registrar cams kfintech kfin advisor direct regular plan growth option idcw
   dividend payout reinvestment reinvest reinvested fund mutual mf scheme isin non demat etf fof purchase redemption switch in out sip systematic investment instalment installment
   via internet stamp duty stt tds tax paid bonus allotted allotment nfo merger segregated portfolio creation transfer withdrawal swp stp reversal from to of the and per date
   transaction amount page statement consolidated account summary email id mobile e mail mmm sr nil na nri not available as at for by with a an is are this that please note
   units held depository units capital gain details sebi amc investor service request online offline ach nach mandate cheque dd neft rtgs upi cash systematic withdrawal
   instalment no deduction tax nav price load entry exit`
    .split(/\s+/)
    .filter(Boolean),
);

/** Mask every word that isn't safe vocabulary, keeping its length so wrapping/width problems stay diagnosable. */
export function maskWords(line: string): string {
  return line.replace(/\[[^\]]*\]|[A-Za-z][A-Za-z'’]*/g, (w) => (w.startsWith("[") || SAFE_WORDS.has(w.toLowerCase()) ? w : "x".repeat(w.length)));
}

const shape = (v: string) => v.replace(/[A-Za-z]/g, "A").replace(/\d/g, "9");

export function redactPersonal(rawLines: string[], secrets: (string | null | undefined)[] = []): string[] {
  const words = new Set<string>();
  for (const s of secrets) {
    if (!s || s.trim().length < 3) continue;
    words.add(s.trim());
    for (const w of s.split(/[\s,]+/)) if (w.replace(/\W/g, "").length >= 3 && !SAFE_WORDS.has(w.toLowerCase())) words.add(w);
  }
  const secretRe = words.size
    ? new RegExp([...words].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi")
    : null;

  // Header zone = everything before the first folio / AMC / summary line. Names and addresses live there.
  const firstBody = rawLines.findIndex((l) => /folio\s*no|mutual\s*fund\b|portfolio\s*summary|^\s*date\b/i.test(l));
  const headerEnd = firstBody < 0 ? Math.min(rawLines.length, 25) : firstBody;
  const emailAt = rawLines.findIndex((l, i) => i < headerEnd + 5 && /e-?mail\s*id\s*:/i.test(l));
  const personal = new Set<number>();
  if (emailAt >= 0) {
    const mobileAt = rawLines.findIndex((l, i) => i > emailAt && i <= emailAt + 10 && /mobile|phone|tel\b/i.test(l));
    const to = mobileAt >= 0 ? mobileAt : Math.min(emailAt + 8, headerEnd - 1);
    for (let i = emailAt; i <= to; i++) personal.add(i);
  }

  return rawLines.map((raw, i) => {
    if (personal.has(i)) return "[personal details line]";
    let l = raw.replace(/ /g, " ");
    if (secretRe) l = l.replace(secretRe, "[redacted]");
    l = l
      .replace(EMAIL, "[email]")
      .replace(PAN, "[PAN]")
      .replace(PHONE, "[phone]")
      .replace(NOMINEE, "$1 [nominee]")
      .replace(FOLIO, (_m, label: string, value: string) => `${label}${shape(value.trim())}`)
      .replace(DATE, "99-Mmm-9999")
      .replace(/\d/g, "9");
    if (i < headerEnd) l = maskWords(l); // the header zone can hold names/addresses we can't enumerate
    return l;
  });
}

export function maskFundNames(lines: string[]): string[] {
  return lines.map(maskWords);
}

/** Pick a useful, bounded subset of lines: the header, every suspect line with context, and a sample of the rest. */
export function selectLines(d: DiagnosticLines, max = 320): string[] {
  const keep = new Set<number>();
  for (let i = 0; i < Math.min(d.lines.length, 30); i++) keep.add(i);
  for (const s of d.suspects) for (let i = s - 2; i <= s + 1; i++) if (i >= 0 && i < d.lines.length) keep.add(i);
  for (let i = 30; i < d.lines.length && keep.size < max; i++) keep.add(i);
  const idx = [...keep].sort((a, b) => a - b).slice(0, max);
  const out: string[] = [];
  idx.forEach((n, k) => {
    if (k > 0 && n !== idx[k - 1] + 1) out.push(`…(${n - idx[k - 1] - 1} lines omitted)…`);
    out.push(`${d.suspects.includes(n) ? "!! " : "   "}${d.lines[n]}`);
  });
  if (idx.length && idx[idx.length - 1] < d.lines.length - 1) out.push(`…(${d.lines.length - 1 - idx[idx.length - 1]} more lines omitted)…`);
  return out;
}

export interface ReportOptions {
  includeFundNames: boolean;
  note?: string;
  appVersion?: string;
  generatedOn?: string;
}

/** Structural summary of the parse — counts and reconciliation only; no names, amounts or identifiers. */
export function summarise(cas: CASData | null, includeFundNames: boolean): string[] {
  if (!cas) return ["parse result: none (parsing stopped before a statement was built)"];
  const out: string[] = [];
  const schemes = cas.folios.flatMap((f) => f.schemes);
  const txns = schemes.flatMap((s) => s.transactions);
  const hist = new Map<string, number>();
  for (const t of txns) hist.set(t.type, (hist.get(t.type) ?? 0) + 1);
  out.push(`statement type: ${cas.casType}; period present: ${cas.statementPeriod.from && cas.statementPeriod.to ? "yes" : "no"}`);
  out.push(`folios: ${cas.folios.length}; schemes: ${schemes.length}; transactions: ${txns.length}`);
  out.push(`distinct PANs: ${new Set(cas.folios.map((f) => f.pan).filter(Boolean)).size}`);
  out.push(`transaction types: ${[...hist.entries()].map(([k, v]) => `${k}×${v}`).join(", ") || "none"}`);
  schemes.forEach((s, i) => {
    const sum = s.transactions.reduce((a, t) => a + (t.units ?? 0), s.open);
    const diff = Math.round((sum - s.close) * 1000) / 1000;
    const tag = includeFundNames ? ` ${s.name}` : "";
    out.push(
      `  scheme #${i + 1}${tag}: txns=${s.transactions.length} openingUnits>0=${s.open > 0} closingUnits>0=${s.close > 0} unitsReconcile=${Math.abs(diff) < 0.01 + Math.abs(s.close) * 1e-6 ? "yes" : `NO (off by ${diff})`} valuationLine=${s.valuation.value != null ? "yes" : "no"} isin=${s.isin ? "yes" : "no"} advisor=${s.advisor ? "yes" : "no"}`,
    );
  });
  const names = schemes.map((s) => s.name);
  for (const w of cas.warnings) {
    let m = w;
    if (!includeFundNames) names.forEach((n, i) => (m = m.split(n).join(`scheme #${i + 1}`)));
    out.push(`warning: ${m}`);
  }
  return out;
}

export function buildReport(d: DiagnosticLines, cas: CASData | null, o: ReportOptions): string {
  const lines = o.includeFundNames ? d.lines : maskFundNames(d.lines);
  const sel = selectLines({ ...d, lines }, 320);
  return [
    "MF X-ray diagnostic report (anonymised)",
    `generated: ${o.generatedOn ?? new Date().toISOString().slice(0, 10)}   app: ${o.appVersion ?? "dev"}`,
    `fund names: ${o.includeFundNames ? "INCLUDED by the user" : "masked"}; personal details, folio numbers, PAN and all digits: removed`,
    d.error ? `outcome: ${d.error.code} — ${d.error.message}` : `outcome: parsed${cas?.warnings.length ? ` with ${cas.warnings.length} warning(s)` : ""}`,
    d.pageCount ? `pdf pages: ${d.pageCount}; text lines: ${d.lines.length}` : `text lines: ${d.lines.length}`,
    o.note?.trim() ? `\nuser note: ${o.note.trim()}` : "",
    "\n--- parse summary ---",
    ...summarise(cas, o.includeFundNames),
    "\n--- statement layout (redacted; '!!' marks lines the parser couldn't read) ---",
    ...sel,
    "",
  ]
    .filter((x, i, a) => !(x === "" && a[i - 1] === ""))
    .join("\n");
}

/** Last line of defence: true if the text still contains something that looks like an identifier. */
export function looksLeaky(text: string, secrets: (string | null | undefined)[] = []): string | null {
  if (new RegExp(EMAIL.source).test(text)) return "email";
  if (new RegExp(PAN.source).test(text)) return "PAN";
  // Masked digits are all 9s, which can look like a phone number — only count runs containing a real digit.
  if ((text.match(new RegExp(PHONE.source, "g")) ?? []).some((m) => /[0-8]/.test(m))) return "phone";
  for (const s of secrets) if (s && s.trim().length >= 3 && text.toLowerCase().includes(s.trim().toLowerCase())) return `secret:${s.slice(0, 3)}…`;
  if (/\d{4,}/.test(text.replace(/9{4,}/g, ""))) return "digits";
  return null;
}
