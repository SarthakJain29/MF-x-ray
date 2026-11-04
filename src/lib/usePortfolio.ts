"use client";
/** Derives the portfolio (and supporting data) from the stored CAS. All computation is on-device. */
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/store";
import { loadSchemeIndex, type SchemeIndex } from "@/lib/data/schemeIndex";
import { loadTerIndex, type TerIndex } from "@/lib/data/ter";
import { navHistories } from "@/lib/data/nav";
import type { NavSeries } from "@/lib/finance/costs";
import { buildPortfolio, type LatestNav, type Portfolio } from "@/lib/finance/portfolio";
import { overlapReport, type OverlapReport } from "@/lib/overlap";

export interface PortfolioState {
  ready: boolean;
  portfolio: Portfolio | null;
  overlap: OverlapReport | null;
  navs: Record<number, NavSeries>;
  navStatus: "idle" | "loading" | "done" | "failed";
  indexes: { scheme: SchemeIndex | null; ter: TerIndex | null; loaded: boolean };
}

let indexCache: PortfolioState["indexes"] | null = null;
let navCache: Record<number, NavSeries> = {};

export function usePortfolio(): PortfolioState {
  const cas = useStore((s) => s.cas);
  const [indexes, setIndexes] = useState(indexCache ?? { scheme: null, ter: null, loaded: false });
  const [navs, setNavs] = useState<Record<number, NavSeries>>(navCache);
  const [navStatus, setNavStatus] = useState<PortfolioState["navStatus"]>(Object.keys(navCache).length ? "done" : "idle");

  useEffect(() => {
    if (indexes.loaded) return;
    let alive = true;
    Promise.all([loadSchemeIndex(), loadTerIndex()]).then(([scheme, ter]) => {
      indexCache = { scheme, ter, loaded: true };
      if (alive) setIndexes(indexCache);
    });
    return () => {
      alive = false;
    };
  }, [indexes.loaded]);

  const base = useMemo(() => (cas && indexes.loaded ? buildPortfolio(cas, { schemeIndex: indexes.scheme, terIndex: indexes.ter }) : null), [cas, indexes]);

  // Fetch NAV history (public data) for held schemes and their direct-plan twins.
  useEffect(() => {
    if (!base) return;
    const codes = [...base.holdings, ...base.closed].flatMap((h) => [h.amfiCode, h.directCode]).filter((c): c is number => c != null);
    const missing = codes.filter((c) => !navCache[c]);
    if (!missing.length) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for an async fetch
    setNavStatus("loading");
    navHistories(missing).then((res) => {
      navCache = { ...navCache, ...res };
      if (!alive) return;
      setNavs(navCache);
      setNavStatus(Object.keys(res).length ? "done" : "failed");
    });
    return () => {
      alive = false;
    };
  }, [base]);

  const portfolio = useMemo(() => {
    if (!cas || !base) return null;
    const latestNav: Record<number, LatestNav> = {};
    for (const [code, s] of Object.entries(navs)) {
      const n = s.navs.length;
      if (n) latestNav[+code] = { nav: s.navs[n - 1], date: s.dates[n - 1] };
    }
    return Object.keys(latestNav).length ? buildPortfolio(cas, { schemeIndex: indexes.scheme, terIndex: indexes.ter, latestNav }) : base;
  }, [cas, base, navs, indexes]);

  const overlap = useMemo(() => (portfolio ? overlapReport(portfolio.holdings) : null), [portfolio]);

  return { ready: !!portfolio, portfolio, overlap, navs, navStatus, indexes };
}
