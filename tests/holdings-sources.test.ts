import { describe, expect, it } from "vitest";
import { mentionsMonth, SOURCES } from "../scripts/holdings/sources";

const sep = { year: 2026, month: 9 };
describe("mentionsMonth", () => {
  it.each([
    "https://www.sbimf.com/docs/default-source/scheme-portfolios/all-schemes-monthly-portfolio---as-on-30th-september-2026.xlsx?sfvrsn=2a79126c_2",
    "/InvestorServices/FactsheetsDocuments/NIMF-MONTHLY-PORTFOLIO-30-Sep-26.xls",
    "https://mutualfund.adityabirlacapital.com/-/media/bsl/files/resources/monthly-portfolio/2026/30092026_abslmf_monthlydisclosure.zip",
    "https://www.miraeassetmf.co.in/docs/default-source/portfolios/mafcf_sept2026.xlsx",
    "https://www.dspim.com/x/dsp-monthend-portfolio-as-on-30-september-2026.zip",
    "https://www.tatamutualfund.com/system/files/2026-10/Monthly%20Portfolio%20as%20on%2030th%20September%202026%20%281%29.xlsx",
    "/downloads/portfolio-disclosure/2026/PPFAS_Monthly_Portfolio_Report_September_30_2026.xls",
    "https://www.motilaloswalmf.com/x/2026/oct/Scheme%20Portfolio%20Details%20September%202026.xlsx",
    "https://www.invescomutualfund.com/x/invesco-india-elss-tax-saver-fund_sep_2026_equity.xlsx",
  ])("recognises %s", (u) => expect(mentionsMonth(u, sep)).toBe(true));

  it("rejects other months", () => {
    expect(mentionsMonth("all-schemes-monthly-portfolio---as-on-31st-august-2026.xlsx", sep)).toBe(false);
    expect(mentionsMonth("NIMF-MONTHLY-PORTFOLIO-30-Sep-25.xls", sep)).toBe(false);
    expect(mentionsMonth("monthly-portfolio-31082026_abslmf.zip", sep)).toBe(false);
  });

  it("picks one consolidated file per AMC where applicable", () => {
    const sbi = SOURCES.find((s) => s.id === "sbi")!;
    const links = [
      { href: "https://www.sbimf.com/docs/default-source/scheme-portfolios/all-schemes-monthly-portfolio---as-on-30th-september-2026.xlsx?sfvrsn=1", text: "All Schemes Monthly Portfolio - as on 30th September 2026" },
      { href: "https://www.sbimf.com/docs/default-source/scheme-portfolios/all-schemes-monthly-portfolio---as-on-30th-september-2026.xlsx?sfvrsn=1", text: "Download" },
      { href: "https://www.sbimf.com/docs/x/debt-fortnightly-portfolio-15-september-2026.xlsx", text: "Fortnightly" },
    ];
    expect(sbi.pick(links, sep)).toHaveLength(1);
  });
});
