import { describe, expect, it } from "vitest";
import { shareCardData } from "@/lib/shareCard";
import { buildPortfolio } from "@/lib/finance/portfolio";
import { overlapReport } from "@/lib/overlap";
import { loadHoldings, loadIndexes, sampleCas } from "./helpers";

describe("share card data", () => {
  it("is percentages-only by default and never carries identifiers", async () => {
    const cas = await sampleCas();
    const { schemeIndex, terIndex } = await loadIndexes();
    const p = buildPortfolio(cas, { schemeIndex, terIndex });
    const o = overlapReport(p.holdings, await loadHoldings());
    const d = shareCardData(p, o, { showAmounts: false, showXirr: true });
    const json = JSON.stringify(d);
    expect(json).not.toMatch(/₹/);
    for (const s of [cas.investor.name!, cas.investor.email!, "ABCDE1234F", ...cas.folios.map((f) => f.folio), ...cas.folios.flatMap((f) => f.schemes.map((x) => x.isin!))]) expect(json).not.toContain(s);
    expect(d.topStocks).toHaveLength(4);
    expect(d.overlap?.pct).toBeGreaterThan(0);
    expect(shareCardData(p, o, { showAmounts: true, showXirr: false }).stats[0].value).toMatch(/₹/);
  });
});
