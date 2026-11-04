"use client";
import { useMemo, useState } from "react";
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDate, fmtMonth, inr, inrShort } from "@/lib/format";
import type { TimelinePoint } from "@/lib/finance/timeline";

const RANGES = [
  { k: "1Y", m: 12 },
  { k: "3Y", m: 36 },
  { k: "5Y", m: 60 },
  { k: "All", m: 0 },
] as const;

export function ValueChart({ points, live }: { points: TimelinePoint[]; live: boolean }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["k"]>("All");
  const data = useMemo(() => {
    const m = RANGES.find((r) => r.k === range)!.m;
    return m ? points.slice(-m - 1) : points;
  }, [points, range]);
  if (points.length < 2) return null;
  const last = data[data.length - 1];

  return (
    <section className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Value vs money put in</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--s1)]" /> Value {inrShort(last.value)}</span>
            <span className="flex items-center gap-1.5"><span className="h-0 w-3 border-t-2 border-dashed border-ink-3" /> Net invested {inrShort(last.invested)}</span>
          </div>
        </div>
        <div className="flex rounded-full bg-surface-2 p-1 text-xs font-semibold" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.k} role="tab" aria-selected={range === r.k} onClick={() => setRange(r.k)} className={`rounded-full px-3 py-1.5 ${range === r.k ? "bg-ink text-bg" : "text-ink-3"}`}>
              {r.k}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 h-56 sm:h-72" role="img" aria-label={`Portfolio value ${inrShort(last.value)} against net invested ${inrShort(last.invested)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="vfill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--s1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--s1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="date" tickFormatter={fmtMonth} tick={{ fontSize: 11, fill: "var(--ink-3)" }} tickLine={false} axisLine={false} minTickGap={40} />
            <YAxis tickFormatter={(v) => inrShort(v).replace("₹", "")} tick={{ fontSize: 11, fill: "var(--ink-3)" }} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              cursor={{ stroke: "var(--ink-3)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0].payload as TimelinePoint;
                const g = pt.value - pt.invested;
                return (
                  <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl">
                    <div className="font-semibold">{fmtDate(pt.date)}</div>
                    <div className="mt-1 flex justify-between gap-4"><span className="text-ink-3">Value</span><span className="num font-semibold">{inr(pt.value)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-ink-3">Net invested</span><span className="num">{inr(pt.invested)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-ink-3">Gain</span><span className={`num ${g >= 0 ? "text-pos" : "text-neg"}`}>{inr(g)}</span></div>
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="value" stroke="var(--s1)" strokeWidth={2} fill="url(#vfill)" activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="invested" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-ink-3">
        {live ? "Month-end values using historical NAVs from mfapi.in." : "Approximated from NAVs printed in your statement (live NAV history unavailable)."} Net invested = purchases − withdrawals.
      </p>
    </section>
  );
}
