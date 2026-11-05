/** Turns parsed CAS data into portfolio analytics: values, cost, gains, XIRR, allocation. */
import type { CASData, Transaction } from "../cas/types";
import type { SchemeIndex } from "../data/schemeIndex";
import { estimateTer, type TerIndex, type TerInfo } from "../data/ter";
import { AssetClass, assetClassFor, familyName, friendlyCategory, optionOf, planOf } from "./categorize";
import { CashFlow, xirr } from "./xirr";
import { allocateMerger, runFifo, type Disposal, type Lot, type MergerOut } from "./lots";

export interface Holding {
  id: string;
  folio: string;
  amc: string;
  name: string;
  shortName: string;
  isin: string | null;
  amfiCode: number | null;
  plan: "Direct" | "Regular";
  option: "Growth" | "IDCW";
  advisor: string | null;
  rta: string | null;
  amfiCategory: string | null;
  category: string;
  assetClass: AssetClass;
  units: number;
  nav: number | null;
  navDate: string | null;
  value: number;
  /** Cost of the units still held (FIFO). */
  cost: number;
  unrealisedGain: number;
  realisedGain: number;
  totalInvested: number;
  totalWithdrawn: number;
  xirr: number | null;
  /** True when the statement doesn't start from the first purchase, so XIRR/cost may be incomplete. */
  incompleteHistory: boolean;
  firstDate: string | null;
  transactions: Transaction[];
  cashflows: CashFlow[];
  /** Units still held, as FIFO lots (acquisition date + cost) */
  lots: Lot[];
  /** Sales and switch-outs, each with the lots they consumed */
  disposals: Disposal[];
  ter: TerInfo;
  /** AMFI code of the direct-plan twin, when this is a regular plan. */
  directCode: number | null;
}

export interface AllocationSlice {
  key: string;
  value: number;
  share: number;
}

export interface Portfolio {
  asOf: string | null;
  statementFrom: string | null;
  holdings: Holding[];
  closed: Holding[];
  value: number;
  cost: number;
  unrealisedGain: number;
  realisedGain: number;
  totalInvested: number;
  totalWithdrawn: number;
  xirr: number | null;
  allocation: { assetClass: AllocationSlice[]; category: AllocationSlice[]; amc: AllocationSlice[]; plan: AllocationSlice[] };
  /** Weighted average TER of current holdings (% p.a.) */
  weightedTer: number | null;
  warnings: string[];
}

export interface LatestNav {
  nav: number;
  date: string;
}

export interface BuildOptions {
  schemeIndex?: SchemeIndex | null;
  terIndex?: TerIndex | null;
  /** Latest NAVs keyed by AMFI code. When newer than the statement, values are marked to market. */
  latestNav?: Record<number, LatestNav>;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function cashflowsFor(txns: Transaction[]): CashFlow[] {
  const flows: CashFlow[] = [];
  for (const t of txns) {
    const amt = Math.abs(t.amount ?? 0);
    if (!amt) continue;
    const units = t.units ?? 0;
    switch (t.type) {
      case "DIVIDEND_REINVEST":
      case "MISC":
      case "SEGREGATION":
      case "BONUS":
      case "MERGER_IN":
      case "MERGER_OUT":
        continue;
      case "STAMP_DUTY_TAX":
      case "STT_TAX":
      case "TDS_TAX":
        flows.push({ date: t.date, amount: -amt });
        continue;
      case "DIVIDEND_PAYOUT":
        flows.push({ date: t.date, amount: amt });
        continue;
      default:
        if (units > 0) flows.push({ date: t.date, amount: -amt });
        else if (units < 0) flows.push({ date: t.date, amount: amt });
    }
  }
  return flows;
}

function slices(map: Map<string, number>, total: number): AllocationSlice[] {
  return [...map.entries()]
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ key, value: r2(value), share: total > 0 ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

export function buildPortfolio(cas: CASData, opts: BuildOptions = {}): Portfolio {
  const { schemeIndex, terIndex, latestNav } = opts;
  const all: Holding[] = [];
  const warnings = [...cas.warnings];

  // Pass 1 — units that left a folio in a merger, so the receiving scheme inherits cost and dates.
  const sorted = (txns: Transaction[]) => [...txns].sort((a, b) => a.date.localeCompare(b.date));
  const mergerPool = new Map<string, MergerOut[]>(); // `${folio}|${date}`
  const mergerIns = new Map<string, { units: number; amount: number }[]>();
  for (const folio of cas.folios) {
    for (const s of folio.schemes) {
      const t = sorted(s.transactions);
      if (!t.some((x) => x.type === "MERGER_OUT" || x.type === "MERGER_IN")) continue;
      for (const m of runFifo(t, s.open).mergerOuts) {
        const k = `${folio.folio}|${m.date}`;
        mergerPool.set(k, [...(mergerPool.get(k) ?? []), m]);
      }
      for (const x of t) {
        if (x.type !== "MERGER_IN") continue;
        const k = `${folio.folio}|${x.date}`;
        mergerIns.set(k, [...(mergerIns.get(k) ?? []), { units: x.units ?? 0, amount: Math.abs(x.amount ?? 0) }]);
      }
    }
  }

  for (const folio of cas.folios) {
    for (const s of folio.schemes) {
      const plan = planOf(s.name, s.advisor);
      const option = optionOf(s.name);
      const info = schemeIndex?.lookupIsin(s.isin) ?? schemeIndex?.lookupName(s.name, plan, option) ?? null;
      const category = friendlyCategory(info?.category, s.name);
      const assetClass = assetClassFor(info?.category, category, s.name);
      const txns = sorted(s.transactions);
      const incompleteHistory = s.open > 0.001;
      const seenIn = new Map<string, number>();
      const f = runFifo(txns, s.open, {
        mergerIn: (t) => {
          const k = `${folio.folio}|${t.date}`;
          const pool = mergerPool.get(k);
          const ins = mergerIns.get(k);
          if (!pool || !ins) return null;
          const i = seenIn.get(k) ?? 0;
          seenIn.set(k, i + 1);
          // this scheme's n-th merger-in on that date: find its position among the folio's receivers
          const mine = ins.findIndex((x, j) => j >= i && Math.abs(x.units - (t.units ?? 0)) < 1e-6 && Math.abs(x.amount - Math.abs(t.amount ?? 0)) < 1e-6);
          return allocateMerger(pool, ins, mine >= 0 ? mine : 0);
        },
      });
      const units = s.close;

      let nav = s.valuation.nav;
      let navDate = s.valuation.date;
      const live = info && latestNav?.[info.code];
      if (live && (!navDate || live.date > navDate)) {
        nav = live.nav;
        navDate = live.date;
      }
      const value = units > 0.0005 ? (nav != null ? units * nav : s.valuation.value ?? 0) : 0;
      // Prefer the CAS's own cost figure when history is incomplete (FIFO can't know opening cost).
      const cost = units > 0.0005 ? (incompleteHistory && s.valuation.cost != null ? s.valuation.cost : f.cost) : 0;

      const flows = cashflowsFor(txns);
      const terminal: CashFlow[] = value > 0 && navDate ? [{ date: navDate, amount: value }] : [];
      const x = incompleteHistory ? null : xirr([...flows, ...terminal]);

      const ter = terIndex?.lookup(s.name) ?? (info ? terIndex?.lookup(info.name) : null) ?? estimateTer(category, assetClass, s.name);
      const directTwin = plan === "Regular" && info && schemeIndex ? schemeIndex.counterpart(info, "Direct", option) : null;

      all.push({
        id: `${folio.folio}|${s.isin ?? s.rtaCode ?? s.name}`,
        folio: folio.folio,
        amc: folio.amc,
        name: s.name,
        shortName: familyName(s.name),
        isin: s.isin,
        amfiCode: info?.code ?? null,
        plan,
        option,
        advisor: s.advisor,
        rta: s.rta,
        amfiCategory: info?.category ?? null,
        category,
        assetClass,
        units,
        nav,
        navDate,
        value: r2(value),
        cost: r2(cost),
        unrealisedGain: r2(value - cost),
        realisedGain: r2(f.realised),
        totalInvested: r2(f.invested),
        totalWithdrawn: r2(f.withdrawn),
        xirr: x,
        incompleteHistory,
        firstDate: txns[0]?.date ?? null,
        transactions: txns,
        cashflows: flows,
        lots: f.lots,
        disposals: f.disposals,
        ter,
        directCode: directTwin?.code ?? null,
      });
    }
  }

  const holdings = all.filter((h) => h.value > 0).sort((a, b) => b.value - a.value);
  const closed = all.filter((h) => h.value <= 0);
  const value = holdings.reduce((s, h) => s + h.value, 0);
  const cost = holdings.reduce((s, h) => s + h.cost, 0);
  const asOf = holdings.map((h) => h.navDate).filter(Boolean).sort().pop() ?? cas.statementPeriod.to;

  const anyIncomplete = all.some((h) => h.incompleteHistory);
  if (anyIncomplete)
    warnings.push("Your statement doesn't start from your first investment for some funds, so XIRR for those funds can't be computed. Request a CAS for the period “since inception”.");
  const overallFlows = all.filter((h) => !h.incompleteHistory).flatMap((h) => [
    ...h.cashflows,
    ...(h.value > 0 && h.navDate ? [{ date: h.navDate, amount: h.value }] : []),
  ]);

  const byAsset = new Map<string, number>();
  const byCat = new Map<string, number>();
  const byAmc = new Map<string, number>();
  const byPlan = new Map<string, number>();
  for (const h of holdings) {
    byAsset.set(h.assetClass, (byAsset.get(h.assetClass) ?? 0) + h.value);
    byCat.set(h.category, (byCat.get(h.category) ?? 0) + h.value);
    byAmc.set(h.amc, (byAmc.get(h.amc) ?? 0) + h.value);
    byPlan.set(h.plan, (byPlan.get(h.plan) ?? 0) + h.value);
  }
  const terWeighted = holdings.reduce((s, h) => {
    const t = h.plan === "Direct" ? h.ter.direct : h.ter.regular;
    return t == null ? s : { v: s.v + h.value * t, w: s.w + h.value };
  }, { v: 0, w: 0 });

  return {
    asOf,
    statementFrom: cas.statementPeriod.from,
    holdings,
    closed,
    value: r2(value),
    cost: r2(cost),
    unrealisedGain: r2(value - cost),
    realisedGain: r2(all.reduce((s, h) => s + h.realisedGain, 0)),
    totalInvested: r2(all.reduce((s, h) => s + h.totalInvested, 0)),
    totalWithdrawn: r2(all.reduce((s, h) => s + h.totalWithdrawn, 0)),
    xirr: overallFlows.length ? xirr(overallFlows) : null,
    allocation: {
      assetClass: slices(byAsset, value),
      category: slices(byCat, value),
      amc: slices(byAmc, value),
      plan: slices(byPlan, value),
    },
    weightedTer: terWeighted.w > 0 ? terWeighted.v / terWeighted.w : null,
    warnings,
  };
}

/** The TER the investor is actually paying for a holding. */
export function paidTer(h: Holding): number | null {
  return h.plan === "Direct" ? h.ter.direct : h.ter.regular;
}
