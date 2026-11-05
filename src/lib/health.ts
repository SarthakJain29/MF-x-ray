/** Plain-language "portfolio health" facts. Facts and education only — never buy/sell advice. */
import type { Portfolio } from "./finance/portfolio";
import { paidTer } from "./finance/portfolio";
import type { OverlapReport } from "./overlap";
import { inrShort, pct } from "./format";

export type Tone = "good" | "neutral" | "watch";
export interface HealthFact {
  id: string;
  tone: Tone;
  title: string;
  body: string;
  /** glossary term id to link */
  term?: string;
}

export function healthFacts(p: Portfolio, overlap: OverlapReport | null): HealthFact[] {
  const facts: HealthFact[] = [];
  const n = p.holdings.length;
  const amcs = p.allocation.amc.length;
  facts.push({
    id: "count",
    tone: n > 12 ? "watch" : "neutral",
    title: `${n} funds across ${amcs} fund house${amcs === 1 ? "" : "s"}`,
    body:
      n > 12
        ? "That's a lot of funds to keep track of. More funds doesn't always mean more diversification — many may own the same companies."
        : "Owning a handful of well-understood funds is easier to track. Check the Overlap tab to see whether they own different things.",
    term: "diversification",
  });

  const eq = p.allocation.assetClass.find((s) => s.key === "Equity")?.share ?? 0;
  const debt = p.allocation.assetClass.find((s) => s.key === "Debt")?.share ?? 0;
  facts.push({
    id: "mix",
    tone: "neutral",
    title: `${pct(eq, 0)} in equity, ${pct(debt, 0)} in debt`,
    body:
      "Equity (shares) can rise and fall a lot in the short term; debt (bonds) usually moves less. The right mix depends on when you need the money — there's no single correct number.",
    term: "asset-allocation",
  });

  const regular = p.holdings.filter((h) => h.plan === "Regular");
  if (regular.length) {
    const extra = regular.reduce((s, h) => s + (h.ter.regular != null && h.ter.direct != null ? (h.value * (h.ter.regular - h.ter.direct)) / 100 : 0), 0);
    facts.push({
      id: "regular",
      tone: "watch",
      title: `${regular.length} regular-plan fund${regular.length === 1 ? "" : "s"} — about ${inrShort(extra)}/year in extra fees`,
      body:
        "Regular plans include a distributor commission inside the expense ratio. The same fund's direct plan has the same portfolio but a lower fee. See the Costs tab for the details.",
      term: "direct-vs-regular",
    });
  } else {
    facts.push({ id: "regular", tone: "good", title: "All your funds are direct plans", body: "Direct plans don't carry distributor commission, so their expense ratio is lower than the regular plan of the same fund.", term: "direct-vs-regular" });
  }

  if (p.weightedTer != null) {
    const yearly = (p.value * p.weightedTer) / 100;
    facts.push({
      id: "ter",
      tone: p.weightedTer > 1.2 ? "watch" : "neutral",
      title: `Average expense ratio ${p.weightedTer.toFixed(2)}% ≈ ${inrShort(yearly)} a year`,
      body: "The expense ratio is taken out of the fund every day, quietly. You never see a bill, but it reduces your returns.",
      term: "expense-ratio",
    });
  }

  const top = p.holdings[0];
  if (top && p.value > 0 && top.value / p.value > 0.35) {
    facts.push({
      id: "concentration",
      tone: "watch",
      title: `${pct(top.value / p.value, 0)} of your money is in one fund`,
      body: `${top.shortName} is your largest holding. A single fund isn't necessarily risky, but it's worth knowing how much depends on one fund manager's decisions.`,
      term: "concentration",
    });
  }

  if (overlap && overlap.pairs.length) {
    const top = overlap.pairs[0];
    const nameOf = (id: string) => p.holdings.find((h) => h.id === id)?.shortName ?? "";
    if (top.overlap >= 35) {
      facts.push({
        id: "overlap",
        tone: "watch",
        title: `${nameOf(top.a)} and ${nameOf(top.b)} are ${Math.round(top.overlap)}% the same`,
        body: `They share ${top.common.length} companies. Highly overlapping funds behave alike, so owning both adds less diversification than it seems.`,
        term: "overlap",
      });
    } else {
      facts.push({ id: "overlap", tone: "good", title: "Your equity funds own fairly different companies", body: `Your most similar pair overlaps ${Math.round(top.overlap)}%.`, term: "overlap" });
    }
    if (overlap.exposure[0] && overlap.exposure[0].shareOfEquity > 0.07) {
      const e = overlap.exposure[0];
      facts.push({
        id: "top-stock",
        tone: "neutral",
        title: `${pct(e.shareOfEquity, 0)} of your equity money is in ${e.name}`,
        body: `Through ${e.funds.length} different fund${e.funds.length > 1 ? "s" : ""}. Look-through exposure adds up what you own across all funds.`,
        term: "look-through",
      });
    }
  }

  if (p.xirr != null) {
    facts.push({
      id: "xirr",
      tone: "neutral",
      title: `Your money has grown at ${pct(p.xirr)} a year (XIRR)`,
      body: "XIRR accounts for when each rupee went in and came out, so it's the fairest single number for SIP investors. Past returns don't tell you future returns.",
      term: "xirr",
    });
  }

  const short = p.holdings.filter((h) => h.firstDate && (Date.parse(p.asOf ?? "") - Date.parse(h.firstDate)) / 86400000 < 365);
  if (short.length)
    facts.push({ id: "young", tone: "neutral", title: `${short.length} fund${short.length === 1 ? " is" : "s are"} less than a year old in your portfolio`, body: "Annualised returns over short periods swing wildly and can look extreme. Give them time before reading much into them.", term: "xirr" });

  return facts;
}

export function healthHeadline(p: Portfolio): string {
  const g = p.unrealisedGain;
  return g >= 0
    ? `Your ${p.holdings.length} funds are worth ${inrShort(p.value)} — ${inrShort(g)} more than what those units cost you.`
    : `Your ${p.holdings.length} funds are worth ${inrShort(p.value)} — ${inrShort(-g)} below what those units cost you.`;
}

export { paidTer };
