export interface CashFlow {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Negative = money invested, positive = money received (or current value). */
  amount: number;
}

const DAY = 86400000;
const toTime = (d: string) => Date.parse(d + "T00:00:00Z");

function npv(rate: number, flows: { t: number; a: number }[]): number {
  let s = 0;
  for (const f of flows) s += f.a / Math.pow(1 + rate, f.t);
  return s;
}
function dnpv(rate: number, flows: { t: number; a: number }[]): number {
  let s = 0;
  for (const f of flows) s -= (f.t * f.a) / Math.pow(1 + rate, f.t + 1);
  return s;
}

/**
 * Extended internal rate of return (annualised, Actual/365) – same convention as Excel's XIRR.
 * Returns null when it cannot be computed (no sign change, or no convergence).
 */
export function xirr(cashflows: CashFlow[], guess = 0.1): number | null {
  const valid = cashflows.filter((c) => Number.isFinite(c.amount) && c.amount !== 0 && !Number.isNaN(toTime(c.date)));
  if (valid.length < 2) return null;
  const hasNeg = valid.some((c) => c.amount < 0);
  const hasPos = valid.some((c) => c.amount > 0);
  if (!hasNeg || !hasPos) return null;
  const t0 = Math.min(...valid.map((c) => toTime(c.date)));
  const flows = valid.map((c) => ({ t: (toTime(c.date) - t0) / DAY / 365, a: c.amount }));
  if (flows.every((f) => f.t === 0)) return null;

  // Newton-Raphson first.
  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate, flows);
    const df = dnpv(rate, flows);
    if (!Number.isFinite(f) || !Number.isFinite(df) || df === 0) break;
    const next = rate - f / df;
    if (!Number.isFinite(next) || next <= -1) break;
    if (Math.abs(next - rate) < 1e-10) return next;
    rate = next;
  }

  // Fallback: bisection on a wide bracket.
  let lo = -0.999999;
  let hi = 1;
  let flo = npv(lo, flows);
  let fhi = npv(hi, flows);
  while (flo * fhi > 0 && hi < 1e6) {
    hi *= 2;
    fhi = npv(hi, flows);
  }
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid, flows);
    if (Math.abs(fm) < 1e-7 || hi - lo < 1e-12) return mid;
    if (flo * fm < 0) {
      hi = mid;
      fhi = fm;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}
