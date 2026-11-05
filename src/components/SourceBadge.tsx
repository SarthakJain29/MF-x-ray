import type { DataSource } from "@/lib/overlap";
import { fmtYearMonth } from "@/lib/format";

/** Always-visible label for where holdings data came from and how fresh it is. */
export function SourceBadge({ source, asOf }: { source: DataSource | "none"; asOf?: string | null }) {
  const map = {
    disclosure: { cls: "bg-good-soft text-pos", text: `Official disclosure · ${fmtYearMonth(asOf)}` },
    "index-proxy": { cls: "bg-brand-soft text-brand", text: `Index portfolio · ${fmtYearMonth(asOf)}` },
    approximate: { cls: "bg-watch-soft text-watch", text: "Approximate · not live" },
    none: { cls: "bg-surface-2 text-ink-3", text: "No holdings data" },
  } as const;
  const m = map[source];
  return <span className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${m.cls}`}>{m.text}</span>;
}
