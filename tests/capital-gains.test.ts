import { describe, expect, it } from "vitest";
import { fundTaxType, fyOf, idcwIncome, longTermFrom, realisedGains, summarise, taxClassFor, termOf, unrealisedGains, upcomingLongTerm, type GainSlice } from "@/lib/finance/capitalGains";
import { buildPortfolio, type Holding } from "@/lib/finance/portfolio";
import { runFifo } from "@/lib/finance/lots";
import type { Transaction, TransactionType } from "@/lib/cas/types";
import { loadIndexes, sampleCas } from "./helpers";

const tx = (date: string, type: TransactionType, amount: number | null, units: number, nav: number | null = null): Transaction => ({ date, description: type, amount, units, nav, balance: null, type });

function holding(partial: Partial<Holding> & { transactions: Transaction[] }): Holding {
  const f = runFifo(partial.transactions, 0);
  return {
    id: "h1", folio: "F", amc: "AMC", name: "Test Fund", shortName: "Test Fund", isin: null, amfiCode: 1, plan: "Direct", option: "Growth", advisor: null, rta: null,
    amfiCategory: null, category: "Flexi Cap", assetClass: "Equity", units: f.lots.reduce((s, l) => s + l.units, 0), nav: 20, navDate: "2026-11-03",
    value: 0, cost: f.cost, unrealisedGain: 0, realisedGain: f.realised, totalInvested: 0, totalWithdrawn: 0, xirr: null, incompleteHistory: false, firstDate: null,
    cashflows: [], ter: { regular: null, direct: null, source: "estimate" }, directCode: null, lots: f.lots, disposals: f.disposals,
    ...partial,
  } as Holding;
}

describe("rules", () => {
  it("financial years", () => {
    expect(fyOf("2026-03-31")).toBe("2025-26");
    expect(fyOf("2026-04-01")).toBe("2026-27");
    expect(fyOf("2027-01-15")).toBe("2026-27");
  });

  it("long-term only when held MORE than 12 / 24 months", () => {
    expect(termOf("equity", "2025-01-15", "2026-01-15")).toBe("short"); // exactly 12 months
    expect(termOf("equity", "2025-01-15", "2026-01-16")).toBe("long");
    expect(termOf("equity", "2024-02-29", "2025-03-01")).toBe("long"); // leap-day purchase
    expect(termOf("debt-legacy", "2022-06-01", "2024-06-01")).toBe("short");
    expect(termOf("debt-legacy", "2022-06-01", "2024-06-02")).toBe("long");
    expect(termOf("debt-specified", "2023-04-01", "2030-01-01")).toBe("short"); // always slab
    expect(termOf("equity", null, "2026-01-01")).toBe("unknown");
    expect(longTermFrom("equity", "2025-11-10")).toBe("2026-11-11");
  });

  it("classifies funds and lots", () => {
    expect(fundTaxType({ assetClass: "Equity", category: "Flexi Cap", name: "x" })).toBe("equity");
    expect(fundTaxType({ assetClass: "Hybrid", category: "Aggressive Hybrid", name: "x" })).toBe("equity");
    expect(fundTaxType({ assetClass: "Hybrid", category: "Arbitrage", name: "x" })).toBe("equity");
    expect(fundTaxType({ assetClass: "Hybrid", category: "Conservative Hybrid", name: "x" })).toBe("debt");
    expect(fundTaxType({ assetClass: "Hybrid", category: "Multi Asset Allocation", name: "x" }, 70)).toBe("equity");
    expect(fundTaxType({ assetClass: "Hybrid", category: "Multi Asset Allocation", name: "x" }, 50)).toBe("other");
    expect(fundTaxType({ assetClass: "Gold & Silver", category: "Gold", name: "x" })).toBe("other");
    expect(fundTaxType({ assetClass: "International", category: "FoF Overseas", name: "x" })).toBe("other");
    expect(taxClassFor("debt", "2023-03-31")).toBe("debt-legacy");
    expect(taxClassFor("debt", "2023-04-01")).toBe("debt-specified");
  });
});

describe("FIFO gains", () => {
  it("splits one redemption across lots into short- and long-term parts", () => {
    const h = holding({
      transactions: [tx("2024-01-10", "PURCHASE", 10000, 1000), tx("2025-06-10", "PURCHASE", 15000, 1000), tx("2025-09-01", "REDEMPTION", -24000, -1500)],
    });
    const r = realisedGains([h]);
    expect(r.map((s) => [s.acquired, s.term, Math.round(s.units), Math.round(s.cost), Math.round(s.value), Math.round(s.gain)])).toEqual([
      ["2024-01-10", "long", 1000, 10000, 16000, 6000],
      ["2025-06-10", "short", 500, 7500, 8000, 500],
    ]);
    expect(r[0].fy).toBe("2025-26");
  });

  it("applies grandfathering for equity units bought on or before 31 Jan 2018", () => {
    const h = holding({ transactions: [tx("2017-06-01", "PURCHASE", 10000, 1000), tx("2026-05-01", "REDEMPTION", -30000, -1000)] });
    const navs = { 1: { dates: ["2018-01-31"], navs: [18] } }; // FMV 18,000 > cost 10,000
    const [s] = realisedGains([h], { navs });
    expect(s.grandfathered).toBe(true);
    expect(s.taxCost).toBe(18000);
    expect(s.gain).toBe(12000);
    // FMV above the sale value caps the step-up at the sale value (no artificial loss)
    const h2 = holding({ transactions: [tx("2017-06-01", "PURCHASE", 10000, 1000), tx("2026-05-01", "REDEMPTION", -15000, -1000)] });
    const [s2] = realisedGains([h2], { navs });
    expect(s2.taxCost).toBe(15000);
    expect(s2.gain).toBe(0);
    // without the 31-Jan-2018 NAV we say so instead of guessing
    expect(realisedGains([h])[0].grandfatherMissing).toBe(true);
  });

  it("taxes post-April-2023 debt units at slab, older ones as LTCG after 24 months", () => {
    const debt = holding({
      assetClass: "Debt", category: "Corporate Bond",
      transactions: [tx("2022-01-01", "PURCHASE", 10000, 1000), tx("2023-06-01", "PURCHASE", 10000, 800), tx("2026-06-01", "REDEMPTION", -27000, -1800)],
    });
    const r = realisedGains([debt]);
    expect(r.map((s) => [s.taxClass, s.term])).toEqual([["debt-legacy", "long"], ["debt-specified", "short"]]);
  });

  it("does not treat a merger as a sale, and unknown-date lots are flagged", () => {
    const h = holding({ transactions: [tx("2021-01-01", "PURCHASE", 10000, 100), tx("2023-01-01", "MERGER_OUT", -12000, -100)] });
    expect(realisedGains([h])).toHaveLength(0);
    const opening = { ...holding({ transactions: [] }), lots: [{ units: 10, cost: 0, date: null }], units: 10 };
    expect(unrealisedGains([opening], "2026-11-03")[0].term).toBe("unknown");
  });
});

describe("FY summary", () => {
  const mk = (taxClass: GainSlice["taxClass"], term: GainSlice["term"], gain: number): GainSlice => ({
    holdingId: "h", fund: "f", taxClass, term, acquired: "2020-01-01", date: "2026-06-01", fy: "2026-27", units: 1, cost: 0, taxCost: 0, value: gain, gain, grandfathered: false, grandfatherMissing: false,
  });

  it("applies the ₹1.25 lakh equity LTCG exemption, rates and cess", () => {
    const s = summarise([mk("equity", "long", 200000), mk("equity", "short", 50000), mk("debt-specified", "short", 10000), mk("other", "long", 20000)], 30);
    expect(s.exemptionUsed).toBe(125000);
    expect(s.equityLTTaxable).toBe(75000);
    expect(s.tax.equityLT).toBeCloseTo(9375, 6);
    expect(s.tax.equityST).toBeCloseTo(10000, 6);
    expect(s.tax.slab).toBeCloseTo(3000, 6);
    expect(s.tax.otherLT).toBeCloseTo(2500, 6);
    expect(s.tax.total).toBeCloseTo((9375 + 10000 + 3000 + 2500) * 1.04, 6);
  });

  it("nets losses within a bucket and respects exemption already used", () => {
    const s = summarise([mk("equity", "long", 100000), mk("equity", "long", -30000)], 0, 100000);
    expect(s.equityLT).toBe(70000);
    expect(s.exemption).toBe(25000);
    expect(s.equityLTTaxable).toBe(45000);
    expect(summarise([mk("equity", "short", -5000)], 30).tax.total).toBe(0);
  });
});

describe("sample portfolio", () => {
  it("produces realised and unrealised slices that reconcile with FIFO cost", async () => {
    const { schemeIndex } = await loadIndexes();
    const p = buildPortfolio(await sampleCas(), { schemeIndex });
    const all = [...p.holdings, ...p.closed];
    const realised = realisedGains(all);
    expect(realised.length).toBeGreaterThanOrEqual(3);
    const bond = realised.filter((s) => s.fund === "HDFC Corporate Bond Fund");
    expect(new Set(bond.map((s) => s.taxClass))).toEqual(new Set(["debt-legacy"])); // bought Jul 2021
    const elss = realised.filter((s) => s.fund === "Axis ELSS Tax Saver Fund");
    expect(elss.every((s) => s.term === "long")).toBe(true);
    const unreal = unrealisedGains(p.holdings, p.asOf!);
    for (const h of p.holdings) {
      const cost = unreal.filter((s) => s.holdingId === h.id).reduce((a, s) => a + s.cost, 0);
      expect(cost).toBeCloseTo(h.cost, 0);
    }
    expect(upcomingLongTerm(unreal, p.asOf!).length).toBeGreaterThan(0); // recent SIP lots turn long-term soon
    expect(Object.keys(idcwIncome(all))).toEqual([]); // sample holds growth options only
  });
});
