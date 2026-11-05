import { describe, expect, it } from "vitest";
import { classifyTransaction, parseAmount, parseCASDate, parseCASLines } from "@/lib/cas/parser";
import { CASParseError } from "@/lib/cas/types";
import { expected, sampleCas, samplePdfLines } from "./helpers";

describe("primitives", () => {
  it("parses CAS dates", () => {
    expect(parseCASDate("05-Feb-2019")).toBe("2019-02-05");
    expect(parseCASDate("31-dec-2024")).toBe("2024-12-31");
    expect(parseCASDate("2024-01-01")).toBeNull();
  });
  it("parses Indian-format amounts and parentheses negatives", () => {
    expect(parseAmount("1,23,456.78")).toBe(123456.78);
    expect(parseAmount("(5,000.00)")).toBe(-5000);
    expect(parseAmount("-12.5")).toBe(-12.5);
    expect(parseAmount("abc")).toBeNull();
  });
  it("classifies transactions", () => {
    expect(classifyTransaction("SIP Purchase - Instalment No 3", 10, 1000)).toBe("PURCHASE_SIP");
    expect(classifyTransaction("Systematic Investment (1)", 10, 1000)).toBe("PURCHASE_SIP");
    expect(classifyTransaction("Purchase", 10, 1000)).toBe("PURCHASE");
    expect(classifyTransaction("Redemption", -10, -1000)).toBe("REDEMPTION");
    expect(classifyTransaction("Switch-Out - To Liquid Fund", -10, -1000)).toBe("SWITCH_OUT");
    expect(classifyTransaction("Switch In - From Equity Fund", 10, 1000)).toBe("SWITCH_IN");
    expect(classifyTransaction("Stamp Duty", null, 0.25)).toBe("STAMP_DUTY_TAX");
    expect(classifyTransaction("STT Paid", null, 1)).toBe("STT_TAX");
    expect(classifyTransaction("IDCW Reinvestment @ Rs.1.20 per unit", 5, 600)).toBe("DIVIDEND_REINVEST");
    expect(classifyTransaction("IDCW Paid @ Rs.2 per unit", null, 600)).toBe("DIVIDEND_PAYOUT");
    expect(classifyTransaction("Purchase - Reversal", -10, -1000)).toBe("REVERSAL");
  });
});

describe("synthetic sample CAS (PDF, password-protected)", () => {
  it("rejects a wrong password", async () => {
    await expect(samplePdfLines("wrong")).rejects.toMatchObject({ code: "INCORRECT_PASSWORD" });
  });

  it("parses investor, period, folios and schemes", async () => {
    const cas = await sampleCas();
    const exp = await expected();
    expect(cas.casType).toBe("DETAILED");
    expect(cas.statementPeriod).toEqual({ from: exp.from, to: exp.to });
    expect(cas.investor.name).toBe(exp.investorName);
    expect(cas.investor.email).toBe("ananya.rao@example.com");
    expect(cas.folios).toHaveLength(exp.folios);
    const schemes = cas.folios.flatMap((f) => f.schemes);
    expect(schemes).toHaveLength(exp.schemes.length);
    expect(cas.warnings).toEqual([]);
    for (const e of exp.schemes) {
      const s = schemes.find((x) => x.isin === e.isin);
      expect(s, e.name).toBeDefined();
      expect(s!.name).toBe(e.name);
      expect(s!.close).toBeCloseTo(e.close, 3);
      expect(s!.valuation.nav).toBeCloseTo(e.nav, 4);
      expect(s!.valuation.date).toBe(e.navDate);
      expect(s!.valuation.value).toBeCloseTo(e.value, 2);
      expect(s!.transactions).toHaveLength(e.txnCount);
    }
  });

  it("handles wrapped scheme headers and advisor codes", async () => {
    const cas = await sampleCas();
    const nippon = cas.folios.flatMap((f) => f.schemes).find((s) => s.isin === "INF204K01K15")!;
    expect(nippon.name).toBe("Nippon India Small Cap Fund - Direct Plan - Growth Plan - Growth Option");
    expect(nippon.advisor).toBe("DIRECT");
    expect(nippon.rta).toBe("KFINTECH");
    const hdfc = cas.folios.flatMap((f) => f.schemes).find((s) => s.isin === "INF179K01608")!;
    expect(hdfc.advisor).toBe("ARN-000000");
    expect(hdfc.rtaCode).toBe("B205RG");
  });

  it("keeps the AMC for each folio and parses redemptions as negative", async () => {
    const cas = await sampleCas();
    const icici = cas.folios.find((f) => f.amc === "ICICI Prudential Mutual Fund")!;
    expect(icici.folio).toBe("11923847 / 12");
    const liquid = icici.schemes[0];
    expect(liquid.close).toBe(0);
    const red = liquid.transactions.find((t) => t.type === "REDEMPTION")!;
    expect(red.units!).toBeLessThan(0);
    expect(red.amount!).toBeLessThan(0);
  });
});

describe("text-only statements (no column tabs)", () => {
  const lines = [
    "Consolidated Account Statement",
    "01-Apr-2020 To 31-Mar-2024",
    "Email Id: test@example.com",
    "Test Investor",
    "Mobile: +919999999999",
    "Axis Mutual Fund",
    "Folio No: 9100000001 / 0 PAN: AAAAA0000A KYC: OK PAN: OK",
    "128TSGPG-Axis ELSS Tax Saver Fund - Regular Growth - ISIN: INF846K01131",
    "(Advisor: ARN-12345) Registrar : KFINTECH",
    "Opening Unit Balance: 0.000",
    "10-Jan-2021 Purchase 49,997.50 806.414 62.0000 806.414",
    "10-Jan-2021 *** Stamp Duty *** 2.50",
    "11-Mar-2024 Redemption (20,000.00) (200.000) 100.0000 606.414",
    "11-Mar-2024 *** STT Paid *** 0.20",
    "Closing Unit Balance: 606.414 NAV on 28-Mar-2024: INR 101.2500 Total Cost Value: 37,598.96 Market Value on 28-Mar-2024: INR 61,399.42",
  ];
  it("parses with the loose regexes", () => {
    const cas = parseCASLines(lines);
    const s = cas.folios[0].schemes[0];
    expect(cas.folios[0].amc).toBe("Axis Mutual Fund");
    expect(cas.folios[0].pan).toBe("AAAAA0000A");
    expect(s.name).toBe("Axis ELSS Tax Saver Fund - Regular Growth");
    expect(s.isin).toBe("INF846K01131");
    expect(s.advisor).toBe("ARN-12345");
    expect(s.transactions.map((t) => t.type)).toEqual(["PURCHASE", "STAMP_DUTY_TAX", "REDEMPTION", "STT_TAX"]);
    expect(s.transactions[2]).toMatchObject({ amount: -20000, units: -200, nav: 100, balance: 606.414 });
    expect(s.close).toBe(606.414);
    expect(s.valuation).toEqual({ date: "2024-03-28", nav: 101.25, value: 61399.42, cost: 37598.96 });
    expect(cas.warnings).toEqual([]);
  });

  it("ignores stray hyphenated lines inside a folio", () => {
    const noisy = [...lines.slice(0, 12), "CAMSONLINE-Toll free 1800 000 0000 (Mon-Sat)", ...lines.slice(12)];
    const cas = parseCASLines(noisy);
    expect(cas.folios[0].schemes).toHaveLength(1);
    expect(cas.folios[0].schemes[0].transactions).toHaveLength(4);
  });

  it("flags units that don't reconcile", () => {
    const broken = lines.map((l) => (l.startsWith("Closing") ? l.replace("606.414", "700.000") : l));
    expect(parseCASLines(broken).warnings[0]).toMatch(/don't reconcile/);
  });

  it("rejects summary statements and non-CAS files", () => {
    expect(() => parseCASLines(["Consolidated Account Summary", "Some fund 100.00"])).toThrow(CASParseError);
    try {
      parseCASLines(["Hello world"]);
    } catch (e) {
      expect((e as CASParseError).code).toBe("NOT_A_CAS");
    }
    expect(() => parseCASLines([])).toThrow(/readable text/);
  });
});
