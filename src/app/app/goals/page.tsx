"use client";
import { useMemo, useState } from "react";
import { WithPortfolio } from "@/components/Guard";
import { Term } from "@/components/Term";
import { Disclaimer } from "@/components/Disclaimer";
import { goalProgress, type Goal } from "@/lib/finance/goals";
import type { Holding } from "@/lib/finance/portfolio";
import { fmtDate, inr, inrShort, pct, todayIso } from "@/lib/format";
import { useStore } from "@/store/store";

const EMOJIS = ["🏠", "🎓", "🏖️", "🚗", "👶", "🧓", "💍", "🛟", "🎯"];

function Ring({ value, size = 88 }: { value: number; size?: number }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(value * 100)}% funded`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--s3)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-[var(--ink)] font-display text-[17px] font-extrabold">
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}

const newGoal = (): Goal => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 5);
  return { id: Math.random().toString(36).slice(2), name: "", emoji: "🎯", target: 1000000, targetDate: d.toISOString().slice(0, 10), linked: [], sharePct: 100, assumedPct: 0 };
};

export default function GoalsPage() {
  return <WithPortfolio>{({ portfolio }) => <GoalsInner holdings={portfolio.holdings} />}</WithPortfolio>;
}

function GoalsInner({ holdings }: { holdings: Holding[] }) {
  const goals = useStore((s) => s.goals);
  const isSample = useStore((s) => s.isSample);
  const remember = useStore((s) => s.remember);
  const upsert = useStore((s) => s.upsertGoal);
  const remove = useStore((s) => s.removeGoal);
  const [editing, setEditing] = useState<Goal | null>(null);
  const today = todayIso();

  const addExamples = () => {
    const eq = holdings.filter((h) => h.assetClass === "Equity").map((h) => h.id);
    const debt = holdings.filter((h) => h.assetClass === "Debt").map((h) => h.id);
    upsert({ id: "ex-home", name: "Home down-payment", emoji: "🏠", target: 4000000, targetDate: "2030-12-31", linked: eq, sharePct: 60, assumedPct: 8 });
    upsert({ id: "ex-safety", name: "Emergency fund", emoji: "🛟", target: 300000, targetDate: "2026-12-31", linked: debt, sharePct: 100, assumedPct: 0 });
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Goals</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">What is this money for?</h1>
          <p className="mt-2 max-w-xl text-ink-2">Earmark funds for goals and track progress. Any growth rate is <Term id="assumption">your own assumption</Term> — we never predict returns.</p>
        </div>
        <button onClick={() => setEditing(newGoal())} className="rounded-full bg-ink px-5 py-3 font-display font-bold text-bg">+ New goal</button>
      </header>

      {!remember && goals.length > 0 && (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-xs text-ink-2">Goals are kept in memory for this session. Turn on “Remember on this device” in Privacy & data to keep them.</p>
      )}

      {editing && <GoalForm goal={editing} holdings={holdings} onCancel={() => setEditing(null)} onSave={(g) => { upsert(g); setEditing(null); }} />}

      {goals.length === 0 && !editing && (
        <div className="card p-6 text-center">
          <div className="text-4xl">🎯</div>
          <h2 className="mt-2 font-display text-xl font-bold">No goals yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">A goal turns a number into a reason: “72% of my home down-payment” means more than “₹14 lakh”.</p>
          {isSample && <button onClick={addExamples} className="mt-4 rounded-full bg-lime px-5 py-2.5 font-display font-bold text-[#121019]">Add example goals</button>}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {goals.map((g) => (
          <GoalCard key={g.id} g={g} holdings={holdings} today={today} onEdit={() => setEditing(g)} onDelete={() => remove(g.id)} />
        ))}
      </div>
      <Disclaimer className="px-1" />
    </div>
  );
}

function GoalCard({ g, holdings, today, onEdit, onDelete }: { g: Goal; holdings: Holding[]; today: string; onEdit: () => void; onDelete: () => void }) {
  const pr = useMemo(() => goalProgress(g, holdings, today), [g, holdings, today]);
  const linkedNames = g.linked.length ? holdings.filter((h) => g.linked.includes(h.id)).map((h) => h.shortName) : ["Whole portfolio"];
  const years = (pr.monthsLeft / 12).toFixed(1);
  return (
    <article className="card min-w-0 p-5">
      <div className="flex items-start gap-4">
        <Ring value={pr.progress} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold">{g.emoji} {g.name || "Untitled goal"}</h2>
          <p className="num mt-0.5 text-sm text-ink-2">{inrShort(pr.current)} of {inrShort(g.target)}</p>
          <p className="text-xs text-ink-3">by {fmtDate(g.targetDate)} · {pr.monthsLeft} months ({years} yrs) left</p>
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-surface-2 p-3 text-sm">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">If it grows at {g.assumedPct}% a year (your assumption)</div>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-ink-3">Today&apos;s money becomes</div>
            <div className="num font-display text-lg font-bold">{inrShort(pr.projectedAtAssumption)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-3">Monthly needed to close the gap</div>
            <div className="num font-display text-lg font-bold">{pr.onTrackAtAssumption ? "₹0 🎉" : inr(pr.monthlyNeeded)}</div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-ink-3">Real returns vary year to year and can be negative. Try a few assumptions.</p>
      </div>
      <p className="mt-3 truncate text-xs text-ink-3">Counts {g.sharePct}% of: {linkedNames.join(", ")}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={onEdit} className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold">Edit</button>
        <button onClick={onDelete} className="rounded-full px-4 py-1.5 text-sm text-ink-3 hover:text-neg">Delete</button>
      </div>
    </article>
  );
}

function GoalForm({ goal, holdings, onSave, onCancel }: { goal: Goal; holdings: Holding[]; onSave: (g: Goal) => void; onCancel: () => void }) {
  const [g, setG] = useState(goal);
  const set = <K extends keyof Goal>(k: K, v: Goal[K]) => setG((x) => ({ ...x, [k]: v }));
  const toggle = (id: string) => set("linked", g.linked.includes(id) ? g.linked.filter((x) => x !== id) : [...g.linked, id]);
  const linkedValue = (g.linked.length ? holdings.filter((h) => g.linked.includes(h.id)) : holdings).reduce((s, h) => s + h.value, 0);
  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...g, name: g.name.trim() || "My goal" });
      }}
    >
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icon">
        {EMOJIS.map((em) => (
          <button type="button" key={em} onClick={() => set("emoji", em)} aria-pressed={g.emoji === em} className={`grid h-10 w-10 place-items-center rounded-xl text-xl ${g.emoji === em ? "bg-brand-soft ring-2 ring-brand" : "bg-surface-2"}`}>
            {em}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm sm:col-span-1">
          <span className="text-ink-3">Goal name</span>
          <input value={g.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Home down-payment" className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 outline-none focus:border-brand" />
        </label>
        <label className="text-sm">
          <span className="text-ink-3">Target amount (₹)</span>
          <input type="number" inputMode="numeric" min={1000} step={1000} value={g.target} onChange={(e) => set("target", +e.target.value)} className="num mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 outline-none focus:border-brand" />
        </label>
        <label className="text-sm">
          <span className="text-ink-3">Target date</span>
          <input type="date" value={g.targetDate} min={todayIso()} onChange={(e) => set("targetDate", e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 outline-none focus:border-brand" />
        </label>
      </div>
      <fieldset>
        <legend className="text-sm text-ink-3">Funds that count toward it (none selected = whole portfolio)</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {holdings.map((h) => (
            <button type="button" key={h.id} onClick={() => toggle(h.id)} aria-pressed={g.linked.includes(h.id)} className={`rounded-full border px-3 py-1.5 text-xs ${g.linked.includes(h.id) ? "border-brand bg-brand-soft font-semibold" : "border-line"}`}>
              {h.shortName}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="rounded-2xl bg-surface-2 p-3 text-sm">
          <span className="flex justify-between font-semibold">Share earmarked <span className="num">{g.sharePct}% · {inrShort((linkedValue * g.sharePct) / 100)}</span></span>
          <input type="range" min={5} max={100} step={5} value={g.sharePct} onChange={(e) => set("sharePct", +e.target.value)} className="mt-2 w-full" />
        </label>
        <div className="rounded-2xl bg-surface-2 p-3 text-sm">
          <span className="flex justify-between font-semibold"><Term id="assumption">Your growth assumption</Term> <span className="num">{g.assumedPct}% / yr</span></span>
          <input type="range" min={0} max={15} step={0.5} value={g.assumedPct} onChange={(e) => set("assumedPct", +e.target.value)} className="mt-2 w-full" aria-label="Growth assumption" />
          <div className="mt-1 flex gap-1.5">
            {[0, 4, 8, 12].map((v) => (
              <button type="button" key={v} onClick={() => set("assumedPct", v)} className="rounded-full border border-line px-2.5 py-0.5 text-xs">{v}%</button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Starts at 0% — pick what you believe. It&apos;s a what-if, not a forecast.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="rounded-full bg-ink px-5 py-2.5 font-display font-bold text-bg">Save goal</button>
        <button type="button" onClick={onCancel} className="rounded-full border border-line px-5 py-2.5 text-sm">Cancel</button>
      </div>
      <p className="text-xs text-ink-3">Progress today: {pct(Math.min(1, (linkedValue * g.sharePct) / 100 / (g.target || 1)), 0)}</p>
    </form>
  );
}
