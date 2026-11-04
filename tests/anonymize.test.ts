import { describe, expect, it } from "vitest";
import { buildAiContext, containsPII, scrubText } from "@/lib/ai/anonymize";
import { localAnswer } from "@/lib/ai/localAnswer";
import { buildPortfolio } from "@/lib/finance/portfolio";
import { overlapReport } from "@/lib/overlap";
import { loadIndexes, sampleCas } from "./helpers";

describe("anonymised AI context", () => {
  it("never contains PAN, name, email, folio numbers or ISINs", async () => {
    const cas = await sampleCas();
    const { schemeIndex, terIndex } = await loadIndexes();
    const p = buildPortfolio(cas, { schemeIndex, terIndex });
    const ctx = buildAiContext(p, overlapReport(p.holdings));
    const json = JSON.stringify(ctx);
    const secrets = [cas.investor.name, cas.investor.email, cas.investor.mobile, ...cas.folios.map((f) => f.folio), ...cas.folios.map((f) => f.pan)];
    for (const s of secrets) expect(json).not.toContain(s!);
    for (const f of cas.folios) for (const s of f.schemes) expect(json).not.toContain(s.isin!);
    expect(containsPII(json, secrets)).toBe(false);
    expect(ctx.funds).toHaveLength(7);
    expect(ctx.totals.value).toBeGreaterThan(0);
    expect(json).not.toMatch(/"(transactions|folio|pan|isin|email)"/i);
  });

  it("scrubs identifiers from user questions", () => {
    const q = "I'm Ananya Rao, PAN ABCDE1234F, email ananya@example.com, folio 29384756 / 41, phone 9800000000 — what's my XIRR?";
    const out = scrubText(q, ["Ananya Rao"]);
    expect(out).not.toMatch(/ABCDE1234F|ananya|29384756|9800000000/i);
    expect(out).toContain("XIRR");
  });
});

describe("local (mock-mode) answers", () => {
  it("answers from data and refuses advice / forecasts", async () => {
    const { schemeIndex, terIndex } = await loadIndexes();
    const p = buildPortfolio(await sampleCas(), { schemeIndex, terIndex });
    const ctx = buildAiContext(p, overlapReport(p.holdings));
    expect(localAnswer("What's my overall XIRR?", ctx)).toMatch(/XIRR/);
    expect(localAnswer("How much am I paying in fees?", ctx)).toMatch(/expense ratio/);
    expect(localAnswer("Which funds overlap?", ctx)).toMatch(/↔/);
    expect(localAnswer("Should I sell HDFC Flexi Cap?", ctx)).toMatch(/SEBI-registered/);
    expect(localAnswer("What will my portfolio be worth next year?", ctx)).toMatch(/can't predict/);
  });
});
