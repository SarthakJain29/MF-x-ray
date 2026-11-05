"use client";
import { Term } from "@/components/Term";
import { fmtDate, inr, inrShort, pct, signedPct } from "@/lib/format";
import type { Portfolio } from "@/lib/finance/portfolio";

export function HeroCard({ p, navStatus, name }: { p: Portfolio; navStatus: string; name: string | null }) {
  const gainPct = p.cost > 0 ? p.unrealisedGain / p.cost : null;
  const up = p.unrealisedGain >= 0;
  return (
    <section className="film relative overflow-hidden rounded-[1.75rem] p-5 sm:p-7">
      <div className="film-grid absolute inset-0 opacity-40" aria-hidden />
      <div className="relative">
        <div className="flex items-center justify-between gap-2 text-xs text-white/60">
          <span>{name ? `Hi ${name.split(" ")[0]} · ` : ""}as of {fmtDate(p.asOf)}</span>
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${navStatus === "done" ? "bg-lime" : navStatus === "loading" ? "animate-pulse bg-white/60" : "bg-white/40"}`} />
            {navStatus === "done" ? "Live NAVs" : navStatus === "loading" ? "Updating NAVs…" : "Statement NAVs"}
          </span>
        </div>
        <div className="mt-4 text-sm text-white/70">
          <Term id="current-value" className="decoration-white/40">Current value</Term>
        </div>
        <div className="num font-display text-[clamp(2.4rem,10vw,4rem)] font-extrabold leading-none tracking-[-0.03em]" title={inr(p.value, true)}>
          {inr(p.value)}
        </div>
        <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${up ? "bg-lime text-[#121019]" : "bg-[#ff7a6e] text-[#121019]"}`}>
          {up ? "▲" : "▼"} {inrShort(Math.abs(p.unrealisedGain))} · {signedPct(gainPct)}
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
          <div>
            <dt className="text-xs text-white/60"><Term id="xirr" className="decoration-white/40">XIRR</Term></dt>
            <dd className="num font-display text-2xl font-bold text-lime">{pct(p.xirr)}</dd>
          </div>
          <div>
            <dt className="text-xs text-white/60"><Term id="invested" className="decoration-white/40">Invested</Term></dt>
            <dd className="num font-display text-2xl font-bold">{inrShort(p.cost)}</dd>
          </div>
          <div>
            <dt className="text-xs text-white/60"><Term id="realised" className="decoration-white/40">Realised</Term></dt>
            <dd className="num font-display text-2xl font-bold">{inrShort(p.realisedGain)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
