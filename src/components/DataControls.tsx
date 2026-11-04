"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/store/store";

export function DataControls() {
  const router = useRouter();
  const remember = useStore((s) => s.remember);
  const setRemember = useStore((s) => s.setRemember);
  const hasData = useStore((s) => !!s.cas);
  const wipe = useStore((s) => s.wipe);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <section className="mt-8 grid gap-3 sm:grid-cols-2">
      <div className="card p-5">
        <h2 className="font-display text-lg font-bold">Remember on this device</h2>
        <p className="mt-1 text-sm text-ink-2">Keep your parsed portfolio and goals in this browser&apos;s local storage, so you don&apos;t need to re-upload. Off by default.</p>
        <label className="mt-4 flex cursor-pointer items-center gap-3">
          <span className="relative inline-flex">
            <input type="checkbox" className="peer sr-only" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span className="h-7 w-12 rounded-full bg-surface-2 ring-1 ring-line transition peer-checked:bg-brand" />
            <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          </span>
          <span className="text-sm font-semibold">{remember ? "On — saved in this browser only" : "Off — forgotten when you close the tab"}</span>
        </label>
      </div>
      <div className="card p-5">
        <h2 className="font-display text-lg font-bold">Delete my data</h2>
        <p className="mt-1 text-sm text-ink-2">Erase the parsed statement, goals, chat and settings from this browser immediately.</p>
        {done ? (
          <p className="mt-4 rounded-xl bg-good-soft px-3 py-2 text-sm font-semibold text-pos">Done. Nothing from your statement remains in this browser.</p>
        ) : confirm ? (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                wipe();
                setDone(true);
                setConfirm(false);
                setTimeout(() => router.push("/"), 1200);
              }}
              className="rounded-full bg-neg px-5 py-2.5 font-display font-bold text-white"
            >
              Yes, delete everything
            </button>
            <button onClick={() => setConfirm(false)} className="rounded-full border border-line px-4 py-2.5 text-sm">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} className="mt-4 rounded-full border-2 border-neg px-5 py-2.5 font-display font-bold text-neg" disabled={!hasData && !remember}>
            {hasData || remember ? "Delete my data" : "Nothing stored"}
          </button>
        )}
      </div>
    </section>
  );
}
