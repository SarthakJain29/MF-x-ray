"use client";
import { useEffect, useState } from "react";

const KEY = "mfxray:tour-done";
const STEPS = [
  { emoji: "🩻", title: "Your portfolio, X-rayed", body: "The dark card up top is the headline: what your funds are worth now, what those units cost, and your XIRR — your real yearly growth rate." },
  { emoji: "🧩", title: "Overlap", body: "Find funds that own the same companies — “these 2 funds are 51% the same” — plus your real top 10 stocks and sectors across every fund." },
  { emoji: "🧾", title: "Costs & Tax", body: "See the fees you never get a bill for, regular-plan commission, and an estimate of capital gains tax. Estimates, clearly labelled." },
  { emoji: "💬", title: "Tap any underlined word", body: "Every bit of jargon explains itself. Still curious? Ask questions about your own portfolio in the Ask tab." },
  { emoji: "🔒", title: "It stays on your device", body: "Your statement was read inside this browser. Nothing was uploaded. MF X-ray shows facts and explains them — it never tells you what to buy or sell." },
];

export function startTour() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("mfxray:tour"));
}

/** First-run walkthrough for beginners. Shown once per browser; can be replayed from Learn. */
export function Tour() {
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => {
    const open = () => setStep(0);
    let done = false;
    try {
      done = localStorage.getItem(KEY) === "1";
    } catch {
      /* storage blocked: show once per session */
    }
    const t = done ? null : setTimeout(open, 900);
    window.addEventListener("mfxray:tour", open);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("mfxray:tour", open);
    };
  }, []);
  if (step == null) return null;
  const finish = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setStep(null);
  };
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="w-full max-w-md rounded-t-3xl bg-surface p-6 shadow-2xl sm:rounded-3xl">
        <div className="text-4xl" aria-hidden>{s.emoji}</div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Quick tour · {step + 1} of {STEPS.length}</p>
        <h2 id="tour-title" className="mt-1 font-display text-2xl font-extrabold">{s.title}</h2>
        <p className="mt-2 leading-relaxed text-ink-2">{s.body}</p>
        <div className="mt-5 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-brand" : "w-1.5 bg-line"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {!last && <button onClick={finish} className="rounded-full px-4 py-2 text-sm text-ink-3">Skip</button>}
            <button autoFocus onClick={() => (last ? finish() : setStep(step + 1))} className="rounded-full bg-ink px-5 py-2.5 font-display font-bold text-bg">
              {last ? "Start exploring" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
