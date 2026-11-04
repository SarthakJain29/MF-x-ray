"use client";
import { useMemo, useState } from "react";
import { Donut } from "@/components/charts/Donut";
import { ASSET_COLORS, colorMap } from "@/components/charts/colors";
import { Term } from "@/components/Term";
import { inrShort, pct } from "@/lib/format";
import type { AllocationSlice, Portfolio } from "@/lib/finance/portfolio";

const TABS = [
  { k: "assetClass", label: "Asset class", term: "asset-class" },
  { k: "category", label: "Category", term: "category" },
  { k: "amc", label: "Fund house", term: "amc" },
] as const;

function fold(s: AllocationSlice[], max = 7): AllocationSlice[] {
  if (s.length <= max + 1) return s;
  const head = s.slice(0, max);
  const rest = s.slice(max);
  return [...head, { key: "Other", value: rest.reduce((a, b) => a + b.value, 0), share: rest.reduce((a, b) => a + b.share, 0) }];
}

export function AllocationCard({ p }: { p: Portfolio }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("assetClass");
  const slices = useMemo(() => fold(p.allocation[tab]), [p, tab]);
  const colors = useMemo(() => (tab === "assetClass" ? ASSET_COLORS : colorMap(slices.map((s) => s.key))), [tab, slices]);
  const data = slices.map((s) => ({ ...s, color: colors[s.key] ?? "var(--ink-3)" }));
  const t = TABS.find((x) => x.k === tab)!;

  return (
    <section className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">
          Where your money sits · <Term id={t.term}>{t.label.toLowerCase()}</Term>
        </h2>
        <div className="flex rounded-full bg-surface-2 p-1 text-xs font-semibold" role="tablist">
          {TABS.map((x) => (
            <button key={x.k} role="tab" aria-selected={tab === x.k} onClick={() => setTab(x.k)} className={`rounded-full px-3 py-1.5 ${tab === x.k ? "bg-ink text-bg" : "text-ink-3"}`}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 grid items-center gap-6 sm:grid-cols-[220px_1fr]">
        <div className="mx-auto w-full max-w-[220px]">
          <Donut data={data} center={pct(data[0]?.share, 0)} sub={data[0]?.key ?? ""} />
        </div>
        <ul className="space-y-2.5">
          {data.map((d) => (
            <li key={d.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
                  <span className="truncate">{d.key}</span>
                </span>
                <span className="num shrink-0 text-ink-2">
                  {inrShort(d.value)} <span className="ml-1 inline-block w-12 text-right font-semibold text-ink">{pct(d.share)}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, d.share * 100)}%`, background: d.color }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
