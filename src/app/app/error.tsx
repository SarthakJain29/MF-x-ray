"use client";
import Link from "next/link";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="film relative overflow-hidden rounded-3xl px-6 py-12 text-center">
      <div className="film-grid absolute inset-0 opacity-50" aria-hidden />
      <div className="relative">
        <h1 className="font-display text-3xl font-extrabold">Something went wrong on this screen</h1>
        <p className="mx-auto mt-2 max-w-sm text-white/70">Your data is still only on this device. Try again, or tell us about it with an anonymised report.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={reset} className="rounded-full bg-lime px-6 py-3 font-display font-bold text-[#121019]">Try again</button>
          <Link href="/app/report" className="rounded-full border border-white/20 px-6 py-3 font-semibold">Create a report</Link>
        </div>
      </div>
    </div>
  );
}
