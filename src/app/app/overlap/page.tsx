"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { WithPortfolio } from "@/components/Guard";
import { Term } from "@/components/Term";
import { Disclaimer } from "@/components/Disclaimer";
import { SourceBadge } from "@/components/SourceBadge";
import { SLOTS } from "@/components/charts/colors";
import { fmtYearMonth, inrShort, pct } from "@/lib/format";
import { SOURCE_LABEL, type OverlapReport, type PairOverlap } from "@/lib/overlap";

const abbr = (name: string) =>
  name
    .replace(/\b(fund|india)\b/gi, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w[0]))
    .join("")
    .slice(0, 5)
    .toUpperCase();

const LEVEL_TONE: Record<PairOverlap["level"], string> = {
  high: "bg-watch-soft text-watch",
  medium: "bg-brand-soft text-brand",
  low: "bg-surface-2 text-ink-2",
  minimal: "bg-good-soft text-pos",
};

export default function OverlapPage() {
  return <WithPortfolio>{({ overlap }) => (overlap ? <OverlapInner r={overlap} /> : null)}</WithPortfolio>;
}

function OverlapInner({ r }: { r: OverlapReport }) {
  const funds = r.covered.map((c) => c.holding);
  const fundColor = useMemo(() => Object.fromEntries([...funds].sort((a, b) => a.id.localeCompare(b.id)).map((f, i) => [f.id, i < SLOTS.length ? SLOTS[i] : "var(--ink-3)"])), [funds]);
  const [sel, setSel] = useState<{ a: string; b: string } | null>(r.pairs[0] ? { a: r.pairs[0].a, b: r.pairs[0].b } : null);
  const pairOf = (a: string, b: string) => r.pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
  const selected = sel ? pairOf(sel.a, sel.b) : null;
  const name = (id: string) => funds.find((f) => f.id === id)?.shortName ?? id;
  const top10 = r.exposure.slice(0, 10);
  const maxExp = top10[0]?.value ?? 1;
  const sectors = r.sectors.slice(0, 8);
  const otherSectors = r.sectors.slice(8).reduce((s, x) => ({ value: s.value + x.value, share: s.share + x.share }), { value: 0, share: 0 });
  const hero = r.pairs[0];

  if (funds.length < 2 && !r.missing.length) {
    return (
      <div className="card p-6">
        <h1 className="font-display text-2xl font-extrabold">Overlap needs at least two equity funds</h1>
        <p className="mt-2 text-ink-2">Overlap compares what your equity funds own. Your statement has fewer than two, so there&apos;s nothing to compare yet.</p>
        <Link href="/app" className="mt-4 inline-block text-sm font-semibold text-brand underline">Back to overview</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Overlap</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Do your funds own the same things?</h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          <Term id="overlap">Overlap</Term> is the share of two funds&apos; money in the same companies. Five funds that own the same stocks diversify less than they seem to.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-2">
          <span className="rounded-full border border-line bg-surface px-3 py-1">
            Holdings data as of <strong>{fmtYearMonth(r.dataMonth)}</strong>
          </span>
          <span className="rounded-full border border-line bg-surface px-3 py-1">
            Official AMC disclosures cover <strong>{pct(r.officialCoverage, 0)}</strong> of your equity money
          </span>
        </div>
      </header>

      {hero && (
        <section className="film relative overflow-hidden rounded-[1.75rem] p-5 sm:p-7">
          <div className="film-grid absolute inset-0 opacity-40" aria-hidden />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime">Your biggest overlap</p>
            <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
              <div className="num font-display text-[clamp(3.5rem,16vw,6rem)] font-extrabold leading-none tracking-[-0.04em]">{Math.round(hero.overlap)}%</div>
              <div className="pb-2 font-display text-xl font-bold text-white/80">the same</div>
            </div>
            <p className="mt-3 text-lg font-semibold">
              {name(hero.a)} <span className="text-lime">∩</span> {name(hero.b)}
            </p>
            <p className="mt-1 text-sm text-white/70">
              {hero.verdict.replace(/^\d+% the same — /, "")[0].toUpperCase() + hero.verdict.replace(/^\d+% the same — /, "").slice(1)}. They share {hero.common.length} companies
              {hero.common.length ? `, led by ${hero.common.slice(0, 3).map((c) => c.name).join(", ")}` : ""}.
            </p>
            {r.pairs.length > 1 && (
              <ul className="mt-5 space-y-2 border-t border-white/10 pt-4">
                {r.pairs.slice(1, 4).map((p) => (
                  <li key={p.a + p.b}>
                    <button onClick={() => setSel({ a: p.a, b: p.b })} className="w-full text-left">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-white/80">{name(p.a)} ∩ {name(p.b)}</span>
                        <span className="num shrink-0 font-semibold">{Math.round(p.overlap)}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-lime" style={{ width: `${Math.min(100, p.overlap)}%` }} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {funds.length >= 2 && (
        <section className="card p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold">Overlap map</h2>
              <p className="mt-1 text-xs text-ink-3">Every pair of your equity funds. Tap a square for details.</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-ink-3" aria-hidden>
              0%
              <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--s7) 8%, var(--surface)), var(--s7))" }} />
              60%+
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="mx-auto border-separate" style={{ borderSpacing: 3 }} aria-label="Pairwise overlap between your funds">
              <thead>
                <tr>
                  <th />
                  {funds.map((f) => (
                    <th key={f.id} scope="col" className="w-11 text-[10px] font-bold text-ink-3" title={f.shortName}>
                      {abbr(f.shortName)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {funds.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className="pr-1 text-right text-[10px] font-bold text-ink-3" title={row.shortName}>
                      {abbr(row.shortName)}
                    </th>
                    {funds.map((col) => {
                      if (row.id === col.id) return <td key={col.id} className="h-11 w-11 rounded-lg bg-surface-2" aria-hidden />;
                      const p = pairOf(row.id, col.id)!;
                      const active = sel && ((sel.a === row.id && sel.b === col.id) || (sel.a === col.id && sel.b === row.id));
                      const a = Math.min(1, p.overlap / 60);
                      return (
                        <td key={col.id} className="p-0">
                          <button
                            onClick={() => setSel({ a: row.id, b: col.id })}
                            className={`num grid h-11 w-11 place-items-center rounded-lg text-[11px] font-bold transition ${active ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
                            style={{ background: `color-mix(in oklab, var(--s7) ${Math.round(8 + a * 92)}%, var(--surface))`, color: a > 0.45 ? "#fff" : "var(--ink)" }}
                            aria-label={`${row.shortName} and ${col.shortName}: ${p.overlap}% overlap`}
                          >
                            {Math.round(p.overlap)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 grid gap-x-4 gap-y-1 text-xs text-ink-2 sm:grid-cols-2">
            {funds.map((f) => (
              <li key={f.id} className="flex min-w-0 items-center gap-1">
                <span className="inline-block w-12 shrink-0 font-bold text-ink">{abbr(f.shortName)}</span>
                <span className="truncate">{f.shortName}</span>
              </li>
            ))}
          </ul>
          {selected && (
            <div className="mt-5 rounded-2xl bg-surface-2 p-4" aria-live="polite">
              <div className="text-sm font-semibold">
                {name(selected.a)} ↔ {name(selected.b)}
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="num font-display text-3xl font-extrabold">{selected.overlap}%</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL_TONE[selected.level]}`}>{selected.verdict.replace(/^\d+% the same — /, "")}</span>
              </div>
              {selected.common.length ? (
                <>
                  <p className="mt-2 text-xs text-ink-3">{selected.common.length} companies in common (weight in each fund):</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {selected.common.slice(0, 18).map((c) => (
                      <li key={c.id} className="num rounded-full border border-line bg-surface px-2.5 py-1 text-xs">
                        {c.name} <span className="text-ink-3">{c.a.toFixed(1)}% / {c.b.toFixed(1)}%</span>
                      </li>
                    ))}
                    {selected.common.length > 18 && <li className="px-2 py-1 text-xs text-ink-3">+{selected.common.length - 18} more</li>}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-2">No companies in common.</p>
              )}
            </div>
          )}
        </section>
      )}

      {top10.length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold">
            Your real top 10 stocks <span className="font-normal text-ink-3">· <Term id="look-through">look-through</Term></span>
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Add up every fund and this is what you actually own. Your top 10 companies are <strong>{pct(r.top10Share, 0)}</strong> of your equity money ({inrShort(r.equityValue)}).
          </p>
          <ol className="mt-4 space-y-3">
            {top10.map((e, i) => (
              <li key={e.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="num mr-2 inline-block w-5 text-ink-3">{i + 1}</span>
                    <span className="font-medium">{e.name}</span>
                  </span>
                  <span className="num shrink-0 text-ink-2">
                    {inrShort(e.value)} · <strong className="text-ink">{pct(e.shareOfEquity)}</strong>
                  </span>
                </div>
                <div className="mt-1 ml-7 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-surface-2" role="img" aria-label={e.funds.map((f) => `${f.name} ${inrShort(f.value)}`).join(", ")}>
                  {e.funds.map((f) => (
                    <div key={f.id} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(f.value / maxExp) * 100}%`, background: fundColor[f.id] }} title={`${f.name}: ${inrShort(f.value)}`} />
                  ))}
                </div>
                <div className="ml-7 mt-0.5 text-[11px] text-ink-3">via {e.funds.length} fund{e.funds.length > 1 ? "s" : ""}{e.sector && e.sector !== "Other" ? ` · ${e.sector}` : ""}</div>
              </li>
            ))}
          </ol>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3 text-xs text-ink-2" aria-label="Fund colours">
            {funds.map((f) => (
              <li key={f.id} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: fundColor[f.id] }} />
                {f.shortName}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sectors.length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold">Sector exposure</h2>
          <p className="mt-1 text-sm text-ink-2">
            Where your equity money sits by industry, across all funds. {sectors[0] && <>Your biggest is <strong>{sectors[0].sector}</strong> at {pct(sectors[0].share, 0)}.</>}
          </p>
          <ul className="mt-4 space-y-2.5">
            {[...sectors, ...(otherSectors.value ? [{ sector: "All other sectors", ...otherSectors }] : [])].map((s) => (
              <li key={s.sector}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{s.sector}</span>
                  <span className="num shrink-0 text-ink-2">
                    {inrShort(s.value)} <span className="ml-1 inline-block w-12 text-right font-semibold text-ink">{pct(s.share)}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-[var(--s1)]" style={{ width: `${Math.max(1, (s.share / (sectors[0]?.share || 1)) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-ink-3">Industry labels are as reported by each fund house in its disclosure.</p>
        </section>
      )}

      <section className="card p-4 sm:p-6">
        <h2 className="font-display text-lg font-bold">Where this data comes from</h2>
        <ul className="mt-3 divide-y divide-line">
          {r.covered.map(({ holding, data }) => (
            <li key={holding.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0 truncate">{holding.shortName}</span>
              <SourceBadge source={data.source} asOf={data.asOf} />
            </li>
          ))}
          {r.missing.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0 truncate">{h.shortName}</span>
              <SourceBadge source="none" />
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1.5 text-xs leading-relaxed text-ink-3">
          <div><dt className="inline font-semibold text-ink-2">Official disclosure: </dt><dd className="inline">{SOURCE_LABEL.disclosure} — the fund&apos;s complete month-end portfolio, published by the fund house as SEBI requires. Stocks are matched by ISIN.</dd></div>
          <div><dt className="inline font-semibold text-ink-2">Index portfolio: </dt><dd className="inline">for index funds whose fund house isn&apos;t covered yet, we use the disclosed portfolio of another fund tracking the same index. Index funds hold near-identical baskets.</dd></div>
          <div><dt className="inline font-semibold text-ink-2">Approximate: </dt><dd className="inline">a hand-compiled list of top holdings (not live, top holdings only), used only when no disclosure is available. True overlap may be higher.</dd></div>
        </dl>
        {r.sameCategory.map((c) => (
          <p key={c.category} className="mt-3 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
            <strong>{c.funds.length} funds in “{c.category}”</strong> ({c.funds.map((f) => f.shortName).join(", ")}) have no holdings data. Funds in the same <Term id="category">category</Term> follow the same rules about what they can own, so they often overlap.
          </p>
        ))}
      </section>
      <Disclaimer className="px-1" />
    </div>
  );
}
