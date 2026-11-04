"use client";
import { useState } from "react";
import { WithPortfolio } from "@/components/Guard";
import { Term } from "@/components/Term";
import { Disclaimer } from "@/components/Disclaimer";
import { inrShort, pct } from "@/lib/format";
import type { OverlapReport } from "@/lib/overlap";

const abbr = (name: string) =>
  name
    .replace(/\bfund\b/gi, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w[0]))
    .join("")
    .slice(0, 5)
    .toUpperCase();

export default function OverlapPage() {
  return <WithPortfolio>{({ overlap }) => (overlap ? <OverlapInner r={overlap} /> : null)}</WithPortfolio>;
}

function OverlapInner({ r }: { r: OverlapReport }) {
  const funds = r.covered.map((c) => c.holding);
  const [sel, setSel] = useState<{ a: string; b: string } | null>(r.pairs[0] ? { a: r.pairs[0].a, b: r.pairs[0].b } : null);
  const pairOf = (a: string, b: string) => r.pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
  const selected = sel ? pairOf(sel.a, sel.b) : null;
  const name = (id: string) => funds.find((f) => f.id === id)?.shortName ?? id;
  const maxExp = r.exposure[0]?.value ?? 1;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Overlap</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Do your funds own the same things?</h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          <Term id="overlap">Overlap</Term> is the share of two funds&apos; money invested in the same companies. Based on top disclosed holdings for {r.covered.length} of your{" "}
          {r.covered.length + r.missing.length} equity funds.
        </p>
      </header>

      {funds.length >= 2 ? (
        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold">Overlap map</h2>
          <p className="mt-1 text-xs text-ink-3">Tap a square. Darker = more overlap.</p>
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
              <li key={f.id}><span className="inline-block w-12 font-bold text-ink">{abbr(f.shortName)}</span>{f.shortName}</li>
            ))}
          </ul>
          {selected && (
            <div className="mt-5 rounded-2xl bg-surface-2 p-4">
              <div className="text-sm font-semibold">{name(selected.a)} ↔ {name(selected.b)}</div>
              <div className="num mt-1 font-display text-3xl font-extrabold">{selected.overlap}% <span className="text-base font-semibold text-ink-3">overlap</span></div>
              {selected.common.length ? (
                <>
                  <p className="mt-2 text-xs text-ink-3">{selected.common.length} companies in common (weight in each fund):</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {selected.common.map((c) => (
                      <li key={c.name} className="num rounded-full border border-line bg-surface px-2.5 py-1 text-xs">
                        {c.name} <span className="text-ink-3">{c.a.toFixed(1)}% / {c.b.toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-2">No common companies among their top holdings.</p>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="card p-6 text-ink-2">We need holdings data for at least two of your equity funds to measure overlap.</section>
      )}

      {r.exposure.length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold"><Term id="look-through">Look-through</Term>: companies you effectively own</h2>
          <p className="mt-1 text-xs text-ink-3">Your rupees in each company, added up across funds (top disclosed holdings only).</p>
          <ul className="mt-4 space-y-3">
            {r.exposure.slice(0, 12).map((e) => (
              <li key={e.name}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{e.name}</span>
                  <span className="num shrink-0 text-ink-2">
                    {inrShort(e.value)} · {pct(e.shareOfEquity)} · {e.funds.length} fund{e.funds.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-surface-2" title={e.funds.map((f) => `${f.name}: ${inrShort(f.value)}`).join("\n")}>
                  {e.funds.map((f, i) => (
                    <div key={f.id} className="h-full" style={{ width: `${(f.value / maxExp) * 100}%`, background: "var(--s1)", opacity: 1 - i * 0.14, marginRight: 2 }} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-ink-3">Each segment is one fund. Shares are of your equity money ({inrShort(r.equityValue)}).</p>
        </section>
      )}

      {(r.missing.length > 0 || r.sameCategory.length > 0) && (
        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold">Without holdings data</h2>
          {r.missing.length > 0 && (
            <p className="mt-2 text-sm text-ink-2">
              We don&apos;t have a holdings snapshot for: {r.missing.map((m) => m.shortName).join(", ")}. Check the fund&apos;s monthly portfolio on its fund house website.
            </p>
          )}
          {r.sameCategory.map((c) => (
            <p key={c.category} className="mt-2 text-sm text-ink-2">
              <strong>{c.funds.length} funds in “{c.category}”</strong> ({c.funds.map((f) => f.shortName).join(", ")}). Funds in the same <Term id="category">category</Term> follow the same rules about what they can own, so they often overlap.
            </p>
          ))}
        </section>
      )}

      <section className="rounded-2xl bg-surface-2 p-4 text-xs leading-relaxed text-ink-3">
        <strong className="text-ink-2">About this data.</strong> Holdings are an approximate snapshot of top holdings compiled for v1, not live data. Funds publish
        complete portfolios monthly on their websites (as SEBI requires), but there&apos;s no free common API, so overlap here is indicative and uses top holdings only —
        true overlap may be higher. Index funds use approximate index weights.
      </section>
      <Disclaimer className="px-1" />
    </div>
  );
}
