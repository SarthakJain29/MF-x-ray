"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { WithPortfolio } from "@/components/Guard";
import { Term } from "@/components/Term";
import { Disclaimer } from "@/components/Disclaimer";
import {
  fyOf,
  idcwIncome,
  realisedGains,
  RULES,
  summarise,
  TAX_CLASS_LABEL,
  unrealisedGains,
  upcomingLongTerm,
  type GainSlice,
  type TaxSummary,
} from "@/lib/finance/capitalGains";
import { fmtDate, inr, inrShort, todayIso } from "@/lib/format";
import type { PortfolioState } from "@/lib/usePortfolio";

const SLABS = [0, 5, 10, 15, 20, 25, 30];

export default function TaxPage() {
  return <WithPortfolio>{(s) => <TaxInner s={s} />}</WithPortfolio>;
}

function Buckets({ s, slab }: { s: TaxSummary; slab: number }) {
  const rows: [string, string, number, number, string][] = [
    ["Equity · long-term", `12.5% above ₹${(RULES.equity.ltcgExemption / 1e5).toFixed(2)} L`, s.equityLT, s.tax.equityLT, "ltcg"],
    ["Equity · short-term", "20%", s.equityST, s.tax.equityST, "stcg"],
    ["Other non-equity · long-term", "12.5%", s.otherLT, s.tax.otherLT, "ltcg"],
    ["Taxed at your slab", `${slab}% (your slab)`, s.slab, s.tax.slab, "slab"],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-ink-3">
          <tr className="border-b border-line">
            <th className="py-2 font-medium">Bucket</th>
            <th className="py-2 font-medium">Rate</th>
            <th className="py-2 text-right font-medium">Gain</th>
            <th className="py-2 text-right font-medium">Est. tax</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(([label, rate, gain, tax]) => (
            <tr key={label}>
              <td className="py-2.5 pr-2">{label}</td>
              <td className="py-2.5 pr-2 text-xs text-ink-3">{rate}</td>
              <td className={`num py-2.5 text-right ${gain < 0 ? "text-neg" : ""}`}>{inr(gain)}</td>
              <td className="num py-2.5 text-right">{inr(tax)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-2.5 pr-2 text-xs text-ink-3" colSpan={3}>+ 4% health &amp; education cess</td>
            <td className="num py-2.5 text-right">{inr(s.tax.cess)}</td>
          </tr>
          <tr className="font-semibold">
            <td className="py-2.5" colSpan={3}>Estimated tax</td>
            <td className="num py-2.5 text-right">{inr(s.tax.total)}</td>
          </tr>
        </tbody>
      </table>
      {s.unknown !== 0 && (
        <p className="mt-2 text-xs text-watch">{inr(s.unknown)} of gains come from units held before your statement starts, so their holding period is unknown and they aren&apos;t included above.</p>
      )}
    </div>
  );
}

function TaxInner({ s }: { s: PortfolioState & { portfolio: NonNullable<PortfolioState["portfolio"]> } }) {
  const { portfolio: p, navs, indexes } = s;
  const asOf = p.asOf ?? todayIso();
  const currentFy = fyOf(todayIso());
  const [slab, setSlab] = useState(30);

  const opts = useMemo(() => {
    const equityPct: Record<string, number | null> = {};
    for (const h of [...p.holdings, ...p.closed]) equityPct[h.id] = indexes.holdings?.lookup(h.isin, h.name)?.equityPct ?? null;
    return { navs, equityPct };
  }, [p, navs, indexes.holdings]);
  const realised = useMemo(() => realisedGains([...p.holdings, ...p.closed], opts), [p, opts]);
  const unrealised = useMemo(() => unrealisedGains(p.holdings, asOf, opts), [p, asOf, opts]);
  const fys = useMemo(() => [...new Set([currentFy, ...realised.map((r) => r.fy)])].sort().reverse(), [realised, currentFy]);
  const [fy, setFy] = useState(currentFy);

  const inFy = realised.filter((r) => r.fy === fy);
  const fySummary = summarise(inFy, slab);
  const usedThisFy = summarise(realised.filter((r) => r.fy === currentFy), slab).exemptionUsed;
  const whatIf = summarise(unrealised, slab, usedThisFy);
  const rulesApply = fy >= fyOf(RULES.currentFrom) && fy !== "2024-25";
  const upcoming = upcomingLongTerm(unrealised, asOf).slice(0, 6);
  const idcw = idcwIncome([...p.holdings, ...p.closed]);
  const grandfathered = [...realised, ...unrealised].filter((x) => x.grandfathered).length;
  const gfMissing = [...realised, ...unrealised].filter((x) => x.grandfatherMissing).length;

  const byFund = new Map<string, { fund: string; cls: Set<string>; st: number; lt: number; unknown: number; rST: number; rLT: number }>();
  const add = (x: GainSlice, realisedFy: boolean) => {
    const e = byFund.get(x.holdingId) ?? { fund: x.fund, cls: new Set<string>(), st: 0, lt: 0, unknown: 0, rST: 0, rLT: 0 };
    e.cls.add(TAX_CLASS_LABEL[x.taxClass]);
    if (realisedFy) {
      if (x.term === "long") e.rLT += x.gain;
      else e.rST += x.gain;
    } else if (x.term === "unknown") e.unknown += x.gain;
    else if (x.term === "long") e.lt += x.gain;
    else e.st += x.gain;
    byFund.set(x.holdingId, e);
  };
  unrealised.forEach((x) => add(x, false));
  inFy.forEach((x) => add(x, true));

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Capital gains</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Capital gains estimate</h1>
        <p className="mt-2 max-w-2xl rounded-2xl bg-watch-soft px-4 py-3 text-sm text-watch">
          <strong>An estimate, not tax advice.</strong> Worked out from your statement with FIFO (first-in, first-out) and Indian mutual fund tax rules as of{" "}
          {fmtDate(RULES.checkedOn)}. Your actual tax depends on your other income, losses, surcharge and the fund&apos;s official tax classification — check with a tax professional
          or your fund house&apos;s capital-gains statement.
        </p>
      </header>

      <section className="card grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <label className="text-sm">
          <span className="text-ink-3">Financial year (realised gains)</span>
          <select value={fy} onChange={(e) => setFy(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5">
            {fys.map((f) => (
              <option key={f} value={f}>FY {f}{f === currentFy ? " (current)" : ""}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-ink-3">Your income-tax slab (for debt &amp; other short-term gains)</span>
          <select value={slab} onChange={(e) => setSlab(+e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5">
            {SLABS.map((x) => (
              <option key={x} value={x}>{x}%</option>
            ))}
          </select>
        </label>
      </section>

      <section className="film relative overflow-hidden rounded-[1.75rem] p-5 sm:p-7">
        <div className="film-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime">What-if · not a suggestion to sell</p>
          <h2 className="mt-2 font-display text-xl font-bold">If every unit were sold at today&apos;s NAV</h2>
          <div className="num mt-3 font-display text-5xl font-extrabold tracking-tight">{inrShort(whatIf.tax.total)}</div>
          <p className="text-sm text-white/70">estimated tax on {inrShort(whatIf.equityLT + whatIf.equityST + whatIf.otherLT + whatIf.slab)} of gains</p>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-sm">
            <div>
              <dt className="text-xs text-white/60">Equity long-term</dt>
              <dd className="num font-display text-lg font-bold">{inrShort(whatIf.equityLT)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/60">Equity short-term</dt>
              <dd className="num font-display text-lg font-bold">{inrShort(whatIf.equityST)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/60">Debt &amp; other</dt>
              <dd className="num font-display text-lg font-bold">{inrShort(whatIf.otherLT + whatIf.slab)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-white/70">
            Equity long-term gains up to {inrShort(RULES.equity.ltcgExemption)} a year are tax-free. Sales in your statement used {inrShort(usedThisFy)} of it in FY {currentFy}
            ; this what-if uses the remaining {inrShort(whatIf.exemption)}.
          </p>
        </div>
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="font-display text-lg font-bold">Realised in FY {fy}</h2>
        {inFy.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">No sales or switches in FY {fy} in your statement.</p>
        ) : rulesApply ? (
          <div className="mt-3"><Buckets s={fySummary} slab={slab} /></div>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-2">
              Tax rates were different before 23 July 2024, so we show the gains only (short-term {inr(inFy.filter((x) => x.term === "short").reduce((a, x) => a + x.gain, 0))},
              long-term {inr(inFy.filter((x) => x.term === "long").reduce((a, x) => a + x.gain, 0))}).
            </p>
          </>
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="p-4 pb-1 font-display text-lg font-bold sm:px-6">By fund</h2>
        <p className="px-4 text-xs text-ink-3 sm:px-6">Unrealised = on units you still hold, at today&apos;s NAV. Realised = sales in FY {fy}.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium sm:px-6">Fund</th>
                <th className="py-2 text-right font-medium">Unrealised ST</th>
                <th className="py-2 text-right font-medium">Unrealised LT</th>
                <th className="px-4 py-2 text-right font-medium sm:px-6">Realised FY {fy}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...byFund.entries()].map(([id, e]) => (
                <tr key={id}>
                  <td className="min-w-[10rem] px-4 py-2.5 sm:px-6">
                    <div className="font-medium leading-snug">{e.fund}</div>
                    <div className="text-xs text-ink-3">{[...e.cls].join(" · ")}</div>
                  </td>
                  <td className={`num py-2.5 text-right ${e.st < 0 ? "text-neg" : ""}`}>{inrShort(e.st)}</td>
                  <td className={`num py-2.5 text-right ${e.lt < 0 ? "text-neg" : ""}`}>{inrShort(e.lt)}{e.unknown ? <span className="block text-[11px] text-watch">+{inrShort(e.unknown)} unknown</span> : null}</td>
                  <td className="num px-4 py-2.5 text-right sm:px-6">{e.rST || e.rLT ? inrShort(e.rST + e.rLT) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold">When short-term units turn long-term</h2>
          <p className="mt-1 text-sm text-ink-2">The next date on which more of each fund&apos;s units cross the long-term line. A fact about holding periods — not a cue to sell.</p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {upcoming.map((u) => (
              <li key={u.holdingId} className="flex justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate">{u.fund}</span>
                <span className="num shrink-0 text-ink-2">from {fmtDate(u.date)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {Object.keys(idcw).length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold"><Term id="idcw">IDCW</Term> (dividend) income</h2>
          <p className="mt-1 text-sm text-ink-2">IDCW is taxed as income at your slab rate, whether paid out or reinvested. It isn&apos;t a capital gain.</p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {Object.entries(idcw).sort((a, b) => b[0].localeCompare(a[0])).map(([y, v]) => (
              <li key={y} className="flex justify-between gap-3 py-2.5">
                <span>FY {y}</span>
                <span className="num text-ink-2">paid {inr(v.paid)} · reinvested {inr(v.reinvested)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="card p-4 sm:p-6">
        <summary className="cursor-pointer font-display text-lg font-bold">Rules and assumptions used</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
          <li><strong>Equity-oriented funds</strong> (≥65% in Indian shares, incl. index funds, ELSS, arbitrage, aggressive hybrid, balanced advantage, equity savings): long-term after more than 12 months, taxed at 12.5% above ₹1.25 lakh a year; short-term at 20%.</li>
          <li><strong>Debt funds bought on/after 1 Apr 2023</strong> (“specified mutual funds”, ≥65% in debt): all gains taxed at your slab rate, however long you hold.</li>
          <li><strong>Debt funds bought before 1 Apr 2023, gold/silver, international FoFs and hybrids with 35–65% equity</strong>: long-term after more than 24 months at 12.5% (no indexation); otherwise slab rate.</li>
          <li><strong>Grandfathering:</strong> for equity units bought on or before 31 Jan 2018, cost = higher of what you paid and the lower of the 31-Jan-2018 NAV and the sale value. {grandfathered ? `Applied to ${grandfathered} lot(s).` : ""} {gfMissing ? `${gfMissing} lot(s) need a 31-Jan-2018 NAV that wasn't available, so actual cost was used.` : ""}</li>
          <li>FIFO: the oldest units are treated as sold first. Switches count as a sale; scheme mergers don&apos;t (cost and purchase date carry over). Stamp duty is added to cost; STT is not deductible.</li>
          <li>Not modelled: surcharge, set-off of losses across buckets or against other income, carry-forward losses, segregated-portfolio cost split (side-pocket units are given zero cost), demat-held units not in your CAS, and your other shares or funds.</li>
          <li>Rates are those in force for FY {currentFy}, as checked on {fmtDate(RULES.checkedOn)} (Budget 2026 kept them unchanged; the Income-tax Act, 2025 renumbered the sections). Fund tax classification here is inferred from the fund&apos;s category.</li>
        </ul>
        <p className="mt-3 text-xs text-ink-3">See also: <Link href="/app/learn" className="underline">Learn</Link> · your fund house&apos;s capital-gains statement (CAMS / KFintech can email one for any financial year).</p>
      </details>
      <Disclaimer className="px-1" />
    </div>
  );
}
