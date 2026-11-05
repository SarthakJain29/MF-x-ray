import Link from "next/link";
import type { OverlapReport } from "@/lib/overlap";
import type { Holding } from "@/lib/finance/portfolio";
import { pct } from "@/lib/format";

export function OverlapTeaser({ r, holdings }: { r: OverlapReport; holdings: Holding[] }) {
  const top = r.pairs[0];
  if (!top) return null;
  const n = (id: string) => holdings.find((h) => h.id === id)?.shortName ?? "";
  return (
    <Link href="/app/overlap" className="card group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 sm:p-5">
      <div className="relative grid h-16 w-24 shrink-0 place-items-center" aria-hidden>
        <span className="absolute left-0 h-14 w-14 rounded-full bg-[var(--s1)] opacity-70 mix-blend-multiply dark:mix-blend-screen" />
        <span className="absolute right-0 h-14 w-14 rounded-full bg-[var(--s7)] opacity-70 mix-blend-multiply dark:mix-blend-screen" />
        <span className="num relative font-display text-lg font-extrabold text-white drop-shadow">{Math.round(top.overlap)}%</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-3">Fund overlap</p>
        <p className="mt-0.5 font-semibold leading-snug">
          {n(top.a)} &amp; {n(top.b)} are {Math.round(top.overlap)}% the same
        </p>
        {r.exposure[0] && (
          <p className="mt-0.5 text-xs text-ink-3">
            Your #1 stock across all funds: {r.exposure[0].name} ({pct(r.exposure[0].shareOfEquity, 0)} of equity)
          </p>
        )}
      </div>
      <span className="text-ink-3 transition group-hover:translate-x-1">→</span>
    </Link>
  );
}
