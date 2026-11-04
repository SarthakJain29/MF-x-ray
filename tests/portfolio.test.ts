import { describe, expect, it } from "vitest";
import { buildPortfolio } from "@/lib/finance/portfolio";
import { assetClassFor, familyName, friendlyCategory, planOf, schemeKey } from "@/lib/finance/categorize";
import { costTable, pastRegularCost, regularVsDirectGap, terDrag } from "@/lib/finance/costs";
import { goalProgress, sipNeeded } from "@/lib/finance/goals";
import { loadIndexes, sampleCas } from "./helpers";

describe("categorisation", () => {
  it("normalises names", () => {
    expect(familyName("HDFC Flexi Cap Fund - Regular Plan - Growth Option")).toBe("HDFC Flexi Cap Fund");
    expect(schemeKey("Axis ELSS- Tax Saver Fund")).toBe(schemeKey("Axis ELSS Tax Saver Fund - Direct Plan - Growth"));
    expect(planOf("Foo Fund - Growth", "ARN-1")).toBe("Regular");
    expect(planOf("Foo Fund - Direct Plan - Growth", "ARN-1")).toBe("Direct");
    expect(planOf("Foo Fund - Growth", "INA000001")).toBe("Direct");
  });
  it("maps AMFI categories to asset classes", () => {
    expect(friendlyCategory("Equity Scheme - Flexi Cap Fund", "x")).toBe("Flexi Cap");
    expect(friendlyCategory("Equity Scheme - ELSS", "x")).toBe("ELSS (Tax Saver)");
    expect(assetClassFor("Debt Scheme - Liquid Fund", "Liquid", "x")).toBe("Debt");
    expect(assetClassFor("Other Scheme - Index Funds", "Index Fund", "UTI Nifty 50 Index Fund")).toBe("Equity");
    expect(assetClassFor("Other Scheme - FoF Overseas", "FoF Overseas", "Motilal Oswal Nasdaq 100 FOF")).toBe("International");
    expect(assetClassFor(null, friendlyCategory(null, "Some Gold ETF FoF"), "Some Gold ETF FoF")).toBe("Gold & Silver");
  });
});

describe("portfolio from the sample CAS", () => {
  it("computes totals, XIRR and allocation", async () => {
    const cas = await sampleCas();
    const { schemeIndex, terIndex } = await loadIndexes();
    const p = buildPortfolio(cas, { schemeIndex, terIndex });
    expect(p.holdings).toHaveLength(7);
    expect(p.closed).toHaveLength(1); // ICICI liquid fully redeemed
    const sum = cas.folios.flatMap((f) => f.schemes).reduce((s, x) => s + (x.valuation.value ?? 0), 0);
    expect(p.value).toBeCloseTo(sum, 0);
    expect(p.xirr).not.toBeNull();
    expect(p.xirr!).toBeGreaterThan(0.05);
    expect(p.xirr!).toBeLessThan(0.35);
    for (const h of p.holdings) {
      expect(h.amfiCode, h.name).not.toBeNull();
      expect(h.xirr, h.name).not.toBeNull();
      expect(h.cost).toBeGreaterThan(0);
    }
    const share = p.allocation.assetClass.reduce((s, x) => s + x.share, 0);
    expect(share).toBeCloseTo(1, 6);
    expect(p.allocation.assetClass[0].key).toBe("Equity");
    expect(p.holdings.filter((h) => h.plan === "Regular").map((h) => h.shortName).sort()).toEqual(["Axis ELSS Tax Saver Fund", "HDFC Flexi Cap Fund"]);
    const hdfc = p.holdings.find((h) => h.shortName === "HDFC Flexi Cap Fund")!;
    expect(hdfc.directCode).toBe(118955);
    // Closed liquid fund: realised gain is positive, nothing left
    expect(p.closed[0].realisedGain).toBeGreaterThan(0);
    expect(p.closed[0].value).toBe(0);
  });

  it("cost of remaining units uses FIFO after partial redemption", async () => {
    const cas = await sampleCas();
    const p = buildPortfolio(cas);
    const bond = p.holdings.find((h) => h.isin === "INF179K01XD8")!;
    // 2,00,000 invested, ~50,000 of units redeemed at a profit: remaining cost < 2,00,000 and > 1,40,000
    expect(bond.cost).toBeLessThan(200000);
    expect(bond.cost).toBeGreaterThan(140000);
    expect(bond.realisedGain).toBeGreaterThan(0);
  });

  it("uses newer live NAVs when provided", async () => {
    const cas = await sampleCas();
    const { schemeIndex } = await loadIndexes();
    const base = buildPortfolio(cas, { schemeIndex });
    const ppfas = base.holdings.find((h) => h.amfiCode === 122639)!;
    const live = buildPortfolio(cas, { schemeIndex, latestNav: { 122639: { nav: ppfas.nav! * 1.1, date: "2099-01-01" } } });
    const p2 = live.holdings.find((h) => h.amfiCode === 122639)!;
    expect(p2.value).toBeCloseTo(ppfas.value * 1.1, 0);
    expect(p2.navDate).toBe("2099-01-01");
  });
});

describe("costs & goals", () => {
  it("computes TER drag with compounding", () => {
    expect(terDrag(100000, 1, 1, 10)).toBeCloseTo(1000, 6);
    expect(terDrag(100000, 1, 10, 10)).toBeCloseTo(100000 * (1.1 ** 10 - 1.09 ** 10), 6);
    expect(terDrag(100000, 0, 20, 10)).toBe(0);
    expect(regularVsDirectGap(100000, 1.5, 0.5, 10, 10)).toBeCloseTo(100000 * (1.095 ** 10 - 1.085 ** 10), 6);
  });

  it("builds a cost table for the sample", async () => {
    const { schemeIndex, terIndex } = await loadIndexes();
    const p = buildPortfolio(await sampleCas(), { schemeIndex, terIndex });
    const rows = costTable(p.holdings, 8);
    const reg = rows.filter((r) => r.holding.plan === "Regular");
    expect(reg).toHaveLength(2);
    for (const r of reg) {
      expect(r.extraTer!).toBeGreaterThan(0);
      expect(r.regularGap![20]).toBeGreaterThan(r.regularGap![5]);
    }
  });

  it("computes past regular-plan cost against a direct-plan NAV series", async () => {
    const p = buildPortfolio(await sampleCas());
    const hdfc = p.holdings.find((h) => h.isin === "INF179K01608")!;
    // Synthetic direct series: always 10% higher NAV growth path -> fewer units but higher value
    const dates = hdfc.transactions.filter((t) => t.nav).map((t) => t.date);
    const navs = hdfc.transactions.filter((t) => t.nav).map((t) => t.nav! * 1.05);
    const res = pastRegularCost(hdfc, { dates, navs }, hdfc.nav! * 1.15)!;
    expect(res.directValue).toBeGreaterThan(hdfc.value);
    expect(res.lost).toBeCloseTo(res.directValue - hdfc.value, 6);
  });

  it("goal maths", () => {
    expect(sipNeeded(0, 12, 8)).toBe(0);
    expect(sipNeeded(12000, 12, 0)).toBeCloseTo(1000, 6);
    const sip = sipNeeded(100000, 12, 12);
    expect(sip).toBeLessThan(100000 / 12);
    const g = goalProgress(
      { id: "g", name: "Home", emoji: "🏠", target: 1000000, targetDate: "2030-01-01", linked: [], sharePct: 50, assumedPct: 0 },
      [{ id: "a", value: 600000 } as never],
      "2025-01-01",
    );
    expect(g.current).toBe(300000);
    expect(g.progress).toBeCloseTo(0.3, 6);
    expect(g.monthsLeft).toBe(60);
    expect(g.monthlyNeeded).toBeCloseTo(700000 / 60, 4);
  });
});

describe("benchmark replay", () => {
  it("replays cash flows on a benchmark NAV series", async () => {
    const { simulateBenchmark } = await import("@/lib/finance/benchmark");
    const series = { dates: ["2020-01-01", "2021-01-01", "2022-01-01"], navs: [10, 11, 12.1] };
    const r = simulateBenchmark([{ date: "2020-01-01", amount: -1000 }, { date: "2021-01-01", amount: -1100 }], series)!;
    expect(r.value).toBeCloseTo(100 * 12.1 + 100 * 12.1, 6);
    expect(r.xirr!).toBeCloseTo(0.1, 3); // 2020 is a leap year (Actual/365)
    expect(simulateBenchmark([{ date: "2019-01-01", amount: -1 }], series)).toBeNull();
  });
});
