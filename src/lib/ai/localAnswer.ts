/**
 * Offline / mock-mode answers computed directly from the anonymised context.
 * Used when no LLM key is configured or the provider fails, so chat always works.
 */
import type { AiContext, AiFund } from "./anonymize";
import { inrShort } from "../format";

const ADVICE = /\b(should i|shall i|recommend|suggest|which fund (to|should)|buy|sell|switch|exit|stop (my )?sip|start (a )?sip|invest more|redeem|best fund to)\b/i;
const FORECAST = /\b(will|predict|forecast|expect|next year|future|going to|target price|how much will)\b/i;

const pc = (n: number | null) => (n == null ? "not available" : `${n.toFixed(1)}%`);
const fundLine = (f: AiFund) => `${f.fund} (${f.plan}) — ${inrShort(f.value)}, XIRR ${pc(f.xirrPct)}`;

export const SUGGESTED_QUESTIONS = [
  "What's my overall XIRR?",
  "How much am I paying in fees?",
  "Which of my funds overlap the most?",
  "How is my money split between equity and debt?",
  "Which fund has grown the fastest so far?",
  "Do I have any regular plans?",
];

export function localAnswer(question: string, ctx: AiContext): string {
  const q = question.toLowerCase();
  const t = ctx.totals;
  if (FORECAST.test(q) && !/xirr|past|so far|did/.test(q))
    return "I can't predict future returns — nobody reliably can, and MF X-ray only describes facts about your portfolio. What I can tell you: your money has grown at an XIRR of " +
      `${pc(t.xirrPct)} so far. Past returns don't indicate future returns. For forward-looking planning, try the Goals tab with growth assumptions you choose.`;
  if (ADVICE.test(q))
    return "I can't recommend buying, selling or switching — MF X-ray isn't a SEBI-registered investment adviser. I can explain facts about your funds (costs, overlap, returns so far) so you can make your own decision or discuss it with a SEBI-registered adviser. Try asking “How much am I paying in fees?” or “Which funds overlap?”.";

  const mentioned = ctx.funds.find((f) => q.includes(f.fund.toLowerCase()) || f.fund.toLowerCase().split(" ").filter((w) => w.length > 3).slice(0, 2).every((w) => q.includes(w)));
  if (mentioned) {
    const f = mentioned;
    return [
      `**${f.fund}** (${f.plan} plan, ${f.category}, ${f.fundHouse})`,
      `• Value ${inrShort(f.value)} — ${f.sharePct}% of your portfolio`,
      `• Cost ${inrShort(f.cost)}, gain ${inrShort(f.gain)}`,
      `• XIRR so far: ${pc(f.xirrPct)}${f.investingSinceYear ? ` (investing since ${f.investingSinceYear})` : ""}`,
      `• Expense ratio: ${f.expenseRatioPct ?? "n/a"}%${f.plan === "Regular" && f.directPlanExpenseRatioPct != null ? ` (direct plan: ${f.directPlanExpenseRatioPct}%)` : ""}`,
    ].join("\n");
  }

  if (/xirr|return|perform|grow|growth|fastest|best|worst|lowest|highest/.test(q)) {
    const ranked = ctx.funds.filter((f) => f.xirrPct != null).sort((a, b) => b.xirrPct! - a.xirrPct!);
    const lines = [`Your overall XIRR is **${pc(t.xirrPct)}** a year — that's the annual growth rate of all your money, considering when each rupee went in.`];
    if (ranked.length) {
      lines.push("", "By fund (past performance only):", ...ranked.map((f) => `• ${fundLine(f)}`));
      lines.push("", "Funds held for under a year can show extreme XIRRs; give them time before comparing.");
    }
    return lines.join("\n");
  }
  if (/fee|cost|expense|ter|charge|commission/.test(q)) {
    const yearly = ctx.funds.reduce((s, f) => s + (f.expenseRatioPct ? (f.value * f.expenseRatioPct) / 100 : 0), 0);
    const reg = ctx.funds.filter((f) => f.plan === "Regular");
    const extra = reg.reduce((s, f) => s + (f.expenseRatioPct != null && f.directPlanExpenseRatioPct != null ? (f.value * (f.expenseRatioPct - f.directPlanExpenseRatioPct)) / 100 : 0), 0);
    return [
      `Your weighted average expense ratio is **${t.weightedExpenseRatioPct ?? "n/a"}%**, which is roughly **${inrShort(yearly)} a year** at today's value.`,
      reg.length ? `${reg.length} of your funds are regular plans; their fees are about ${inrShort(extra)} a year higher than the direct plans of the same funds.` : "All your funds are direct plans.",
      "The Costs tab shows how this compounds over 5, 10 and 20 years under an assumption you choose.",
    ].join("\n\n");
  }
  if (/regular|direct|distributor|commission/.test(q)) {
    const reg = ctx.funds.filter((f) => f.plan === "Regular");
    return reg.length
      ? `You have ${reg.length} regular-plan fund(s):\n${reg.map((f) => `• ${f.fund}: ${f.expenseRatioPct ?? "?"}% vs ${f.directPlanExpenseRatioPct ?? "?"}% for direct`).join("\n")}\n\nRegular plans include distributor commission inside the expense ratio. The portfolio is identical to the direct plan.`
      : "All your funds are direct plans — no distributor commission is built into their expense ratios.";
  }
  if (/overlap|same stock|common|duplicate|similar/.test(q)) {
    if (!ctx.overlaps.length) return "I don't have holdings data for enough of your equity funds to measure overlap. The Overlap tab shows which funds share a category instead.";
    return [
      `Biggest overlaps between your funds${ctx.holdingsDataMonth ? ` (holdings as of ${ctx.holdingsDataMonth})` : ""}:`,
      ...ctx.overlaps.slice(0, 4).map((o) => `• ${o.fundA} ↔ ${o.fundB}: ${o.verdict} (e.g. ${o.commonTop.slice(0, 3).join(", ")})`),
    ].join("\n");
  }
  if (/stock|company|hdfc bank|reliance|exposure|own/.test(q) && ctx.topStockExposure.length) {
    return ["Your largest look-through stock exposures across funds:", ...ctx.topStockExposure.slice(0, 6).map((s) => `• ${s.stock}: ${inrShort(s.value)} (${s.pctOfEquity}% of your equity)`)].join("\n");
  }
  if (/sector|industry|industries|bank(s|ing)? exposure/.test(q) && Object.keys(ctx.sectorExposurePct).length) {
    return ["Your equity money by sector (across all funds):", ...Object.entries(ctx.sectorExposurePct).map(([k, v]) => `• ${k}: ${v}%`)].join("\n");
  }
  if (/equity|debt|allocation|split|mix|asset|gold|hybrid/.test(q)) {
    return ["Your money is split like this:", ...Object.entries(ctx.allocation.assetClass).map(([k, v]) => `• ${k}: ${v}%`), "", "There's no universally right split; it depends on when you need the money and how much short-term movement you can live with."].join("\n");
  }
  if (/how many|number of funds|funds do i/.test(q)) return `You hold ${t.funds} funds across ${Object.keys(ctx.allocation.fundHouse).length} fund houses.`;
  if (/largest|biggest|most money|top fund/.test(q)) {
    const f = [...ctx.funds].sort((a, b) => b.value - a.value)[0];
    return f ? `Your largest holding is ${fundLine(f)} — ${f.sharePct}% of your portfolio.` : "No holdings found.";
  }
  if (/worth|value|total|invested|gain|profit|loss/.test(q))
    return `Your portfolio is worth **${inrShort(t.value)}**. The units you hold cost ${inrShort(t.cost)}, so you're ${t.gain >= 0 ? "up" : "down"} ${inrShort(Math.abs(t.gain))} on paper. You've also realised ${inrShort(t.realisedGain)} from past sales/payouts.`;

  return `Here's a quick snapshot: ${t.funds} funds worth ${inrShort(t.value)}, XIRR ${pc(t.xirrPct)}, average expense ratio ${t.weightedExpenseRatioPct ?? "n/a"}%.\n\nYou can ask things like:\n${SUGGESTED_QUESTIONS.slice(0, 4).map((s) => `• ${s}`).join("\n")}`;
}
