/** Portfolio value vs money invested, month by month — reconstructed from transactions + NAV history. */
import type { NavSeries } from "./costs";
import { navOn } from "./costs";
import type { Holding } from "./portfolio";

export interface TimelinePoint {
  date: string;
  value: number;
  invested: number;
}

/** NAV series from the CAS itself (transaction prices + closing NAV) — the offline fallback. */
export function casNavSeries(h: Holding): NavSeries {
  const pts = h.transactions.filter((t) => t.nav && t.nav > 0).map((t) => ({ d: t.date, n: t.nav! }));
  if (h.nav && h.navDate) pts.push({ d: h.navDate, n: h.nav });
  pts.sort((a, b) => a.d.localeCompare(b.d));
  return { dates: pts.map((p) => p.d), navs: pts.map((p) => p.n) };
}

function interp(series: NavSeries, date: string): number | null {
  // linear interpolation for sparse (CAS-derived) series
  const { dates, navs } = series;
  if (!dates.length) return null;
  if (date <= dates[0]) return navs[0];
  if (date >= dates[dates.length - 1]) return navs[navs.length - 1];
  let i = dates.findIndex((d) => d >= date);
  if (dates[i] === date) return navs[i];
  i = Math.max(1, i);
  const t0 = Date.parse(dates[i - 1]);
  const t1 = Date.parse(dates[i]);
  const t = Date.parse(date);
  return navs[i - 1] + ((navs[i] - navs[i - 1]) * (t - t0)) / (t1 - t0 || 1);
}

function monthEnds(from: string, to: string): string[] {
  const out: string[] = [];
  let y = +from.slice(0, 4);
  let m = +from.slice(5, 7);
  for (;;) {
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    if (end >= to) break;
    out.push(end);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  out.push(to);
  return out;
}

export function buildTimeline(all: Holding[], navs: Record<number, NavSeries>, asOf: string): { points: TimelinePoint[]; usedLiveNavs: boolean } {
  const withTx = all.filter((h) => h.transactions.length && !h.incompleteHistory);
  if (!withTx.length) return { points: [], usedLiveNavs: false };
  const start = withTx.map((h) => h.transactions[0].date).sort()[0];
  const dates = monthEnds(start, asOf);
  let usedLive = false;
  const perHolding = withTx.map((h) => {
    const live = h.amfiCode != null ? navs[h.amfiCode] : undefined;
    if (live) usedLive = true;
    const fallback = casNavSeries(h);
    return { h, live, fallback };
  });
  const points = dates.map((date) => {
    let value = 0;
    let invested = 0;
    for (const { h, live, fallback } of perHolding) {
      let units = 0;
      for (const t of h.transactions) {
        if (t.date > date) break;
        units += t.units ?? 0;
      }
      for (const f of h.cashflows) if (f.date <= date) invested -= f.amount;
      if (units > 0.0005) {
        const nav = (live && live.dates[0] <= date ? navOn(live, date) : null) ?? interp(fallback, date) ?? 0;
        value += units * nav;
      }
    }
    return { date, value: Math.round(value), invested: Math.round(Math.max(0, invested)) };
  });
  return { points, usedLiveNavs: usedLive };
}
