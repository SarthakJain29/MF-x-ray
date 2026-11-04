/**
 * Parser for CAMS / KFintech "Detailed" Consolidated Account Statements.
 *
 * Input is the statement as text lines, where columns that were visually separated in the PDF are
 * joined with a double tab ("\t\t") — see extract.ts. Keeping the parser text-only makes it fully
 * testable without PDFs and independent of the PDF library.
 */
import { CASData, CASFolio, CASParseError, CASScheme, Transaction, TransactionType } from "./types";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function parseCASDate(s: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return null;
  return `${m[3]}-${String(mon).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** Parses "1,23,456.78", "(1,234.50)" or "-12.3" into a number. */
export function parseAmount(s: string | undefined | null): number | null {
  if (s == null) return null;
  const t = s.trim();
  if (!t) return null;
  const neg = /^\(.*\)$/.test(t) || t.startsWith("-");
  const cleaned = t.replace(/[(),\s]/g, "").replace(/^-/, "").replace(/^INR/i, "");
  if (!/^\d*\.?\d+$/.test(cleaned)) return null;
  const v = parseFloat(cleaned);
  return neg ? -v : v;
}

const DATE = String.raw`\d{2}-[A-Za-z]{3}-\d{4}`;
const NUM = String.raw`\(?-?[\d,]*\.?\d+\)?`;
const RE = {
  period: new RegExp(`(${DATE})\\s+to\\s+(${DATE})`, "i"),
  casDetailed: /consolidated\s+account\s+statement/i,
  casSummary: /consolidated\s+account\s+summary/i,
  email: /^\s*Email\s+Id\s*:\s*(\S+@\S+)/i,
  mobile: /Mobile\s*:\s*([+\d\s-]{8,})/i,
  amc: /^\s*([A-Za-z0-9&.' -]+?\s+(?:MF|Mutual\s*Fund)|Franklin\s+Templeton\s+Investments)\s*$/i,
  folio: /Folio\s+No\s*:\s*([\w/ -]+?)(?:\s{2,}|\t|\s+PAN|\s+KYC|$)/i,
  pan: /PAN\s*:\s*([A-Z]{5}\d{4}[A-Z])/,
  kyc: /KYC\s*:\s*(OK|NOT\s+OK)/i,
  schemeStart: /^\s*([A-Z0-9]{2,15})\s*-\s*(?!\d{2}-[A-Za-z]{3})(.+)$/,
  registrar: /(?:Registrar|RTA)\s*:\s*([A-Za-z ]+?)\s*$/i,
  isin: /ISIN\s*:\s*([A-Z]{2}[A-Z0-9]{9}\d)/,
  advisor: /\(\s*Advisor\s*:\s*([^)]+)\)/i,
  open: /Opening\s+Unit\s+Balance\s*:?\s*([\d,.]+)/i,
  close: /Closing\s+Unit\s+Balance\s*:?\s*([\d,.]+)/i,
  nav: new RegExp(`NAV\\s+on\\s+(${DATE})\\s*:\\s*(?:INR|Rs\\.?|₹)?\\s*([\\d,.]+)`, "i"),
  cost: /(?:Total\s+)?Cost\s+Value\s*:\s*(?:INR|Rs\.?|₹)?\s*([\d,.]+)/i,
  value: new RegExp(`(?:Market\\s+Value|Valuation)\\s+on\\s+(${DATE})\\s*:\\s*(?:INR|Rs\\.?|₹)?\\s*([\\d,.]+)`, "i"),
  txnStart: new RegExp(`^\\s*(${DATE})\\s*(?:\\t\\t|\\s)(.*)$`),
  txnLoose: new RegExp(`^\\s*(${DATE})\\s+(.+?)\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s*$`),
  txnTaxLoose: new RegExp(`^\\s*(${DATE})\\s+(.*?\\*\\*\\*.*?)\\s+(${NUM})\\s*$`),
  number: new RegExp(`^${NUM}$`),
};

export function classifyTransaction(description: string, units: number | null, amount: number | null): TransactionType {
  const d = description.toLowerCase();
  if (/stamp\s*duty/.test(d)) return "STAMP_DUTY_TAX";
  if (/\bstt\b|securities\s+transaction\s+tax/.test(d)) return "STT_TAX";
  if (/\btds\b|tax\s+deducted/.test(d)) return "TDS_TAX";
  if (/segregat/.test(d)) return "SEGREGATION";
  if (/reversal|rejection|reject/.test(d) || (/purchase|sip|systematic/.test(d) && (units ?? 0) < 0 && !/redemp/.test(d)))
    return "REVERSAL";
  if (/(idcw|dividend)/.test(d)) {
    if (/reinvest/.test(d)) return "DIVIDEND_REINVEST";
    if (/payout|paid|declared/.test(d) || units == null || units === 0) return "DIVIDEND_PAYOUT";
  }
  if (/switch|lateral/.test(d)) {
    if (/\bout\b|switch-out|switch\s*out|to\s/.test(d) || (units ?? 0) < 0) return "SWITCH_OUT";
    return "SWITCH_IN";
  }
  if (/redemp|redeem|withdraw|\bswp\b|systematic\s+withdrawal/.test(d) || (units ?? 0) < 0) return "REDEMPTION";
  if (/systematic|\bsip\b|instal?ment|\bstp\b/.test(d)) return "PURCHASE_SIP";
  if (/purchase|invest|subscri|\bnfo\b|new\s+fund/.test(d)) return "PURCHASE";
  if ((units ?? 0) > 0) return "PURCHASE";
  if ((amount ?? 0) !== 0 && units == null) return "MISC";
  return "MISC";
}

function parseTxnLine(line: string): Transaction | null {
  const start = RE.txnStart.exec(line);
  if (!start) return null;
  const date = parseCASDate(start[1]);
  if (!date) return null;
  const rest = start[2];

  let description = "";
  let nums: (number | null)[] = [];
  if (rest.includes("\t\t")) {
    const cols = rest.split("\t\t").map((c) => c.trim()).filter((c) => c.length > 0);
    // Numeric columns are at the end; everything before is the description.
    let i = cols.length;
    while (i > 0 && RE.number.test(cols[i - 1].replace(/\s/g, ""))) i--;
    description = cols.slice(0, i).join(" ").trim();
    nums = cols.slice(i).map((c) => parseAmount(c));
  } else {
    const loose = RE.txnLoose.exec(line);
    if (loose) {
      description = loose[2].trim();
      nums = [loose[3], loose[4], loose[5], loose[6]].map(parseAmount);
    } else {
      const tax = RE.txnTaxLoose.exec(line);
      if (!tax) return null;
      description = tax[2].trim();
      nums = [parseAmount(tax[3])];
    }
  }
  if (!description || nums.length === 0) return null;
  description = description.replace(/\*{3}/g, "").replace(/\s+/g, " ").trim();

  let amount: number | null = null;
  let units: number | null = null;
  let nav: number | null = null;
  let balance: number | null = null;
  if (nums.length >= 4) [amount, units, nav, balance] = nums.slice(-4);
  else if (nums.length === 3) [units, nav, balance] = nums; // unit-only rows (e.g. bonus, segregation)
  else if (nums.length === 2) [amount, units] = nums;
  else amount = nums[0];

  return { date, description, amount, units, nav, balance, type: classifyTransaction(description, units, amount) };
}

function emptyScheme(rtaCode: string | null, rawName: string): CASScheme {
  const isin = RE.isin.exec(rawName)?.[1] ?? null;
  const advisor = RE.advisor.exec(rawName)?.[1]?.trim() ?? null;
  const rta = RE.registrar.exec(rawName)?.[1]?.trim() ?? null;
  const name = rawName
    .replace(RE.registrar, "")
    .replace(RE.advisor, "")
    .replace(/\s*-?\s*ISIN\s*:\s*[A-Z0-9]{12}/, "")
    .replace(/\(\s*Non-?\s*Demat\s*\)/i, "")
    .replace(/\s+-\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    rtaCode,
    name,
    isin,
    advisor,
    rta,
    open: 0,
    close: 0,
    valuation: { date: null, nav: null, value: null, cost: null },
    transactions: [],
  };
}

export function parseCASLines(lines: string[]): CASData {
  const text = lines.join("\n");
  if (!text.trim()) throw new CASParseError("EMPTY", "The PDF did not contain any readable text.");
  const isDetailed = RE.casDetailed.test(text) && RE.open.test(text);
  if (!isDetailed) {
    if (RE.casSummary.test(text) || RE.casDetailed.test(text))
      throw new CASParseError(
        "SUMMARY_CAS",
        "This looks like a summary statement. Please request a *Detailed* CAS (with transaction history) from CAMS or KFintech.",
      );
    throw new CASParseError("NOT_A_CAS", "This doesn't look like a CAMS/KFintech Consolidated Account Statement.");
  }

  const data: CASData = {
    casType: "DETAILED",
    statementPeriod: { from: null, to: null },
    investor: { name: null, email: null, mobile: null, address: null },
    folios: [],
    warnings: [],
  };

  const period = RE.period.exec(text);
  if (period) data.statementPeriod = { from: parseCASDate(period[1]), to: parseCASDate(period[2]) };

  let currentAmc = "";
  let folio: CASFolio | null = null;
  let scheme: CASScheme | null = null;
  let pendingScheme: { code: string; text: string; lines: number } | null = null;
  let afterEmail = 0;
  const addressLines: string[] = [];

  const commitPending = () => {
    if (!pendingScheme || !folio) return;
    scheme = emptyScheme(pendingScheme.code, pendingScheme.text);
    folio.schemes.push(scheme);
    pendingScheme = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/ /g, " ");
    const flat = line.replace(/\t+/g, " ").replace(/\s+/g, " ").trim();
    if (!flat) continue;

    // Investor block (name + address follow the email line in CAMS statements).
    const em = RE.email.exec(flat);
    if (em && !data.investor.email) {
      data.investor.email = em[1];
      afterEmail = 1;
      continue;
    }
    if (afterEmail > 0 && !folio) {
      const mob = RE.mobile.exec(flat);
      if (mob) {
        data.investor.mobile = mob[1].trim();
        afterEmail = 0;
        data.investor.address = addressLines.join(", ") || null;
        continue;
      }
      if (afterEmail === 1) data.investor.name = flat;
      else if (afterEmail < 8 && !RE.amc.test(flat)) addressLines.push(flat);
      afterEmail++;
      if (afterEmail > 8) afterEmail = 0;
    }

    // Scheme header can wrap across lines until "Registrar : X" appears.
    if (pendingScheme) {
      pendingScheme.text += " " + flat;
      pendingScheme.lines++;
      if (RE.registrar.test(flat) || pendingScheme.lines >= 3) commitPending();
      continue;
    }

    const amc = RE.amc.exec(flat);
    if (amc && !/folio/i.test(flat) && !RE.txnStart.test(line)) {
      currentAmc = amc[1].replace(/\s+/g, " ").trim();
      continue;
    }

    const fm = RE.folio.exec(flat);
    if (fm) {
      const folioNo = fm[1].trim().replace(/\s+/g, " ");
      folio = {
        folio: folioNo,
        amc: currentAmc || "Unknown AMC",
        pan: RE.pan.exec(flat)?.[1] ?? null,
        kyc: RE.kyc.exec(flat)?.[1]?.toUpperCase() ?? null,
        schemes: [],
      };
      data.folios.push(folio);
      scheme = null;
      continue;
    }

    if (folio) {
      const txn = parseTxnLine(line);
      if (txn && scheme) {
        scheme.transactions.push(txn);
        continue;
      }

      const sm = RE.schemeStart.exec(flat);
      if (sm && !RE.open.test(flat) && !RE.close.test(flat) && !/^(nominee|folio|pan)/i.test(flat)) {
        if (RE.registrar.test(flat)) {
          scheme = emptyScheme(sm[1], sm[2]);
          folio.schemes.push(scheme);
        } else {
          pendingScheme = { code: sm[1], text: sm[2], lines: 1 };
        }
        continue;
      }

      if (scheme) {
        const s: CASScheme = scheme;
        const op = RE.open.exec(flat);
        if (op) s.open = parseAmount(op[1]) ?? 0;
        const cl = RE.close.exec(flat);
        if (cl) s.close = parseAmount(cl[1]) ?? 0;
        const nv = RE.nav.exec(flat);
        if (nv) {
          s.valuation.nav = parseAmount(nv[2]);
          s.valuation.date = parseCASDate(nv[1]);
        }
        const cv = RE.cost.exec(flat);
        if (cv) s.valuation.cost = parseAmount(cv[1]);
        const mv = RE.value.exec(flat);
        if (mv) {
          s.valuation.value = parseAmount(mv[2]);
          s.valuation.date = parseCASDate(mv[1]) ?? s.valuation.date;
        }
      }
    }
  }
  if (pendingScheme) commitPending();

  // Sanity checks: unit balance reconciliation.
  for (const f of data.folios) {
    for (const s of f.schemes) {
      const sum = s.transactions.reduce((acc, t) => acc + (t.units ?? 0), s.open);
      if (s.transactions.length > 0 && Math.abs(sum - s.close) > 0.01 + Math.abs(s.close) * 1e-6) {
        data.warnings.push(`Units for "${s.name}" don't reconcile (computed ${sum.toFixed(3)} vs closing ${s.close.toFixed(3)}).`);
      }
      if (s.valuation.value == null && s.valuation.nav != null) s.valuation.value = round2(s.close * s.valuation.nav);
    }
  }
  data.folios = data.folios.filter((f) => f.schemes.length > 0);
  if (data.folios.length === 0) throw new CASParseError("NOT_A_CAS", "No mutual fund holdings were found in this statement.");
  return data;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
