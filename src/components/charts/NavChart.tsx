"use client";
import { useMemo } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import type { NavSeries } from "@/lib/finance/costs";
import { navOn } from "@/lib/finance/costs";
import type { Transaction } from "@/lib/cas/types";
import { fmtDate, inr } from "@/lib/format";

type Pt = { t: number; date: string; nav: number; buy?: number; sell?: number; txn?: string };

/** NAV line since first investment, with buy (filled) and sell (hollow) markers. */
export function NavChart({ series, txns }: { series: NavSeries; txns: Transaction[] }) {
  const { data, ticks } = useMemo(() => {
    const start = txns[0]?.date ?? series.dates[0];
    const rows = new Map<string, Pt>();
    // thin to ~260 points for mobile performance
    const idx = series.dates.map((d, i) => (d >= start ? i : -1)).filter((i) => i >= 0);
    const step = Math.max(1, Math.floor(idx.length / 260));
    idx.forEach((i, k) => {
      if (k % step === 0 || k === idx.length - 1) rows.set(series.dates[i], { t: Date.parse(series.dates[i]), date: series.dates[i], nav: series.navs[i] });
    });
    for (const tx of txns) {
      const u = tx.units ?? 0;
      if (!u) continue;
      const nav = tx.nav ?? navOn(series, tx.date) ?? 0;
      const row = rows.get(tx.date) ?? { t: Date.parse(tx.date), date: tx.date, nav };
      if (u > 0) row.buy = nav;
      else row.sell = nav;
      row.txn = `${row.txn ? row.txn + " + " : ""}${tx.description} · ${inr(Math.abs(tx.amount ?? 0))}`;
      rows.set(tx.date, row);
    }
    const data = [...rows.values()].sort((a, b) => a.t - b.t);
    const y0 = +start.slice(0, 4) + 1;
    const y1 = +(data[data.length - 1]?.date ?? start).slice(0, 4);
    const every = Math.max(1, Math.ceil((y1 - y0 + 1) / 5));
    const ticks: number[] = [];
    for (let y = y0; y <= y1; y += every) ticks.push(Date.UTC(y, 0, 1));
    return { data, ticks };
  }, [series, txns]);
  const dense = txns.filter((t) => t.units).length > 40;

  return (
    <div className="h-56 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} ticks={ticks} tickFormatter={(t) => new Date(t).getUTCFullYear().toString()} tick={{ fontSize: 11, fill: "var(--ink-3)" }} tickLine={false} axisLine={false} minTickGap={40} />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "var(--ink-3)" }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            cursor={{ stroke: "var(--ink-3)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Pt;
              return (
                <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl">
                  <div className="font-semibold">{fmtDate(p.date)}</div>
                  <div className="num">NAV ₹{(p.buy ?? p.sell ?? p.nav).toFixed(2)}</div>
                  {p.txn && <div className="mt-0.5 text-ink-2">{p.txn}</div>}
                </div>
              );
            }}
          />
          <Line type="monotone" dataKey="nav" stroke="var(--s7)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
          <Scatter
            dataKey="buy"
            isAnimationActive={false}
            shape={(pr: { cx?: number; cy?: number }) => (pr.cx == null || pr.cy == null ? <g /> : <circle cx={pr.cx} cy={pr.cy} r={dense ? 2.5 : 5} fill="var(--s3)" fillOpacity={dense ? 0.75 : 1} stroke={dense ? "none" : "var(--surface)"} strokeWidth={2} />)}
          />
          <Scatter
            dataKey="sell"
            isAnimationActive={false}
            shape={(pr: { cx?: number; cy?: number }) => (pr.cx == null || pr.cy == null ? <g /> : <circle cx={pr.cx} cy={pr.cy} r={5} fill="var(--surface)" stroke="var(--s2)" strokeWidth={2.5} />)}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
