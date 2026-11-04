"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { WithPortfolio } from "@/components/Guard";
import { Term } from "@/components/Term";
import { PlanBadge } from "@/components/dashboard/FundList";
import { NavChart } from "@/components/charts/NavChart";
import { casNavSeries } from "@/lib/finance/timeline";
import { pastRegularCost, estimatedPastRegularCost } from "@/lib/finance/costs";
import { paidTer } from "@/lib/finance/portfolio";
import { holdingsFor } from "@/lib/overlap";
import { fmtDate, inr, inrShort, pct, signedPct } from "@/lib/format";

export default function FundPage() {
  return (
    <Suspense>
      <WithPortfolio>{(s) => <FundInner s={s} />}</WithPortfolio>
    </Suspense>
  );
}

function FundInner({ s }: { s: Parameters<Parameters<typeof WithPortfolio>[0]["children"]>[0] }) {
  const id = useSearchParams().get("id");
  const { portfolio: p, navs } = s;
  const h = [...p.holdings, ...p.closed].find((x) => x.id === id);
  const [showAll, setShowAll] = useState(false);
  const series = h ? (h.amfiCode != null ? navs[h.amfiCode] : undefined) ?? casNavSeries(h) : null;
  const regular = useMemo(() => {
    if (!h || h.plan !== "Regular") return null;
    const d = h.directCode != null ? navs[h.directCode] : undefined;
    if (d && d.navs.length) {
      const r = pastRegularCost(h, d, d.navs[d.navs.length - 1]);
      if (r) return { ...r, exact: true };
    }
    const est = estimatedPastRegularCost(h, p.asOf ?? "");
    return est == null ? null : { lost: est, directValue: h.value + est, exact: false };
  }, [h, navs, p.asOf]);

  if (!h)
    return (
      <div className="card p-6">
        Fund not found. <Link href="/app" className="text-brand underline">Back to overview</Link>
      </div>
    );
  const top = holdingsFor(h.name);
  const ter = paidTer(h);
  const txns = [...h.transactions].reverse();
  const shown = showAll ? txns : txns.slice(0, 8);
  const g = h.cost > 0 ? h.unrealisedGain / h.cost : null;

  return (
    <div className="space-y-4">
      <Link href="/app" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">← Overview</Link>
      <header className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
          <span>{h.amc}</span>·<span>{h.category}</span>·<PlanBadge plan={h.plan} />
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase">{h.option}</span>
        </div>
        <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">{h.shortName}</h1>
        <p className="mt-1 text-xs text-ink-3">
          <Term id="folio">Folio</Term> {h.folio} · visible only on this device
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["current-value", "Value", inr(h.value)],
            ["invested", "Cost", inr(h.cost)],
            ["gain", "Gain", `${inrShort(h.unrealisedGain)} (${signedPct(g)})`],
            ["xirr", "XIRR", h.incompleteHistory ? "needs full history" : pct(h.xirr)],
            ["units", "Units", h.units.toLocaleString("en-IN", { maximumFractionDigits: 3 })],
            ["nav", "NAV", h.nav ? `₹${h.nav.toFixed(2)} · ${fmtDate(h.navDate)}` : "—"],
            ["expense-ratio", "Expense ratio", ter == null ? "—" : `${ter.toFixed(2)}%${h.ter.source === "estimate" ? " (est.)" : ""}`],
            ["realised", "Realised", inrShort(h.realisedGain)],
          ].map(([t, l, v]) => (
            <div key={l}>
              <dt className="text-xs text-ink-3"><Term id={t}>{l}</Term></dt>
              <dd className="num mt-0.5 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      {series && series.dates.length > 1 && (
        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold"><Term id="nav">NAV</Term> since you started</h2>
          <p className="mb-3 mt-1 flex flex-wrap gap-x-4 text-xs text-ink-2">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[var(--s7)]" /> NAV</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--s3)]" /> You bought</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-[var(--s2)]" /> You sold</span>
          </p>
          <NavChart series={series} txns={h.transactions} />
        </section>
      )}

      {h.plan === "Regular" && regular && (
        <section className="rounded-3xl border border-watch/30 bg-watch-soft p-5 text-watch sm:p-6">
          <h2 className="font-display text-lg font-bold">This is a <Term id="direct-vs-regular">regular plan</Term></h2>
          <p className="mt-2 text-sm leading-relaxed">
            {regular.exact ? "Using actual historical NAVs, the same investments on the same dates in the direct plan would be worth " : "As a rough estimate, the direct plan would be worth about "}
            <strong className="num">{inr(regular.directValue)}</strong> today — <strong className="num">{inr(regular.lost)}</strong> more than your {inr(h.value)}.
            That difference is the distributor commission built into the fee ({h.ter.regular?.toFixed(2)}% vs {h.ter.direct?.toFixed(2)}% a year).
          </p>
          <p className="mt-2 text-xs opacity-80">A fact about the past, not a recommendation. Switching plans is a redemption + purchase and can have tax and exit-load effects.</p>
        </section>
      )}

      {top && (
        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold">Top holdings {top.source === "index" ? `(tracks ${top.label})` : ""}</h2>
          <p className="mt-1 text-xs text-ink-3">Approximate snapshot ({top.asOf}) — see the Overlap tab for sources.</p>
          <ul className="mt-3 space-y-2">
            {top.holdings.slice(0, 10).map((w) => (
              <li key={w.name} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-sm">
                <span className="truncate">{w.name}</span>
                <span className="num text-ink-2">{w.weight.toFixed(1)}%</span>
                <div className="col-span-2 mt-1 h-1.5 rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-[var(--s7)]" style={{ width: `${Math.min(100, w.weight * 6)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card overflow-hidden">
        <h2 className="p-4 pb-2 font-display text-lg font-bold sm:px-6">Transactions <span className="text-sm font-normal text-ink-3">({txns.length})</span></h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium sm:px-6">Date</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 text-right font-medium">Amount</th>
                <th className="py-2 text-right font-medium"><Term id="units">Units</Term></th>
                <th className="px-4 py-2 text-right font-medium sm:px-6"><Term id="nav">NAV</Term></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((t, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-4 py-2 sm:px-6">{fmtDate(t.date)}</td>
                  <td className="py-2 text-ink-2">{t.type.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="num py-2 text-right">{t.amount == null ? "—" : inr(t.amount, true)}</td>
                  <td className="num py-2 text-right">{t.units == null ? "" : t.units.toFixed(3)}</td>
                  <td className="num px-4 py-2 text-right sm:px-6">{t.nav == null ? "" : t.nav.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {txns.length > 8 && (
          <button onClick={() => setShowAll((v) => !v)} className="w-full border-t border-line py-3 text-sm font-semibold text-brand">
            {showAll ? "Show fewer" : `Show all ${txns.length}`}
          </button>
        )}
      </section>
    </div>
  );
}
