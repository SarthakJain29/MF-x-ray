import { Term } from "@/components/Term";
import { BENCHMARK, simulateBenchmark } from "@/lib/finance/benchmark";
import type { NavSeries } from "@/lib/finance/costs";
import type { Portfolio } from "@/lib/finance/portfolio";
import { inrShort, pct } from "@/lib/format";

export function BenchmarkCard({ p, navs }: { p: Portfolio; navs: Record<number, NavSeries> }) {
  const series = navs[BENCHMARK.code];
  if (!series) return null;
  const all = [...p.holdings, ...p.closed].filter((h) => !h.incompleteHistory);
  const r = simulateBenchmark(all.flatMap((h) => h.cashflows), series);
  if (!r) return null;
  const mine = all.reduce((s, h) => s + h.value, 0);
  const max = Math.max(mine, r.value) || 1;
  return (
    <section className="card p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Reference point · past only</p>
      <h2 className="mt-1 font-display text-lg font-bold">
        Your funds vs the same money in a <Term id="index-fund">{BENCHMARK.label}</Term>
      </h2>
      <div className="mt-4 space-y-3">
        {[
          { l: "Your funds", v: mine, x: p.xirr, c: "var(--s1)" },
          { l: `Same dates & amounts in a ${BENCHMARK.label}`, v: r.value, x: r.xirr, c: "var(--ink-3)" },
        ].map((row) => (
          <div key={row.l}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink-2">{row.l}</span>
              <span className="num shrink-0 font-semibold">
                {inrShort(row.v)} <span className="text-ink-3">· XIRR {pct(row.x)}</span>
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-surface-2">
              <div className="h-full rounded-full" style={{ width: `${(row.v / max) * 100}%`, background: row.c }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
        Replays every purchase and withdrawal from your statement on UTI Nifty 50 Index Fund (direct) NAVs from mfapi.in. A broad-market yardstick for context — not a
        recommendation, and past results don&apos;t predict future ones.
      </p>
    </section>
  );
}
