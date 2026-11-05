import { describe, expect, it } from "vitest";
import { xirr } from "@/lib/finance/xirr";

describe("xirr", () => {
  it("matches Excel's documented example (37.34%)", () => {
    const r = xirr([
      { date: "2008-01-01", amount: -10000 },
      { date: "2008-03-01", amount: 2750 },
      { date: "2008-10-30", amount: 4250 },
      { date: "2009-02-15", amount: 3250 },
      { date: "2009-04-01", amount: 2750 },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(0.373362535, 6);
  });

  it("returns exactly 10% for a one-year 10% gain", () => {
    expect(xirr([{ date: "2021-01-01", amount: -100 }, { date: "2022-01-01", amount: 110 }])!).toBeCloseTo(0.1, 6);
  });

  it("handles losses (negative XIRR)", () => {
    expect(xirr([{ date: "2021-01-01", amount: -100 }, { date: "2023-01-01", amount: 81 }])!).toBeCloseTo(-0.1, 2);
  });

  it("handles a monthly SIP", () => {
    const flows = Array.from({ length: 12 }, (_, i) => ({ date: `2023-${String(i + 1).padStart(2, "0")}-01`, amount: -1000 }));
    flows.push({ date: "2024-01-01", amount: 12800 });
    const r = xirr(flows)!;
    expect(r).toBeGreaterThan(0.1);
    expect(r).toBeLessThan(0.14);
  });

  it("is order-independent", () => {
    const a = xirr([{ date: "2022-01-01", amount: 120 }, { date: "2020-01-01", amount: -100 }]);
    const b = xirr([{ date: "2020-01-01", amount: -100 }, { date: "2022-01-01", amount: 120 }]);
    expect(a).toBeCloseTo(b!, 10);
  });

  it("returns null without both inflows and outflows", () => {
    expect(xirr([{ date: "2020-01-01", amount: -100 }, { date: "2021-01-01", amount: -50 }])).toBeNull();
    expect(xirr([{ date: "2020-01-01", amount: 100 }])).toBeNull();
    expect(xirr([])).toBeNull();
  });

  it("copes with extreme short-period returns via bisection", () => {
    const r = xirr([{ date: "2024-01-01", amount: -100 }, { date: "2024-01-15", amount: 150 }]);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(10);
  });
});
