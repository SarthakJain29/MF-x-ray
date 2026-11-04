"use client";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { WithPortfolio } from "@/components/Guard";
import { Term } from "@/components/Term";
import { Disclaimer } from "@/components/Disclaimer";
import { PlanBadge } from "@/components/dashboard/FundList";
import { costTable, estimatedPastRegularCost, HORIZONS, pastRegularCost, terDrag } from "@/lib/finance/costs";
import { inr, inrShort } from "@/lib/format";
import { useStore } from "@/store/store";
import type { PortfolioState } from "@/lib/usePortfolio";

export default function CostsPage() {
  return <WithPortfolio>{(s) => <CostsInner s={s} />}</WithPortfolio>;
}

function CostsInner({ s }: { s: PortfolioState & { portfolio: NonNullable<PortfolioState["portfolio"]> } }) {
  const { portfolio: p, navs, indexes } = s;
  const assumed = useStore((st) => st.costAssumption);
  const setAssumed = useStore((st) => st.setCostAssumption);
  const rows = useMemo(() => costTable(p.holdings, assumed), [p, assumed]);
  const yearly = rows.reduce((a, r) => a + r.annualCost, 0);
  const regular = rows.filter((r) => r.holding.plan === "Regular");
  const chart = HORIZONS.map((y) => {
    const total = rows.reduce((a, r) => a + r.drag[y], 0);
    const extra = regular.reduce((a, r) => a + (r.regularGap?.[y] ?? 0), 0);
    return { label: `${y} yrs`, base: Math.max(0, Math.round(total - extra)), extra: Math.round(extra), total: Math.round(total) };
  });

  const past = useMemo(
    () =>
      regular.map((r) => {
        const h = r.holding;
        const d = h.directCode != null ? navs[h.directCode] : undefined;
        const exact = d?.navs.length ? pastRegularCost(h, d, d.navs[d.navs.length - 1]) : null;
        return { r, lost: exact?.lost ?? estimatedPastRegularCost(h, p.asOf ?? "") ?? 0, exact: !!exact };
      }),
    [regular, navs, p.asOf],
  );
  const pastTotal = past.reduce((a, x) => a + x.lost, 0);
  const amfiMonth = rows.find((r) => r.holding.ter.source === "amfi")?.holding.ter.month;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Cost check</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">The fees you never see</h1>
      </header>

      <section className="film relative overflow-hidden rounded-[1.75rem] p-5 sm:p-7">
        <div className="film-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="relative grid gap-6 sm:grid-cols-2">
          <div>
            <div className="text-sm text-white/70">You pay about</div>
            <div className="num font-display text-5xl font-extrabold tracking-tight">{inrShort(yearly)}<span className="text-2xl text-white/60"> /year</span></div>
            <p className="mt-2 text-sm text-white/70">
              ≈ {inr(yearly / 365)} a day, at a weighted <Term id="expense-ratio" className="decoration-white/40">expense ratio</Term> of {p.weightedTer?.toFixed(2) ?? "—"}%.
            </p>
          </div>
          <div>
            <div className="text-sm text-white/70">Regular plans have cost you so far</div>
            <div className="num font-display text-5xl font-extrabold tracking-tight text-lime">{regular.length ? inrShort(pastTotal) : "₹0"}</div>
            <p className="mt-2 text-sm text-white/70">
              {regular.length ? `vs investing the same money in the direct plan of the same ${regular.length} fund${regular.length > 1 ? "s" : ""}.` : "All your funds are direct plans."}
            </p>
          </div>
        </div>
      </section>

      <section className="card p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold">Fees over time, in rupees</h2>
            <p className="mt-1 text-sm text-ink-2">How much less you&apos;d have because of fees, on today&apos;s value, if your money grew at your assumed rate.</p>
          </div>
          <label className="w-full max-w-xs rounded-2xl bg-surface-2 p-3 text-sm">
            <span className="flex justify-between font-semibold">
              <Term id="assumption">Your assumption</Term> <span className="num">{assumed}% / yr</span>
            </span>
            <input type="range" min={0} max={15} step={0.5} value={assumed} onChange={(e) => setAssumed(+e.target.value)} className="mt-2 w-full" aria-label="Assumed growth rate per year" />
            <span className="text-[11px] text-ink-3">Not a prediction. Try different values.</span>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 text-xs text-ink-2">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--s1)]" /> Fees at direct-plan rates</span>
          {regular.length > 0 && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--s2)]" /> Extra from regular plans</span>}
        </div>
        <div className="mt-3 h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 24, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--ink-3)" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => inrShort(v).replace("₹", "")} tick={{ fontSize: 11, fill: "var(--ink-3)" }} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof chart)[number];
                  return (
                    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl">
                      <div className="font-semibold">Over {d.label}</div>
                      <div className="num">Total fee drag {inr(d.total)}</div>
                      {d.extra > 0 && <div className="num text-ink-2">of which regular-plan extra {inr(d.extra)}</div>}
                    </div>
                  );
                }}
              />
              <Bar dataKey="base" stackId="a" fill="var(--s1)" stroke="var(--surface)" strokeWidth={2} isAnimationActive={false} radius={regular.length ? 0 : [4, 4, 0, 0]} />
              {regular.length > 0 && (
                <Bar dataKey="extra" stackId="a" fill="var(--s2)" stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  <LabelList dataKey="total" position="top" formatter={(v) => inrShort(Number(v))} style={{ fontSize: 12, fontWeight: 700, fill: "var(--ink)" }} />
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {regular.length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold"><Term id="direct-vs-regular">Direct vs regular</Term>: same fund, different fee</h2>
          <ul className="mt-4 space-y-3">
            {past.map(({ r, lost, exact }) => (
              <li key={r.holding.id} className="rounded-2xl bg-surface-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{r.holding.shortName}</div>
                    <div className="num text-xs text-ink-3">
                      Fee {r.holding.ter.regular?.toFixed(2)}% (regular) vs {r.holding.ter.direct?.toFixed(2)}% (direct) · {inrShort(r.holding.value)} invested
                    </div>
                  </div>
                  <PlanBadge plan="Regular" />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-[11px] text-ink-3">Cost so far {exact ? "" : "(est.)"}</dt>
                    <dd className="num font-display text-lg font-bold text-watch">{inrShort(lost)}</dd>
                  </div>
                  {HORIZONS.map((y) => (
                    <div key={y}>
                      <dt className="text-[11px] text-ink-3">Next {y} yrs at {assumed}%</dt>
                      <dd className="num font-display text-lg font-bold">{inrShort(r.regularGap?.[y] ?? 0)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            “Cost so far” {past.some((x) => x.exact) ? "replays your actual purchase dates on the direct plan's real historical NAVs" : "is estimated from your average balance × the fee gap × years held"}. Regular plans pay
            your distributor through this fee; whether the service is worth it is your call. Switching is a sale + purchase and may trigger tax and exit loads.
          </p>
        </section>
      )}

      <section className="card overflow-hidden">
        <h2 className="p-4 pb-2 font-display text-lg font-bold sm:px-6">Fee per fund</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium sm:px-6">Fund</th>
                <th className="py-2 text-right font-medium"><Term id="expense-ratio">TER</Term></th>
                <th className="py-2 text-right font-medium">Per year</th>
                <th className="px-4 py-2 text-right font-medium sm:px-6">10-yr drag*</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.holding.id}>
                  <td className="px-4 py-2.5 sm:px-6">
                    <div className="font-medium">{r.holding.shortName}</div>
                    <div className="text-xs text-ink-3">{r.holding.plan} · {r.holding.category}</div>
                  </td>
                  <td className="num py-2.5 text-right">{r.ter == null ? "—" : `${r.ter.toFixed(2)}%`}{r.holding.ter.source === "estimate" && <span className="text-ink-3"> est</span>}</td>
                  <td className="num py-2.5 text-right">{inr(r.annualCost)}</td>
                  <td className="num px-4 py-2.5 text-right sm:px-6">{inrShort(r.drag[10])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-3 text-[11px] text-ink-3 sm:px-6">
          * At your {assumed}% assumption. TER source: {indexes.ter ? `AMFI disclosures (${amfiMonth ?? "latest snapshot"})` : "typical category estimates (AMFI snapshot unavailable)"}; “est” = category estimate.
          Example: {inr(100000)} at 1% TER for 10 years at {assumed}% ≈ {inr(terDrag(100000, 1, 10, assumed))} in fees.
        </p>
      </section>
      <Disclaimer className="px-1" />
    </div>
  );
}
