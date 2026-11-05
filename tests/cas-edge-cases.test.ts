import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCASLines } from "@/lib/cas/parser";
import type { CASData, CASScheme } from "@/lib/cas/types";
import { buildPortfolio } from "@/lib/finance/portfolio";
import { runFifo } from "@/lib/finance/lots";

const load = (name: string): CASData => parseCASLines(readFileSync(path.join(__dirname, "fixtures/cas", `${name}.txt`), "utf8").split("\n"));
const schemes = (c: CASData) => c.folios.flatMap((f) => f.schemes);
const byIsin = (c: CASData, isin: string): CASScheme => schemes(c).find((s) => s.isin === isin)!;
const types = (s: CASScheme) => s.transactions.map((t) => t.type);

describe("CAMS-style statement with switches, STP/SWP, IDCW, segregation, NFO, reversals", () => {
  const cas = load("cams-edge-cases");

  it("parses folios, multiple PANs and zero-balance schemes", () => {
    expect(cas.folios.map((f) => f.folio)).toEqual(["1111111 / 11", "2222222", "3333333 / 0"]);
    expect(new Set(cas.folios.map((f) => f.pan))).toEqual(new Set(["AAAAA1111A", "BBBBB2222B"]));
    expect(cas.warnings).toEqual([]); // every scheme's units reconcile
    const liquid = byIsin(cas, "INF179K01ZZ9");
    expect(liquid.open).toBe(500);
    expect(liquid.close).toBe(0);
    expect(liquid.valuation.value).toBe(0);
  });

  it("classifies every transaction kind correctly", () => {
    expect(types(byIsin(cas, "INF179K01608"))).toEqual([
      "PURCHASE", // NFO allotment
      "PURCHASE_SIP",
      "STAMP_DUTY_TAX",
      "SWITCH_OUT",
      "REDEMPTION", // SWP is a redemption
      "DIVIDEND_REINVEST",
      "REVERSAL",
    ]);
    expect(types(byIsin(cas, "INF179K01XD8"))).toEqual(["SWITCH_IN", "SWITCH_OUT"]); // STP out is a switch, not a reversal
    expect(types(byIsin(cas, "INF179K01ZZ9"))).toEqual(["DIVIDEND_PAYOUT", "REDEMPTION"]);
    expect(types(byIsin(cas, "INF109K01ZY8"))).toEqual(["PURCHASE", "SEGREGATION"]);
  });

  it("builds a portfolio: switches net out, IDCW payout is realised, side-pocket units are free", () => {
    const p = buildPortfolio(cas);
    expect(p.holdings).toHaveLength(3);
    expect(p.closed.map((h) => h.isin)).toEqual(["INF179K01ZZ9"]);
    const flexi = p.holdings.find((h) => h.isin === "INF179K01608")!;
    expect(flexi.disposals.map((d) => d.kind)).toEqual(["switch-out", "redemption"]);
    const sidePocket = p.holdings.find((h) => h.isin === "INF109K01ZY8")!;
    expect(sidePocket.lots.map((l) => l.cost)).toEqual([50000, 0]); // segregated units cost nothing extra
    expect(sidePocket.cost).toBe(50000);
    // the SWP + the reversed purchase are not double counted as sales
    expect(flexi.cashflows.some((f) => f.amount > 0 && f.date === "2022-09-05")).toBe(true); // reversal returns money
  });
});

describe("KFintech-style statement (no column tabs) with a scheme merger", () => {
  const cas = load("kfintech-style");

  it("parses tab-less rows and wrapped registrar text", () => {
    expect(cas.warnings).toEqual([]);
    expect(schemes(cas)).toHaveLength(4);
    const elss = byIsin(cas, "INF846K01131");
    expect(types(elss)).toEqual(["PURCHASE", "STAMP_DUTY_TAX", "PURCHASE_SIP", "REDEMPTION", "STT_TAX"]);
    expect(elss.rta).toBe("KFINTECH");
    expect(cas.folios.find((f) => f.amc.startsWith("Franklin"))).toBeDefined();
  });

  it("treats a merger as a non-cash transfer that keeps cost basis and purchase dates", () => {
    const bluechip = byIsin(cas, "INF090I01239");
    const largecap = byIsin(cas, "INF090I01VV9");
    expect(types(bluechip)).toEqual(["PURCHASE", "MERGER_OUT"]);
    expect(types(largecap)).toEqual(["MERGER_IN"]);
    expect(bluechip.name).toBe("Franklin India Bluechip Fund"); // "(merged into …)" note stripped
    const p = buildPortfolio(cas);
    const lc = p.holdings.find((h) => h.isin === "INF090I01VV9")!;
    expect(lc.lots).toHaveLength(1);
    expect(lc.lots[0]).toMatchObject({ date: "2020-02-01", cost: 20000 }); // original date + cost carried over
    expect(lc.units).toBe(100);
    expect(lc.cost).toBe(20000);
    expect(lc.unrealisedGain).toBe(1000);
    // the merger is not a sale: no realised gain, no extra cash flows
    const closed = p.closed.find((h) => h.isin === "INF090I01239")!;
    expect(closed.disposals).toHaveLength(0);
    expect(closed.realisedGain).toBe(0);
    expect(closed.cashflows).toHaveLength(1);
    expect(lc.cashflows).toHaveLength(0);
  });

  it("flags partial histories instead of guessing (opening balance > 0)", () => {
    const p = buildPortfolio(cas);
    const small = p.holdings.find((h) => h.isin === "INF204K01K15")!;
    expect(small.incompleteHistory).toBe(true);
    expect(small.xirr).toBeNull();
    expect(small.cost).toBe(22000); // falls back to the statement's own cost figure
    expect(p.warnings.join(" ")).toMatch(/doesn't start from your first investment/);
  });
});

describe("noisy layout: page headers/footers, hyphenated footers, wrapped scheme header, stray text", () => {
  const cas = load("noisy-layout");
  it("ignores everything that isn't a holding or transaction", () => {
    expect(schemes(cas)).toHaveLength(1);
    const s = schemes(cas)[0];
    expect(s.name).toBe("Quant Small Cap Fund - Direct Plan - Growth Option");
    expect(s.isin).toBe("INF966L01689");
    expect(s.advisor).toBe("DIRECT");
    expect(types(s)).toEqual(["PURCHASE", "DIVIDEND_REINVEST"]);
    expect(cas.warnings).toEqual([]);
    expect(cas.folios[0].pan).toBe("DDDDD4444D");
    expect(cas.investor.mobile).toBe("+91 9000000003");
  });
});

describe("lot engine", () => {
  const t = (date: string, type: CASScheme["transactions"][number]["type"], amount: number, units: number) => ({ date, description: type, amount, units, nav: null, balance: null, type });
  it("FIFO consumes the oldest lots first and records slices", () => {
    const r = runFifo([t("2020-01-01", "PURCHASE", 1000, 100), t("2021-01-01", "PURCHASE", 1500, 100), t("2022-01-01", "REDEMPTION", -2000, -150)], 0);
    expect(r.disposals).toHaveLength(1);
    expect(r.disposals[0].slices.map((s) => [s.acquired, s.units, s.cost])).toEqual([["2020-01-01", 100, 1000], ["2021-01-01", 50, 750]]);
    expect(r.disposals[0].cost).toBe(1750);
    expect(r.realised).toBe(250);
    expect(r.lots).toEqual([{ units: 50, cost: 750, date: "2021-01-01" }]);
  });
  it("bonus units cost nothing and aren't cash", () => {
    const r = runFifo([t("2020-01-01", "PURCHASE", 1000, 100), { ...t("2020-06-01", "BONUS", 0, 10), amount: null }], 0);
    expect(r.invested).toBe(1000);
    expect(r.lots[1]).toMatchObject({ units: 10, cost: 0 });
  });
});
