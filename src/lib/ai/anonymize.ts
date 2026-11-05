/**
 * Builds the ONLY data that may leave the device for AI chat: anonymised aggregates.
 * No PAN, name, email, phone, address, folio numbers, ISINs or transaction-level data.
 */
import type { Portfolio } from "../finance/portfolio";
import { paidTer } from "../finance/portfolio";
import type { OverlapReport } from "../overlap";

export interface AiFund {
  fund: string;
  plan: "Direct" | "Regular";
  option: "Growth" | "IDCW";
  category: string;
  assetClass: string;
  fundHouse: string;
  value: number;
  cost: number;
  gain: number;
  sharePct: number;
  xirrPct: number | null;
  expenseRatioPct: number | null;
  directPlanExpenseRatioPct: number | null;
  investingSinceYear: number | null;
}

export interface AiContext {
  asOf: string | null;
  totals: { value: number; cost: number; gain: number; realisedGain: number; xirrPct: number | null; funds: number; weightedExpenseRatioPct: number | null };
  allocation: { assetClass: Record<string, number>; category: Record<string, number>; fundHouse: Record<string, number> };
  funds: AiFund[];
  overlaps: { fundA: string; fundB: string; overlapPct: number; verdict: string; commonTop: string[] }[];
  topStockExposure: { stock: string; value: number; pctOfEquity: number; viaFunds: number }[];
  sectorExposurePct: Record<string, number>;
  holdingsDataMonth: string | null;
}

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const pctMap = (s: { key: string; share: number }[]) => Object.fromEntries(s.map((x) => [x.key, r1(x.share * 100)]));

export function buildAiContext(p: Portfolio, overlap: OverlapReport | null): AiContext {
  const nameOf = new Map(p.holdings.map((h) => [h.id, h.shortName]));
  return {
    asOf: p.asOf,
    totals: {
      value: r0(p.value),
      cost: r0(p.cost),
      gain: r0(p.unrealisedGain),
      realisedGain: r0(p.realisedGain),
      xirrPct: p.xirr == null ? null : r2(p.xirr * 100),
      funds: p.holdings.length,
      weightedExpenseRatioPct: p.weightedTer == null ? null : r2(p.weightedTer),
    },
    allocation: { assetClass: pctMap(p.allocation.assetClass), category: pctMap(p.allocation.category), fundHouse: pctMap(p.allocation.amc) },
    funds: p.holdings.map((h) => ({
      fund: h.shortName,
      plan: h.plan,
      option: h.option,
      category: h.category,
      assetClass: h.assetClass,
      fundHouse: h.amc,
      value: r0(h.value),
      cost: r0(h.cost),
      gain: r0(h.unrealisedGain),
      sharePct: p.value ? r1((h.value / p.value) * 100) : 0,
      xirrPct: h.xirr == null ? null : r2(h.xirr * 100),
      expenseRatioPct: paidTer(h),
      directPlanExpenseRatioPct: h.ter.direct,
      investingSinceYear: h.firstDate ? +h.firstDate.slice(0, 4) : null,
    })),
    overlaps: (overlap?.pairs ?? []).slice(0, 6).map((x) => ({
      fundA: nameOf.get(x.a) ?? "?",
      fundB: nameOf.get(x.b) ?? "?",
      overlapPct: x.overlap,
      verdict: x.verdict,
      commonTop: x.common.slice(0, 5).map((c) => c.name),
    })),
    topStockExposure: (overlap?.exposure ?? []).slice(0, 10).map((e) => ({ stock: e.name, value: e.value, pctOfEquity: r1(e.shareOfEquity * 100), viaFunds: e.funds.length })),
    sectorExposurePct: Object.fromEntries((overlap?.sectors ?? []).slice(0, 8).map((s) => [s.sector, r1(s.share * 100)])),
    holdingsDataMonth: overlap?.dataMonth ?? null,
  };
}

const PAN = /\b[A-Z]{5}\d{4}[A-Z]\b/gi;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;
const LONG_NUM = /\b\d{6,}(?:\s*\/\s*\d+)?\b/g; // folio-like numbers
const ISIN = /\bIN[FE][A-Z0-9]{8}\d\b/g;

/** Remove anything that looks like personal identifiers from free text. */
export function scrubText(text: string, extraSecrets: (string | null | undefined)[] = []): string {
  let out = text.replace(EMAIL, "[email]").replace(PAN, "[id]").replace(ISIN, "[code]").replace(PHONE, "[phone]").replace(LONG_NUM, "[number]");
  for (const s of extraSecrets) {
    if (!s || s.trim().length < 3) continue;
    for (const part of [s, ...s.split(/\s+/).filter((w) => w.length >= 3)]) {
      out = out.replace(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[name]");
    }
  }
  return out.slice(0, 1000);
}

/** Defensive check used by tests and by the API route. */
export function containsPII(text: string, secrets: (string | null | undefined)[] = []): boolean {
  if (new RegExp(PAN.source, "i").test(text) || new RegExp(EMAIL.source).test(text)) return true;
  return secrets.some((s) => !!s && s.length >= 3 && text.toLowerCase().includes(s.toLowerCase()));
}
