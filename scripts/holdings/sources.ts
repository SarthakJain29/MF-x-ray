/**
 * Where each AMC publishes its monthly portfolio disclosure, and how to pick the right file(s) for a month.
 * Discovery renders the AMC's public download page (many are client-side rendered) and filters its links.
 * Add an AMC by appending an entry; the parser itself is generic (SEBI-prescribed columns).
 */
export interface Link {
  href: string;
  text: string;
}

export interface Month {
  year: number;
  /** 1-12 */
  month: number;
}

export interface Source {
  id: string;
  /** AMC name exactly as in AMFI's NAVAll scheme master */
  amfiAmc: string;
  pages: string[];
  /** return the file URLs for this month (empty if not published yet) */
  pick(links: Link[], m: Month): string[];
  /** extra candidate URLs to try directly (for paginated pages); 404s are skipped */
  probe?(m: Month): string[];
}

const FULL = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const SHORT = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Does this string mention the given month-end (in any of the formats AMCs use)? */
export function mentionsMonth(s: string, m: Month): boolean {
  let d = s;
  try {
    d = decodeURIComponent(s);
  } catch {
    /* keep raw */
  }
  const t = d.toLowerCase().replace(/[_\-.,/]+/g, " ").replace(/\s+/g, " ");
  const y = String(m.year);
  const yy = y.slice(2);
  const full = FULL[m.month - 1];
  const short = SHORT[m.month - 1];
  const mm = String(m.month).padStart(2, "0");
  const last = new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
  const pats = [
    new RegExp(`\\b${full}\\b.{0,12}\\b${y}\\b`),
    new RegExp(`\\b${short}t?\\b.{0,12}\\b${y}\\b`),
    new RegExp(`\\b${y}\\b.{0,3}\\b${full}\\b`),
    new RegExp(`\\b${short}(t|tember)?\\s?${y}\\b`),
    new RegExp(`\\b${last}(st|nd|rd|th)?\\s?${short}[a-z]*\\s?(${y}|${yy})\\b`),
    new RegExp(`\\b${last}${mm}${y}\\b`),
    new RegExp(`\\b${y}${mm}${last}\\b`),
    new RegExp(`\\b${last}\\s${mm}\\s${y}\\b`),
  ];
  return pats.some((p) => p.test(t));
}

const isSheet = (h: string) => /\.(xlsx?|zip)(\?|$)/i.test(h);
const uniq = (xs: string[]) => [...new Set(xs)];
const byMonth = (links: Link[], m: Month, extra?: RegExp, exclude = /debt|fortnight|half[- ]?year|risk|performance|replication|commission|aaum|dividend|riskometer|closed[ _-]?ended/i) =>
  uniq(links.filter((l) => isSheet(l.href) && mentionsMonth(`${l.href} ${l.text}`, m) && (!extra || extra.test(`${l.href} ${l.text}`)) && !exclude.test(l.href)).map((l) => l.href));

export const SOURCES: Source[] = [
  {
    id: "sbi",
    amfiAmc: "SBI Mutual Fund",
    pages: ["https://www.sbimf.com/portfolios"],
    pick: (l, m) => byMonth(l, m, /all-schemes-monthly-portfolio/i).slice(0, 1),
  },
  {
    id: "nippon",
    amfiAmc: "Nippon India Mutual Fund",
    pages: ["https://mf.nipponindiaim.com/investor-service/downloads/factsheet-portfolio-and-other-disclosures"],
    pick: (l, m) => byMonth(l, m, /monthly-portfolio/i).slice(0, 1),
  },
  {
    id: "absl",
    amfiAmc: "Aditya Birla Sun Life Mutual Fund",
    pages: ["https://mutualfund.adityabirlacapital.com/forms-and-downloads/portfolio"],
    pick: (l, m) => byMonth(l, m, /monthly-portfolio\/\d{4}\//i).slice(0, 1),
  },
  {
    id: "mirae",
    amfiAmc: "Mirae Asset Mutual Fund",
    pages: ["https://www.miraeassetmf.co.in/downloads/portfolios"],
    // one file per scheme; the page lists only the 10 most recent uploads, so known scheme codes are probed too
    pick: (l, m) => byMonth(l, m, /default-source\/portfolios\//i),
    probe: (m) => {
      const tok = `${m.month === 9 ? "sept" : SHORT[m.month - 1]}${m.year}`;
      return ["maebf", "maetf", "matsf", "mamcf", "mascf", "mahcf", "maesf", "mabaf", "mafcf", "maff", "mamaaf"].map(
        (c) => `https://www.miraeassetmf.co.in/docs/default-source/portfolios/${c}_${tok}.xlsx`,
      );
    },
  },
  {
    id: "dsp",
    amfiAmc: "DSP Mutual Fund",
    pages: ["https://www.dspim.com/mandatory-disclosures/portfolio-disclosures"],
    pick: (l, m) => byMonth(l, m, /month-?end/i).slice(0, 1),
  },
  {
    id: "tata",
    amfiAmc: "Tata Mutual Fund",
    pages: ["https://www.tatamutualfund.com/schemes-related/portfolio"],
    pick: (l, m) => byMonth(l, m, /monthly[ _%20-]*portfolio/i).slice(0, 1),
  },
  {
    id: "ppfas",
    amfiAmc: "PPFAS Mutual Fund",
    pages: ["https://amc.ppfas.com/downloads/portfolio-disclosure/"],
    // consolidated file covering all schemes
    pick: (l, m) => byMonth(l, m, /\/PPFAS_Monthly_Portfolio_Report_/).slice(0, 1),
  },
  {
    id: "motilal",
    amfiAmc: "Motilal Oswal Mutual Fund",
    pages: ["https://www.motilaloswalmf.com/download/month-end-portfolio"],
    pick: (l, m) => byMonth(l, m, /scheme[ _%20]*portfolio[ _%20]*details/i).slice(0, 1),
  },
  {
    id: "invesco",
    amfiAmc: "Invesco Mutual Fund",
    pages: ["https://www.invescomutualfund.com/literature-forms/monthly-holdings/equity", "https://www.invescomutualfund.com/literature-forms/monthly-holdings/hybrid"],
    // one file per scheme
    pick: (l, m) => byMonth(l, m, /completes?-monthly-holding/i),
  },
];

/** AMCs checked but not ingested yet (see developer.md › Blockers). */
export const NOT_YET_COVERED: { amc: string; reason: string }[] = [
  { amc: "HDFC Mutual Fund", reason: "Site returns 'Access Denied' (Akamai bot protection) to automated requests" },
  { amc: "ICICI Prudential Mutual Fund", reason: "Host unreachable from the build environment's network policy; files also published as PDFs on exchanges" },
  { amc: "Kotak Mahindra Mutual Fund", reason: "Download API sits behind bot protection (Radware)" },
  { amc: "Axis Mutual Fund", reason: "No monthly portfolio file links found on the public downloads pages" },
  { amc: "UTI Mutual Fund", reason: "Consolidated disclosure page doesn't expose monthly portfolio files to automated discovery" },
  { amc: "Edelweiss Mutual Fund", reason: "Site returns 'Access Denied' to automated requests" },
  { amc: "Franklin Templeton Mutual Fund", reason: "Portfolios are published per fund page; not wired up yet" },
];
