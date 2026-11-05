import { describe, expect, it } from "vitest";
import { holdingsFor, indexTracked, overlapReport, pairOverlap, verdictFor } from "@/lib/overlap";
import { buildPortfolio } from "@/lib/finance/portfolio";
import { loadHoldings, loadIndexes, sampleCas } from "./helpers";

describe("pairOverlap", () => {
  it("sums the minimum common weight, keyed by ISIN when present", () => {
    const a = [{ id: "INE040A01034", name: "HDFC Bank", weight: 10 }, { id: "INE009A01021", name: "Infosys", weight: 5 }, { id: "X", name: "TCS", weight: 3 }];
    const b = [{ id: "INE040A01034", name: "HDFC BANK LTD", weight: 6 }, { id: "INE009A01021", name: "Infosys Ltd", weight: 8 }, { id: "Y", name: "ITC", weight: 4 }];
    const r = pairOverlap(a, b);
    expect(r.overlap).toBe(11);
    expect(r.common.map((c) => c.id)).toEqual(["INE040A01034", "INE009A01021"]);
  });
  it("falls back to normalised names without ISINs", () => {
    const r = pairOverlap([{ name: "HDFC Bank Limited", weight: 10 }], [{ name: "HDFC BANK LTD", weight: 7 }]);
    expect(r.overlap).toBe(7);
  });
  it("is symmetric, 0 for disjoint and 100 for identical funds", () => {
    const a = [{ name: "A", weight: 60 }, { name: "B", weight: 40 }];
    expect(pairOverlap(a, [{ name: "B", weight: 5 }]).overlap).toBe(pairOverlap([{ name: "B", weight: 5 }], a).overlap);
    expect(pairOverlap(a, [{ name: "Z", weight: 50 }]).overlap).toBe(0);
    expect(pairOverlap(a, a).overlap).toBe(100);
  });
  it("produces plain-language verdicts", () => {
    expect(verdictFor(68).verdict).toBe("68% the same — these two are nearly the same portfolio");
    expect(verdictFor(40).level).toBe("medium");
    expect(verdictFor(20).level).toBe("low");
    expect(verdictFor(3).level).toBe("minimal");
  });
});

describe("index detection", () => {
  it.each([
    ["UTI Nifty 50 Index Fund - Direct Plan - Growth", "NIFTY 50"],
    ["ICICI Prudential Nifty Next 50 Index Fund", "NIFTY NEXT 50"],
    ["Nippon India ETF Nifty 50 BeES", "NIFTY 50"],
    ["HDFC Nifty Midcap 150 Index Fund", "NIFTY MIDCAP 150"],
    ["SBI Nifty50 Equal Weight Index Fund", null],
    ["HDFC Flexi Cap Fund", null],
  ])("%s → %s", (name, idx) => expect(indexTracked(name)).toBe(idx));
});

describe("real holdings snapshot (AMC disclosures)", () => {
  it("covers at least 100 schemes from multiple AMCs, with ISIN-keyed stocks", async () => {
    const idx = await loadHoldings();
    expect(idx.schemeCount).toBeGreaterThanOrEqual(100);
    expect(idx.file.sources.length).toBeGreaterThanOrEqual(5);
    expect(idx.month).toMatch(/^\d{4}-\d{2}$/);
    for (const [isin] of idx.file.stocks.slice(0, 200)) expect(isin).toMatch(/^[A-Z]{2}[A-Z0-9]{9}\d$/);
    for (const s of idx.file.schemes) {
      const total = s.h.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0) / 100;
      expect(total, s.n).toBeLessThanOrEqual(101);
    }
  });

  it("resolves sample funds by plan ISIN, index proxy or labelled approximation", async () => {
    const idx = await loadHoldings();
    const ppfas = holdingsFor({ isin: "INF879O01027", name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth" }, idx)!;
    expect(ppfas.source).toBe("disclosure");
    expect(ppfas.holdings.length).toBeGreaterThan(20);
    const uti = holdingsFor({ isin: "INF789F01XA0", name: "UTI Nifty 50 Index Fund - Direct Plan - Growth" }, idx)!;
    expect(uti.source).toBe("index-proxy");
    expect(uti.holdings.length).toBe(50);
    const hdfc = holdingsFor({ isin: "INF179K01608", name: "HDFC Flexi Cap Fund - Regular Plan - Growth Option" }, idx)!;
    expect(hdfc.source).toBe("approximate");
    expect(hdfc.partial).toBe(true);
    // approximate names are mapped onto real ISINs where possible, so they overlap with disclosed funds
    expect(hdfc.holdings.find((h) => /HDFC Bank/.test(h.name))?.id).toBe("INE040A01034");
  });
});

describe("overlapReport on the sample", () => {
  it("ranks pairs, computes look-through and sector exposure", async () => {
    const { schemeIndex } = await loadIndexes();
    const idx = await loadHoldings();
    const p = buildPortfolio(await sampleCas(), { schemeIndex });
    const r = overlapReport(p.holdings, idx);
    expect(r.covered.length).toBe(6);
    expect(r.pairs).toHaveLength(15);
    for (let i = 1; i < r.pairs.length; i++) expect(r.pairs[i - 1].overlap).toBeGreaterThanOrEqual(r.pairs[i].overlap);
    expect(r.pairs[0].verdict).toMatch(/% the same/);
    expect(r.exposure[0].name).toMatch(/HDFC Bank|ICICI Bank/);
    expect(r.exposure.length).toBeGreaterThan(100); // full portfolios, not just top-10s
    const sectorTotal = r.sectors.reduce((s, x) => s + x.share, 0);
    expect(sectorTotal).toBeCloseTo(1, 6);
    expect(r.sectors[0].sector).toBe("Banks");
    expect(r.officialCoverage).toBeGreaterThan(0.4);
    expect(r.dataMonth).toBe(idx.month);
    expect(r.covered.some((c) => c.holding.assetClass === "Debt")).toBe(false);
  });

  it("still works without the snapshot (approximate fallback only)", async () => {
    const p = buildPortfolio(await sampleCas());
    const r = overlapReport(p.holdings, null);
    expect(r.covered.every((c) => c.data.source === "approximate")).toBe(true);
    expect(r.officialCoverage).toBe(0);
  });
});
