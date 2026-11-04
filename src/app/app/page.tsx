"use client";
import { useMemo } from "react";
import { WithPortfolio } from "@/components/Guard";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { AllocationCard } from "@/components/dashboard/AllocationCard";
import { HealthCard } from "@/components/dashboard/HealthCard";
import { FundList } from "@/components/dashboard/FundList";
import { ValueChart } from "@/components/charts/ValueChart";
import { Disclaimer } from "@/components/Disclaimer";
import { RememberBanner } from "@/components/dashboard/RememberBanner";
import { BenchmarkCard } from "@/components/dashboard/BenchmarkCard";
import { healthFacts, healthHeadline } from "@/lib/health";
import { buildTimeline } from "@/lib/finance/timeline";
import { useStore } from "@/store/store";
import { inrShort } from "@/lib/format";
import type { PortfolioState } from "@/lib/usePortfolio";

export default function Dashboard() {
  return <WithPortfolio>{(s) => <DashboardInner s={s} />}</WithPortfolio>;
}

function DashboardInner({ s }: { s: PortfolioState & { portfolio: NonNullable<PortfolioState["portfolio"]> } }) {
  const { portfolio: p, overlap, navs, navStatus } = s;
  const name = useStore((st) => st.cas?.investor.name ?? null);
  const timeline = useMemo(() => buildTimeline([...p.holdings, ...p.closed], navs, p.asOf ?? new Date().toISOString().slice(0, 10)), [p, navs]);
  const facts = useMemo(() => healthFacts(p, overlap), [p, overlap]);

  return (
    <div className="space-y-4">
      <HeroCard p={p} navStatus={navStatus} name={name} />
      <RememberBanner />
      {p.warnings.length > 0 && (
        <details className="rounded-2xl bg-watch-soft px-4 py-3 text-sm text-watch">
          <summary className="cursor-pointer font-semibold">{p.warnings.length} note{p.warnings.length > 1 ? "s" : ""} about your statement</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">{p.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </details>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <ValueChart points={timeline.points} live={timeline.usedLiveNavs} />
        <HealthCard headline={healthHeadline(p)} facts={facts.slice(0, 4)} />
      </div>
      <AllocationCard p={p} />
      <BenchmarkCard p={p} navs={navs} />
      <FundList holdings={p.holdings} total={p.value} />
      {facts.length > 4 && <HealthCard headline="More facts about your portfolio" facts={facts.slice(4)} />}
      {p.closed.length > 0 && (
        <section className="card p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold">Funds you&apos;ve fully exited</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {p.closed.map((h) => (
              <li key={h.id} className="flex justify-between gap-3 py-2.5">
                <span className="truncate">{h.shortName}</span>
                <span className={`num shrink-0 ${h.realisedGain >= 0 ? "text-pos" : "text-neg"}`}>realised {inrShort(h.realisedGain)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Disclaimer className="px-1 pt-2" />
    </div>
  );
}
