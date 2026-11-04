import { describe, expect, it } from "vitest";
import { holdingsFor, indexTracked, overlapReport, pairOverlap } from "@/lib/overlap";
import { buildPortfolio } from "@/lib/finance/portfolio";
import { loadIndexes, sampleCas } from "./helpers";

describe("pairOverlap", () => {
  it("sums the minimum common weight", () => {
    const a = [{ name: "HDFC Bank", weight: 10 }, { name: "Infosys", weight: 5 }, { name: "TCS", weight: 3 }];
    const b = [{ name: "hdfc bank", weight: 6 }, { name: "Infosys", weight: 8 }, { name: "ITC", weight: 4 }];
    const r = pairOverlap(a, b);
    expect(r.overlap).toBe(11);
    expect(r.common.map((c) => c.name)).toEqual(["HDFC Bank", "Infosys"]);
  });
  it("is symmetric and 0 for disjoint funds", () => {
    const a = [{ name: "A", weight: 10 }, { name: "B", weight: 20 }];
    const b = [{ name: "B", weight: 5 }];
    expect(pairOverlap(a, b).overlap).toBe(pairOverlap(b, a).overlap);
    expect(pairOverlap(a, [{ name: "Z", weight: 50 }]).overlap).toBe(0);
  });
  it("identical portfolios overlap fully", () => {
    const a = [{ name: "A", weight: 60 }, { name: "B", weight: 40 }];
    expect(pairOverlap(a, a).overlap).toBe(100);
  });
});

describe("holdings lookup", () => {
  it("detects index funds", () => {
    expect(indexTracked("UTI Nifty 50 Index Fund - Direct Plan - Growth")).toBe("NIFTY 50");
    expect(indexTracked("ICICI Prudential Nifty Next 50 Index Fund")).toBe("NIFTY NEXT 50");
    expect(indexTracked("Nippon India ETF Nifty 50 BeES")).toBe("NIFTY 50");
    expect(indexTracked("HDFC Nifty Midcap 150 Index Fund")).toBeNull();
    expect(indexTracked("HDFC Flexi Cap Fund")).toBeNull();
  });
  it("finds snapshot holdings regardless of plan/option", () => {
    expect(holdingsFor("HDFC Flexi Cap Fund - Regular Plan - Growth Option")?.source).toBe("fund-snapshot");
    expect(holdingsFor("Parag Parikh Flexi Cap Fund - Direct Plan - Growth")?.holdings.length).toBeGreaterThan(5);
    expect(holdingsFor("Some Unknown Fund - Direct Plan - Growth")).toBeNull();
  });
});

describe("overlapReport on the sample", () => {
  it("covers equity funds and ranks pairs", async () => {
    const { schemeIndex } = await loadIndexes();
    const p = buildPortfolio(await sampleCas(), { schemeIndex });
    const r = overlapReport(p.holdings);
    expect(r.covered.length).toBe(6); // all equity funds in the sample have data
    expect(r.missing).toHaveLength(0);
    expect(r.pairs).toHaveLength(15);
    for (let i = 1; i < r.pairs.length; i++) expect(r.pairs[i - 1].overlap).toBeGreaterThanOrEqual(r.pairs[i].overlap);
    const top = r.exposure[0];
    expect(top.name).toBe("HDFC Bank");
    expect(top.funds.length).toBeGreaterThanOrEqual(5);
    // Bond fund isn't part of stock overlap
    expect(r.covered.some((c) => c.holding.assetClass === "Debt")).toBe(false);
  });
});
