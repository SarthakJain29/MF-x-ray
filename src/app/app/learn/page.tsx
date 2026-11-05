"use client";
import { useMemo, useState } from "react";
import { LEARN_CARDS } from "@/lib/learn";
import { GLOSSARY } from "@/lib/glossary";
import { Disclaimer } from "@/components/Disclaimer";
import { startTour } from "@/components/Tour";
import Link from "next/link";

const TAGS = ["All", "Basics", "Returns", "Costs", "Risk", "Your CAS"] as const;

export default function LearnPage() {
  const [tag, setTag] = useState<(typeof TAGS)[number]>("All");
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const cards = LEARN_CARDS.filter((c) => tag === "All" || c.tag === tag);
  const terms = useMemo(() => {
    const s = q.trim().toLowerCase();
    return Object.values(GLOSSARY)
      .filter((t) => !s || t.term.toLowerCase().includes(s) || t.short.toLowerCase().includes(s))
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [q]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Learn</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Two-minute lessons</h1>
        <p className="mt-2 max-w-xl text-ink-2">Short, jargon-free explainers for the ideas behind every number in MF X-ray.</p>
        <Link href="/app" onClick={() => startTour()} className="mt-3 inline-block text-sm font-semibold text-brand underline underline-offset-2">Replay the quick tour →</Link>
      </header>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TAGS.map((t) => (
          <button key={t} onClick={() => setTag(t)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${tag === t ? "bg-ink text-bg" : "border border-line text-ink-2"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c, i) => {
          const isOpen = open === c.id;
          return (
            <article key={c.id} className={`card overflow-hidden transition ${isOpen ? "sm:col-span-2" : ""}`}>
              <button onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen} className="flex w-full items-start gap-4 p-5 text-left">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `color-mix(in oklab, var(--s${(i % 7) + 1}) 18%, var(--surface))` }}>
                  {c.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{c.tag} · {c.minutes} min</span>
                  <span className="mt-0.5 block font-display text-lg font-bold leading-snug">{c.title}</span>
                </span>
                <span className={`mt-1 text-ink-3 transition ${isOpen ? "rotate-45" : ""}`} aria-hidden>＋</span>
              </button>
              {isOpen && (
                <ol className="space-y-3 border-t border-line px-5 pb-5 pt-4">
                  {c.body.map((b, j) => (
                    <li key={j} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
                      <span className="font-display font-extrabold text-brand">{j + 1}</span>
                      {b}
                    </li>
                  ))}
                </ol>
              )}
            </article>
          );
        })}
      </div>

      <section className="card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Glossary</h2>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search terms…" className="w-full max-w-xs rounded-full border border-line bg-surface-2 px-4 py-2 text-sm outline-none focus:border-brand" aria-label="Search glossary" />
        </div>
        <dl className="mt-4 divide-y divide-line">
          {terms.map((t) => (
            <div key={t.id} id={t.id} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr]">
              <dt className="font-semibold">{t.term}</dt>
              <dd className="text-sm leading-relaxed text-ink-2">
                {t.short}
                {t.long && <span className="mt-1 block text-ink-3">{t.long}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <Disclaimer className="px-1" />
    </div>
  );
}
