import Link from "next/link";
import { Term } from "@/components/Term";
import { ASSET_COLORS } from "@/components/charts/colors";
import { inrShort, pct, signedPct } from "@/lib/format";
import type { Holding } from "@/lib/finance/portfolio";

export function PlanBadge({ plan }: { plan: "Direct" | "Regular" }) {
  return plan === "Regular" ? (
    <span className="rounded-md bg-watch-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-watch">Regular</span>
  ) : (
    <span className="rounded-md bg-good-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pos">Direct</span>
  );
}

export function FundList({ holdings, total }: { holdings: Holding[]; total: number }) {
  const maxX = Math.max(0.01, ...holdings.map((h) => Math.abs(h.xirr ?? 0)));
  return (
    <section className="card overflow-hidden">
      <div className="flex items-end justify-between gap-3 p-4 pb-2 sm:p-6 sm:pb-3">
        <h2 className="font-display text-lg font-bold">Your funds</h2>
        <span className="text-xs text-ink-3">
          sorted by value · <Term id="xirr">XIRR</Term> bars
        </span>
      </div>
      <ul className="divide-y divide-line">
        {holdings.map((h) => {
          const g = h.cost > 0 ? h.unrealisedGain / h.cost : null;
          return (
            <li key={h.id}>
              <Link href={`/app/fund?id=${encodeURIComponent(h.id)}`} className="block px-4 py-3.5 transition hover:bg-surface-2/60 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{h.shortName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: ASSET_COLORS[h.assetClass] }} />
                      {h.category} · {pct(h.value / total, 0)}
                      <PlanBadge plan={h.plan} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="num font-display font-bold">{inrShort(h.value)}</div>
                    <div className={`num text-xs ${h.unrealisedGain >= 0 ? "text-pos" : "text-neg"}`}>{signedPct(g)}</div>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="relative h-1.5 flex-1 rounded-full bg-surface-2">
                    {h.xirr != null && (
                      <div
                        className={`absolute top-0 h-full rounded-full ${h.xirr >= 0 ? "bg-[var(--s1)]" : "bg-neg"}`}
                        style={{ width: `${Math.min(100, (Math.abs(h.xirr) / maxX) * 100)}%` }}
                      />
                    )}
                  </div>
                  <span className="num w-20 text-right text-xs font-semibold">{h.xirr == null ? "XIRR n/a" : `${pct(h.xirr)} XIRR`}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
