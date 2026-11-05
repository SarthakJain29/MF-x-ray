"use client";
/** Shows a friendly empty/loading state until a portfolio is available. */
import Link from "next/link";
import { useStore } from "@/store/store";
import { usePortfolio, type PortfolioState } from "@/lib/usePortfolio";

export function WithPortfolio({ children }: { children: (s: PortfolioState & { portfolio: NonNullable<PortfolioState["portfolio"]> }) => React.ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const cas = useStore((s) => s.cas);
  const state = usePortfolio();
  if (!hydrated || (cas && !state.portfolio)) return <Loading />;
  if (!cas || !state.portfolio) return <Empty />;
  return <>{children(state as PortfolioState & { portfolio: NonNullable<PortfolioState["portfolio"]> })}</>;
}

function Loading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="film scan h-48 rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        <div className="card h-24 animate-pulse" />
        <div className="card h-24 animate-pulse" />
      </div>
      <span className="sr-only">Loading your portfolio…</span>
    </div>
  );
}

function Empty() {
  return (
    <div className="film relative overflow-hidden rounded-3xl px-6 py-14 text-center">
      <div className="film-grid absolute inset-0 opacity-50" aria-hidden />
      <div className="relative">
        <h1 className="font-display text-3xl font-extrabold">Nothing to X-ray yet</h1>
        <p className="mx-auto mt-2 max-w-sm text-white/70">Upload your CAS, or explore with a fictional sample portfolio.</p>
        <Link href="/" className="mt-6 inline-block rounded-full bg-lime px-6 py-3 font-display font-bold text-[#121019]">
          Upload a statement →
        </Link>
      </div>
    </div>
  );
}
