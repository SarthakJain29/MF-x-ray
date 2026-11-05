import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { cleanSchemeName, isinKind, parseSheet, parseWorkbook } from "../scripts/holdings/parse-disclosure";
import { buildSnapshot, keepScheme } from "../scripts/holdings/build-snapshot";
import { HoldingsIndex } from "@/lib/holdings/snapshot";
import { compactKey, displayStockName, planNameKey } from "@/lib/holdings/keys";

// A synthetic disclosure sheet in SEBI layout, weights as fractions (like PPFAS / Nippon / DSP).
const fractionSheet: unknown[][] = [
  ["", "Alpha Flexi Cap Fund (An open ended dynamic equity scheme)"],
  ["", "Monthly Portfolio Statement as on September 30, 2026"],
  ["", "Name of the Instrument", "ISIN", "Industry / Rating", "Quantity", "Market Value (Rs. in Lakhs)", "% to Net Assets"],
  ["", "Equity & Equity related"],
  ["", "(a) Listed / awaiting listing on Stock Exchanges"],
  ["X1", "HDFC Bank Limited", "INE040A01034", "Banks", 100, 1000, 0.08],
  ["X2", "Infosys Limited", "INE009A01021", "IT - Software", 100, 500, 0.04],
  ["X3", "HDFC Bank Limited", "INE040A01034", "Banks", 10, 100, 0.01], // duplicate line → summed
  ["", "(b) Foreign Securities"],
  ["X4", "Alphabet Inc A", "US02079K3059", "Interactive Media", 5, 300, 0.03],
  ["", "Derivatives"],
  ["X5", "Infosys Limited Futures", "INE009A01021", "", -10, -50, -0.005],
  ["", "Debt Instruments"],
  ["X6", "7.18% GOI 2033", "IN0020230085", "SOVEREIGN", 1000, 400, 0.04],
  ["X7", "HDFC Ltd NCD", "INE001A07TW5", "CRISIL AAA", 10, 300, 0.03],
  ["", "Units of Mutual Fund"],
  ["X8", "Alpha Liquid Fund - Direct - Growth", "INF000A01AB1", "", 1, 100, 0.01],
  ["", "TREPS / Net Receivables", "", "", "", 2000, 0.76],
  ["", "GRAND TOTAL", "", "", "", 5000, 1],
];

// Same idea, weights in percent and different column order (like Tata), name via "SCHEME NAME :" (like SBI).
const percentSheet: unknown[][] = [
  ["", "SBI Mutual Fund", "017"],
  ["", "SCHEME NAME :", "Beta Large & Midcap Fund"],
  ["", "NAME OF THE INSTRUMENT", "YIELD", "INDUSTRY", "ISIN CODE", "QUANTITY", "MKT VAL", "% to NAV"],
  ["", "EQUITY & EQUITY RELATED"],
  ["", "ICICI BANK LTD", "NA", "Banks", "INE090A01021", 10, 100, 9.5],
  ["", "INFOSYS LTD", "NA", "IT - Software", "INE009A01021", 10, 100, 6],
  ["", "ITC LTD", "NA", "Diversified FMCG", "INE154A01025", 10, 100, 5],
  ["", "LARSEN & TOUBRO LTD", "NA", "Construction", "INE018A01030", 10, 100, 5],
  ["", "BHARTI AIRTEL LTD", "NA", "Telecom - Services", "INE397D01024", 10, 100, 4.5],
  ["", "CASH", "", "", "", "", 1, 70],
];

describe("parse-disclosure", () => {
  it("classifies ISINs", () => {
    expect(isinKind("INE040A01034", "equity")).toBe("equity");
    expect(isinKind("INE001A07TW5", "debt")).toBe("debt");
    expect(isinKind("IN0020230085", "debt")).toBe("debt");
    expect(isinKind("INF000A01AB1", "other")).toBe("fund-units");
    expect(isinKind("US02079K3059", "foreign equity")).toBe("foreign-equity");
    expect(isinKind("INE0H7R23014", "other")).toBe("reit-invit");
  });

  it("parses a fraction-weighted sheet: sections, duplicates, derivatives excluded", () => {
    const s = parseSheet("PPFCF", fractionSheet)!;
    expect(s.name).toBe("Alpha Flexi Cap Fund");
    const hdfc = s.holdings.find((h) => h.isin === "INE040A01034")!;
    expect(hdfc.weight).toBeCloseTo(9, 6); // 8% + 1% duplicate line
    expect(hdfc.kind).toBe("equity");
    expect(s.holdings.find((h) => h.isin === "INE009A01021")!.weight).toBeCloseTo(4, 6); // future not netted in
    expect(s.holdings.find((h) => h.isin === "US02079K3059")!.kind).toBe("foreign-equity");
    expect(s.equityPct).toBeCloseTo(16, 6);
    expect(s.hasDerivatives).toBe(true);
    expect(s.holdings.find((h) => h.isin === "INE001A07TW5")!.industry).toBe(""); // ratings are not sectors
  });

  it("parses a percent-weighted sheet with a different column order", () => {
    const s = parseSheet("SLMF", percentSheet)!;
    expect(s.name).toBe("Beta Large & Midcap Fund");
    expect(s.holdings[0]).toMatchObject({ isin: "INE090A01021", weight: 9.5, industry: "Banks" });
    expect(s.equityPct).toBeCloseTo(30, 6);
  });

  it("reads a workbook and uses the Index sheet for names", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Code", "Scheme Name"], ["GAM", "Gamma Small Cap Fund"]]), "Index");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(percentSheet.map((r, i) => (i < 2 ? [""] : r))), "GAM");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const schemes = parseWorkbook(buf);
    expect(schemes).toHaveLength(1);
    expect(schemes[0].name).toBe("Gamma Small Cap Fund");
  });

  it("cleans scheme titles", () => {
    expect(cleanSchemeName("Invesco India ELSS Tax Saver Fund\n(An open ended equity linked saving scheme)")).toBe("Invesco India ELSS Tax Saver Fund");
    expect(cleanSchemeName("SBI Aggressive Hybrid Fund (Erstwhile known as SBI Equity Hybrid Fund)")).toBe("SBI Aggressive Hybrid Fund");
  });
});

describe("keys", () => {
  it("matches disclosure, AMFI and CAS names", () => {
    expect(compactKey("TATA ELSS - TAX SAVER FUND")).toBe(planNameKey("Tata ELSS Tax Saver Fund - Direct Plan - Growth"));
    expect(compactKey("SBI Large and Midcap Fund")).toBe(planNameKey("SBI Large & Midcap Fund - Regular Plan - Growth"));
    expect(compactKey("NIPPON INDIA SMALL CAP FUND")).toBe(planNameKey("Nippon India Small Cap Fund - Direct Plan - Growth Plan - Growth Option"));
    expect(planNameKey("Axis ELSS Tax Saver Fund - Regular Plan - Growth")).not.toBe(planNameKey("Axis Flexi Cap Fund - Regular Plan - Growth"));
  });
  it("prettifies stock names", () => {
    expect(displayStockName("HDFC BANK LTD")).toBe("HDFC Bank");
    expect(displayStockName("Infosys Limited")).toBe("Infosys");
    expect(displayStockName("LARSEN & TOUBRO LTD")).toBe("Larsen & Toubro");
  });
});

describe("build-snapshot + HoldingsIndex", () => {
  const a = parseSheet("A", fractionSheet)!;
  const b = parseSheet("B", percentSheet)!;
  const master = [
    { isin: "INF000X01011", isinReinvest: "", name: "Alpha Flexi Cap Fund - Direct Plan - Growth", amc: "Alpha Mutual Fund" },
    { isin: "INF000X01029", isinReinvest: "INF000X01037", name: "Alpha Flexi Cap Fund - Regular Plan - IDCW", amc: "Alpha Mutual Fund" },
    { isin: "INF000Y01010", isinReinvest: "", name: "Beta Large & Midcap Fund - Direct Plan - Growth", amc: "Beta Mutual Fund" },
  ];
  const snap = buildSnapshot(
    [
      { amc: "Alpha Mutual Fund", month: "2026-09", files: ["a.xlsx"], schemes: [a] },
      { amc: "Beta Mutual Fund", month: "2026-08", files: ["b.xlsx"], schemes: [b] },
    ],
    master,
    [],
    "2026-11-05",
  );

  it("keeps equity schemes, dedupes stocks by ISIN and maps plan ISINs", () => {
    expect(keepScheme(a)).toBe(false); // only 16% equity
    expect(keepScheme(b)).toBe(false); // 30% equity
    const lowBar = buildSnapshot([{ amc: "Beta Mutual Fund", month: "2026-08", files: [], schemes: [{ ...b, equityPct: 90 }] }], master, []);
    expect(lowBar.schemes).toHaveLength(1);
    expect(lowBar.schemes[0].i).toEqual(["INF000Y01010"]);
    expect(lowBar.stocks.map((s) => s[0])).toContain("INE090A01021");
    expect(snap.schemes).toHaveLength(0);
  });

  it("looks up by plan ISIN, then by name", () => {
    const file = buildSnapshot([{ amc: "Beta Mutual Fund", month: "2026-08", files: [], schemes: [{ ...b, equityPct: 90 }] }], master, [], "2026-11-05");
    const idx = new HoldingsIndex(file);
    const byIsin = idx.lookup("INF000Y01010", "whatever")!;
    expect(byIsin.holdings[0]).toMatchObject({ name: "ICICI Bank", weight: 9.5, sector: "Banks" });
    expect(byIsin.month).toBe("2026-08");
    expect(idx.lookup(null, "Beta Large and Midcap Fund - Regular Plan - Growth")?.scheme).toBe("Beta Large & Midcap Fund");
    expect(idx.lookup("INF999999999", "Unknown Fund")).toBeNull();
  });
});
