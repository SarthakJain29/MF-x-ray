"use client";
import { useState } from "react";
import { useStore } from "@/store/store";

/** One-time, dismissible prompt for real uploads: keep the parsed portfolio in this browser? */
export function RememberBanner() {
  const remember = useStore((s) => s.remember);
  const isSample = useStore((s) => s.isSample);
  const setRemember = useStore((s) => s.setRemember);
  const [hidden, setHidden] = useState(false);
  if (remember || isSample || hidden) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
      <span className="min-w-0 flex-1 text-ink-2">
        Keep this portfolio on this device so you don&apos;t have to re-upload? It&apos;s saved only in this browser, and you can delete it anytime.
      </span>
      <span className="flex gap-2">
        <button onClick={() => setRemember(true)} className="rounded-full bg-ink px-4 py-1.5 font-semibold text-bg">Remember</button>
        <button onClick={() => setHidden(true)} className="rounded-full px-3 py-1.5 text-ink-3">Not now</button>
      </span>
    </div>
  );
}
