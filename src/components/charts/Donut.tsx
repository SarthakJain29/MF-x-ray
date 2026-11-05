"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { inr, pct } from "@/lib/format";

export interface DonutSlice {
  key: string;
  value: number;
  share: number;
  color: string;
}

export function Donut({ data, center, sub }: { data: DonutSlice[]; center: string; sub: string }) {
  return (
    <div className="relative aspect-square w-full max-w-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="key" innerRadius="68%" outerRadius="100%" paddingAngle={data.length > 1 ? 1.5 : 0} cornerRadius={4} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as DonutSlice;
              return (
                <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl">
                  <div className="flex items-center gap-1.5 font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: d.color }} />{d.key}</div>
                  <div className="num mt-0.5">{inr(d.value)} · {pct(d.share)}</div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-2xl font-extrabold">{center}</div>
          <div className="text-[11px] text-ink-3">{sub}</div>
        </div>
      </div>
    </div>
  );
}
