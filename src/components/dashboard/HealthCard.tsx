import { Term } from "@/components/Term";
import type { HealthFact } from "@/lib/health";

const TONE = {
  good: { label: "Good to know", icon: "✓", cls: "bg-good-soft text-pos" },
  neutral: { label: "Fact", icon: "i", cls: "bg-surface-2 text-ink-2" },
  watch: { label: "Worth a look", icon: "!", cls: "bg-watch-soft text-watch" },
} as const;

export function HealthCard({ headline, facts }: { headline: string; facts: HealthFact[] }) {
  return (
    <section className="card p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Portfolio health · in plain words</p>
      <h2 className="mt-2 font-display text-xl font-bold leading-snug sm:text-2xl">{headline}</h2>
      <ul className="mt-5 divide-y divide-line">
        {facts.map((f) => {
          const t = TONE[f.tone];
          return (
            <li key={f.id} className="flex gap-3 py-3.5">
              <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${t.cls}`} aria-label={t.label} title={t.label}>
                {t.icon}
              </span>
              <div className="min-w-0">
                <div className="font-semibold">{f.title}</div>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{f.body}</p>
                {f.term && (
                  <p className="mt-1 text-xs text-ink-3">
                    What&apos;s this? <Term id={f.term} />
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
