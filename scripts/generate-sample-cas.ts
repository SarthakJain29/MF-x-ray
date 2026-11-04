/**
 * Generates a realistic, fully SYNTHETIC CAMS-style Detailed CAS PDF for development and tests.
 * The investor, PAN, folios, address and advisor codes are fake. Scheme names/ISINs and NAVs are real
 * (NAVs fetched from mfapi.in) so the rest of the app — NAV history, categories, TER — works end-to-end.
 *
 * Usage: npx tsx scripts/generate-sample-cas.ts
 * Output: public/sample/sample-cas.pdf (password: mfxray) and tests/fixtures/sample-cas.expected.json
 */
import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const PASSWORD = "mfxray";
const FROM = "2019-01-01";
const TO = "2026-10-31";
const NAV_CACHE = path.join(ROOT, "scripts", ".nav-cache.json");

type Plan = {
  amc: string;
  folio: string;
  rtaCode: string;
  code: number;
  name: string;
  isin: string;
  rta: "CAMS" | "KFINTECH";
  advisor: string;
  nominee: string;
  events: Event[];
};
type Event =
  | { kind: "sip"; amount: number; day: number; start: string; end?: string }
  | { kind: "lump"; amount: number; date: string }
  | { kind: "redeem"; amount: number; date: string }
  | { kind: "redeemAll"; date: string };

const PLANS: Plan[] = [
  {
    amc: "PPFAS Mutual Fund", folio: "18472093", rtaCode: "PP001ZG", code: 122639, isin: "INF879O01027",
    name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth", rta: "CAMS", advisor: "DIRECT", nominee: "Kabir Rao",
    events: [{ kind: "sip", amount: 10000, day: 5, start: "2019-02-05" }, { kind: "lump", amount: 50000, date: "2023-03-20" }],
  },
  {
    amc: "HDFC Mutual Fund", folio: "29384756 / 41", rtaCode: "B205RG", code: 101762, isin: "INF179K01608",
    name: "HDFC Flexi Cap Fund - Regular Plan - Growth Option", rta: "CAMS", advisor: "ARN-000000", nominee: "Kabir Rao",
    events: [{ kind: "lump", amount: 100000, date: "2019-03-12" }, { kind: "sip", amount: 5000, day: 10, start: "2019-04-10" }],
  },
  {
    amc: "HDFC Mutual Fund", folio: "29384756 / 41", rtaCode: "B231DG", code: 118987, isin: "INF179K01XD8",
    name: "HDFC Corporate Bond Fund - Direct Plan - Growth Option", rta: "CAMS", advisor: "DIRECT", nominee: "Kabir Rao",
    events: [{ kind: "lump", amount: 200000, date: "2021-07-12" }, { kind: "redeem", amount: 50000, date: "2025-02-17" }],
  },
  {
    amc: "Mirae Asset Mutual Fund", folio: "79100345612", rtaCode: "MAEBDG", code: 118825, isin: "INF769K01AX2",
    name: "Mirae Asset Large Cap Fund - Direct Plan - Growth", rta: "KFINTECH", advisor: "DIRECT", nominee: "Kabir Rao",
    events: [{ kind: "sip", amount: 5000, day: 15, start: "2020-06-15", end: "2024-12-31" }],
  },
  {
    amc: "UTI Mutual Fund", folio: "50287711093", rtaCode: "UTNI50DG", code: 120716, isin: "INF789F01XA0",
    name: "UTI Nifty 50 Index Fund - Direct Plan - Growth", rta: "KFINTECH", advisor: "DIRECT", nominee: "Kabir Rao",
    events: [{ kind: "sip", amount: 7500, day: 1, start: "2021-01-01" }],
  },
  {
    amc: "Axis Mutual Fund", folio: "91022837465", rtaCode: "AXLTGR", code: 112323, isin: "INF846K01131",
    name: "Axis ELSS Tax Saver Fund - Regular Plan - Growth", rta: "KFINTECH", advisor: "ARN-000000", nominee: "Kabir Rao",
    events: [
      { kind: "lump", amount: 50000, date: "2019-01-21" }, { kind: "lump", amount: 50000, date: "2020-01-20" },
      { kind: "lump", amount: 50000, date: "2021-01-18" }, { kind: "lump", amount: 50000, date: "2022-01-24" },
      { kind: "redeem", amount: 60000, date: "2024-03-11" },
    ],
  },
  {
    amc: "Nippon India Mutual Fund", folio: "477120938211", rtaCode: "RMFSCDG", code: 118778, isin: "INF204K01K15",
    name: "Nippon India Small Cap Fund - Direct Plan - Growth Plan - Growth Option", rta: "KFINTECH", advisor: "DIRECT", nominee: "Kabir Rao",
    events: [{ kind: "lump", amount: 75000, date: "2020-04-20" }, { kind: "sip", amount: 3000, day: 25, start: "2023-01-25" }],
  },
  {
    amc: "ICICI Prudential Mutual Fund", folio: "11923847 / 12", rtaCode: "P8042", code: 120197, isin: "INF109K01Q49",
    name: "ICICI Prudential Liquid Fund - Direct Plan - Growth", rta: "CAMS", advisor: "DIRECT", nominee: "Kabir Rao",
    events: [{ kind: "lump", amount: 100000, date: "2022-05-09" }, { kind: "redeemAll", date: "2023-08-14" }],
  },
];

type NavPoint = { date: string; nav: number };
async function navHistory(code: number, cache: Record<string, NavPoint[]>): Promise<NavPoint[]> {
  if (cache[code]) return cache[code];
  const res = await fetch(`https://api.mfapi.in/mf/${code}`);
  if (!res.ok) throw new Error(`mfapi ${code}: ${res.status}`);
  const json = (await res.json()) as { data: { date: string; nav: string }[] };
  const pts = json.data
    .map((d) => {
      const [dd, mm, yyyy] = d.date.split("-");
      return { date: `${yyyy}-${mm}-${dd}`, nav: parseFloat(d.nav) };
    })
    .filter((p) => p.date >= "2018-12-01" && p.date <= TO && p.nav > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  cache[code] = pts;
  return pts;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const casDate = (iso: string) => `${iso.slice(8, 10)}-${MON[+iso.slice(5, 7) - 1]}-${iso.slice(0, 4)}`;
const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const u3 = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const n4 = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const neg = (s: string) => `(${s})`;
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

type Row = { date: string; desc: string; amount?: number; units?: number; nav?: number; balance?: number; tax?: boolean };

function onOrAfter(pts: NavPoint[], date: string): NavPoint | null {
  return pts.find((p) => p.date >= date) ?? null;
}
function onOrBefore(pts: NavPoint[], date: string): NavPoint {
  let best = pts[0];
  for (const p of pts) if (p.date <= date) best = p;
  return best;
}

function buildRows(plan: Plan, pts: NavPoint[]) {
  type Ev = { date: string; kind: "buy" | "sip" | "redeem" | "redeemAll"; amount: number; n?: number };
  const evs: Ev[] = [];
  for (const e of plan.events) {
    if (e.kind === "sip") {
      let [y, m] = [+e.start.slice(0, 4), +e.start.slice(5, 7)];
      let n = 1;
      for (;;) {
        const d = `${y}-${String(m).padStart(2, "0")}-${String(e.day).padStart(2, "0")}`;
        if (d > (e.end ?? TO)) break;
        evs.push({ date: d, kind: "sip", amount: e.amount, n: n++ });
        m++;
        if (m > 12) { m = 1; y++; }
      }
    } else if (e.kind === "lump") evs.push({ date: e.date, kind: "buy", amount: e.amount });
    else if (e.kind === "redeem") evs.push({ date: e.date, kind: "redeem", amount: e.amount });
    else evs.push({ date: e.date, kind: "redeemAll", amount: 0 });
  }
  evs.sort((a, b) => a.date.localeCompare(b.date));
  const rows: Row[] = [];
  let bal = 0;
  let cost = 0; // average-cost for the "Total Cost Value" line, like CAMS
  const isEquity = !/bond|liquid/i.test(plan.name);
  for (const e of evs) {
    const p = onOrAfter(pts, e.date);
    if (!p || p.date > TO) continue;
    if (e.kind === "buy" || e.kind === "sip") {
      const stamp = p.date >= "2020-07-01" ? round(e.amount * 0.00005, 2) : 0;
      const net = round(e.amount - stamp, 2);
      const units = round(net / p.nav, 3);
      bal = round(bal + units, 3);
      cost += e.amount;
      const desc = e.kind === "sip" ? `SIP Purchase - Instalment No ${e.n} - via Internet` : "Purchase - via Internet";
      rows.push({ date: p.date, desc, amount: net, units, nav: p.nav, balance: bal });
      if (stamp > 0) rows.push({ date: p.date, desc: "*** Stamp Duty ***", amount: stamp, tax: true });
    } else {
      const units = e.kind === "redeemAll" ? bal : round(e.amount / p.nav, 3);
      const amount = round(units * p.nav, 2);
      cost = bal > 0 ? cost * (1 - units / bal) : 0;
      bal = round(bal - units, 3);
      rows.push({ date: p.date, desc: e.kind === "redeemAll" ? "Redemption - Full" : "Redemption", amount: -amount, units: -units, nav: p.nav, balance: bal });
      if (isEquity) rows.push({ date: p.date, desc: "*** STT Paid ***", amount: round(amount * 0.00001, 2), tax: true });
    }
  }
  const last = onOrBefore(pts, TO);
  return { rows, close: bal, nav: last.nav, navDate: last.date, cost: round(cost, 2), value: round(bal * last.nav, 2) };
}

async function main() {
  let cache: Record<string, NavPoint[]> = {};
  try { cache = JSON.parse(await readFile(NAV_CACHE, "utf8")); } catch { /* first run */ }
  const built = [];
  for (const p of PLANS) built.push({ plan: p, ...buildRows(p, await navHistory(p.code, cache)) });
  await writeFile(NAV_CACHE, JSON.stringify(cache));

  await mkdir(path.join(ROOT, "public", "sample"), { recursive: true });
  const out = path.join(ROOT, "public", "sample", "sample-cas.pdf");
  const doc = new PDFDocument({
    size: "A4",
    margin: 30,
    userPassword: PASSWORD,
    ownerPassword: "mfxray-owner-synthetic",
    pdfVersion: "1.7",
    permissions: { printing: "highResolution", copying: true },
    info: { Title: "Consolidated Account Statement (SYNTHETIC SAMPLE)", Author: "MF X-ray sample generator" },
  });
  doc.pipe(createWriteStream(out));
  let y = 0;
  const FS = 7.2;
  const txt = (s: string, x: number, opts: { bold?: boolean; size?: number; w?: number; align?: "right" | "left" } = {}) => {
    doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size ?? FS);
    if (opts.align === "right") doc.text(s, x - (opts.w ?? 80), y, { width: opts.w ?? 80, align: "right", lineBreak: false });
    else doc.text(s, x, y, { lineBreak: false });
  };
  const nl = (h = 10) => {
    y += h;
    if (y > 800) newPage();
  };
  const colHeader = () => {
    txt("Date", 36, { bold: true }); txt("Transaction", 96, { bold: true });
    txt("Amount (INR)", 372, { bold: true, align: "right" }); txt("Units", 442, { bold: true, align: "right" });
    txt("NAV (INR)", 500, { bold: true, align: "right" }); txt("Unit Balance", 562, { bold: true, align: "right" });
    nl(4); doc.moveTo(30, y + 6).lineTo(565, y + 6).lineWidth(0.4).stroke("#999"); nl(10);
  };
  let pageNo = 1;
  const footer = () => {
    doc.font("Helvetica").fontSize(6).fillColor("#888").text(`SYNTHETIC SAMPLE – fictional investor for testing MF X-ray. Not a real statement.   Page ${pageNo}`, 30, 818, { lineBreak: false });
    doc.fillColor("black");
  };
  const newPage = () => { footer(); doc.addPage(); pageNo++; y = 36; colHeader(); };

  y = 34;
  txt("Consolidated Account Statement", 200, { bold: true, size: 13 }); nl(16);
  txt(`${casDate(FROM)} To ${casDate(TO)}`, 245, { size: 9 }); nl(22);
  txt("Email Id: ananya.rao@example.com", 36); nl(11);
  txt("Ananya Rao", 36, { bold: true, size: 8.5 }); nl(11);
  txt("Flat 12B, Example Residency, 4th Cross", 36); nl(10);
  txt("Indiranagar, Bengaluru - 560038", 36); nl(10);
  txt("Karnataka, India", 36); nl(10);
  txt("Mobile: +919800000000", 36); nl(18);
  txt("This Consolidated Account Statement is brought to you as an investor friendly initiative by CAMS and KFintech.", 36, { size: 6.5 }); nl(16);

  txt("PORTFOLIO SUMMARY", 36, { bold: true, size: 8.5 }); nl(12);
  txt("Mutual Fund", 36, { bold: true }); txt("Cost Value (INR)", 420, { bold: true, align: "right" }); txt("Market Value (INR)", 540, { bold: true, align: "right" }); nl(11);
  const byAmc = new Map<string, { c: number; v: number }>();
  for (const b of built) {
    const a = byAmc.get(b.plan.amc) ?? { c: 0, v: 0 };
    a.c += b.close > 0 ? b.cost : 0; a.v += b.value;
    byAmc.set(b.plan.amc, a);
  }
  let tc = 0, tv = 0;
  for (const [amc, a] of byAmc) { txt(amc, 36); txt(inr(a.c), 420, { align: "right" }); txt(inr(a.v), 540, { align: "right" }); nl(10); tc += a.c; tv += a.v; }
  txt("Total", 36, { bold: true }); txt(inr(tc), 420, { bold: true, align: "right" }); txt(inr(tv), 540, { bold: true, align: "right" }); nl(22);
  colHeader();

  let lastAmc = "";
  let lastFolio = "";
  for (const b of built) {
    const p = b.plan;
    if (p.amc !== lastAmc) { nl(4); txt(p.amc, 36, { bold: true, size: 8.5 }); nl(12); lastAmc = p.amc; lastFolio = ""; }
    if (p.folio !== lastFolio) {
      txt(`Folio No: ${p.folio}`, 36, { bold: true }); txt("PAN: ABCDE1234F", 230); txt("KYC: OK  PAN: OK", 330); nl(11);
      lastFolio = p.folio;
    }
    const header = `${p.rtaCode}-${p.name} (Non-Demat) - ISIN: ${p.isin}`;
    if (header.length > 95) {
      txt(header, 36, { bold: true }); nl(9);
      txt(`(Advisor: ${p.advisor})`, 36, { bold: true }); txt(`Registrar : ${p.rta}`, 470); nl(10);
    } else {
      txt(`${header}(Advisor: ${p.advisor})`, 36, { bold: true }); txt(`Registrar : ${p.rta}`, 470); nl(10);
    }
    txt(`Nominee 1: ${p.nominee}`, 36); txt("Nominee 2:", 230); txt("Nominee 3:", 380); nl(10);
    txt("Opening Unit Balance: 0.000", 96); nl(10);
    for (const r of b.rows) {
      txt(casDate(r.date), 36); txt(r.desc, 96);
      if (r.tax) txt(inr(r.amount!), 372, { align: "right" });
      else {
        txt(r.amount! < 0 ? neg(inr(-r.amount!)) : inr(r.amount!), 372, { align: "right" });
        txt(r.units! < 0 ? neg(u3(-r.units!)) : u3(r.units!), 442, { align: "right" });
        txt(n4(r.nav!), 500, { align: "right" });
        txt(u3(r.balance!), 562, { align: "right" });
      }
      nl(9.5);
    }
    txt(`Closing Unit Balance: ${u3(b.close)}`, 36, { bold: true }); txt(`NAV on ${casDate(b.navDate)}: INR ${n4(b.nav)}`, 170);
    txt(`Total Cost Value: ${inr(b.close > 0 ? b.cost : 0)}`, 300); txt(`Market Value on ${casDate(b.navDate)}: INR ${inr(b.value)}`, 420); nl(16);
  }
  footer();
  doc.end();

  const expected = {
    password: PASSWORD,
    from: FROM,
    to: TO,
    investorName: "Ananya Rao",
    folios: [...new Set(PLANS.map((p) => p.folio))].length,
    schemes: built.map((b) => ({
      isin: b.plan.isin, name: b.plan.name, amc: b.plan.amc, close: b.close, nav: b.nav, navDate: b.navDate,
      value: b.value, txnCount: b.rows.length,
    })),
  };
  await writeFile(path.join(ROOT, "tests", "fixtures", "sample-cas.expected.json"), JSON.stringify(expected, null, 2));
  console.log(`Wrote ${out} (${built.reduce((s, b) => s + b.rows.length, 0)} transactions, value ₹${inr(tv)})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
