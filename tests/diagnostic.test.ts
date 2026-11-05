import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildReport, looksLeaky, maskFundNames, maskWords, redactPersonal, selectLines } from "@/lib/cas/diagnostic";
import { findSuspectLines, parseCASLines } from "@/lib/cas/parser";
import { samplePdfLines } from "./helpers";

const fixture = (n: string) => readFileSync(path.join(__dirname, "fixtures/cas", `${n}.txt`), "utf8").split("\n");

const CASES: { name: string; load: () => Promise<string[]> | string[]; secrets: string[]; mustNotContain: string[] }[] = [
  {
    name: "synthetic sample PDF (CAMS layout, real pdf.js extraction)",
    load: () => samplePdfLines(),
    secrets: ["Ananya Rao", "ananya.rao@example.com", "+919800000000", "ABCDE1234F", "Flat 12B, Example Residency, 4th Cross, Indiranagar, Bengaluru - 560038, Karnataka, India"],
    mustNotContain: ["Ananya", "Rao", "ananya", "ABCDE1234F", "9800000000", "18472093", "29384756", "79100345612", "Kabir", "Flat 12B", "Indiranagar", "Bengaluru", "560038", "INF879O01027"],
  },
  {
    name: "CAMS edge-case fixture",
    load: () => fixture("cams-edge-cases"),
    secrets: ["Test Investor One", "test.user@example.com", "+919000000001", "AAAAA1111A", "BBBBB2222B"],
    mustNotContain: ["Test Investor", "test.user", "9000000001", "AAAAA1111A", "BBBBB2222B", "1111111", "2222222", "3333333", "Fake Street", "Mumbai", "400001", "Kabir"],
  },
  {
    name: "KFintech-style fixture",
    load: () => fixture("kfintech-style"),
    secrets: ["KF Investor Two", "kf.user@example.com", "9000000002", "CCCCC3333C"],
    mustNotContain: ["KF Investor", "kf.user", "9000000002", "CCCCC3333C", "91000000001", "4440000001", "5550000001", "Fake Towers", "Pune", "411001"],
  },
  {
    name: "noisy-layout fixture",
    load: () => fixture("noisy-layout"),
    secrets: ["Noisy Investor Three", "noisy.user@example.com", "DDDDD4444D"],
    mustNotContain: ["Noisy Investor", "noisy.user", "9000000003", "DDDDD4444D", "7777777", "Fake Lane", "Chennai", "600001", "Fake Nominee"],
  },
];

describe.each(CASES)("redaction: $name", ({ load, secrets, mustNotContain }) => {
  for (const withSecrets of [true, false]) {
    it(`leaks nothing ${withSecrets ? "(secrets known)" : "(heuristics only — e.g. when parsing failed)"}`, async () => {
      const raw = await load();
      const red = redactPersonal(raw, withSecrets ? secrets : []);
      const named = red.join("\n");
      const masked = maskFundNames(red).join("\n");
      for (const text of [named, masked]) {
        for (const bad of mustNotContain) expect(text, `leaked "${bad}"`).not.toContain(bad);
        expect(looksLeaky(text, withSecrets ? secrets : []), "leak check").toBeNull();
        expect(text.replace(/99-Mmm-9999/g, "").match(/[0-8]/g), "only masked digits survive").toBeNull();
      }
      expect(red).toHaveLength(raw.length); // line structure intact
    });
  }
});

describe("what survives", () => {
  it("keeps layout: tabs, grouping, brackets, column order and statement vocabulary", async () => {
    const red = redactPersonal(await samplePdfLines(), ["Ananya Rao"]);
    const txn = red.find((l) => /SIP Purchase/.test(l))!;
    expect(txn).toMatch(/^99-Mmm-9999\t\tSIP Purchase - Instalment No 9 - via Internet\t\t99,999\.99\t\t999\.999\t\t99\.9999\t\t[9,]*999\.999$/);
    expect(red.some((l) => /^Folio No: 9{8}\s/.test(l))).toBe(true); // folio shape kept, number gone
    expect(red[0]).toBe("Consolidated Account Statement");
  });

  it("masks fund names but keeps plan/option structure", () => {
    expect(maskWords("HDFC Flexi Cap Fund - Regular Plan - Growth Option (Non-Demat) - ISIN: INF999K99999(Advisor: ARN-999999)")).toBe(
      "xxxx xxxxx xxx Fund - Regular Plan - Growth Option (Non-Demat) - ISIN: xxx999x99999(Advisor: xxx-999999)",
    );
    expect(maskWords("Switch Out - To HDFC Corporate Bond Fund")).toBe("Switch Out - To xxxx xxxxxxxxx xxxx Fund");
    expect(maskWords("[PAN] [personal details line]")).toBe("[PAN] [personal details line]");
  });
});

describe("report", () => {
  it("summarises parse structure without names or amounts, and flags unparsed lines", () => {
    const raw = fixture("cams-edge-cases");
    raw.splice(20, 0, "05-Jan-2023\t\tUnknown weird row 12,345.00\t\t"); // a row the parser can't read
    const suspects = findSuspectLines(raw);
    expect(suspects).toContain(20);
    const cas = parseCASLines(raw);
    const red = redactPersonal(raw, ["Test Investor One"]);
    const text = buildReport({ lines: red, suspects, error: null }, cas, { includeFundNames: false, note: "SWP row looks odd", generatedOn: "2026-11-05", appVersion: "test" });
    expect(text).toContain("folios: 3; schemes: 4");
    expect(text).toContain("transaction types:");
    expect(text).toContain("unitsReconcile=yes");
    expect(text).toContain("!! 99-Mmm-9999");
    expect(text).toContain("user note: SWP row looks odd");
    expect(text).not.toMatch(/HDFC|Test Investor|AAAAA1111A|1111111/);
    expect(text).not.toMatch(/Flexi/);
    expect(buildReport({ lines: red, suspects, error: null }, cas, { includeFundNames: true })).toContain("Flexi Cap");
  });

  it("reports failures with the error and a bounded layout excerpt", () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `row ${i} 12,345.00`);
    const red = redactPersonal(lines);
    const text = buildReport({ lines: red, suspects: [1500], error: { code: "NOT_A_CAS", message: "This doesn't look like a CAMS/KFintech Consolidated Account Statement." } }, null, { includeFundNames: false });
    expect(text).toContain("outcome: NOT_A_CAS");
    expect(selectLines({ lines: red, suspects: [1500], error: null }).length).toBeLessThanOrEqual(330);
    expect(text).toContain("!! ");
  });
});
