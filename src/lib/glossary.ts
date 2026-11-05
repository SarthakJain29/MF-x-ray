/** Plain-language explanations for every term shown in the app. */
export interface Term {
  id: string;
  term: string;
  short: string;
  long?: string;
}

export const GLOSSARY: Record<string, Term> = Object.fromEntries(
  (
    [
      { id: "cas", term: "CAS", short: "Consolidated Account Statement — one PDF listing all your mutual fund investments across fund houses, sent by CAMS and KFintech.", long: "Request it free at camsonline.com or kfintech.com. Choose “Detailed” and period “Since inception” for the most accurate numbers here." },
      { id: "nav", term: "NAV", short: "Net Asset Value — the price of one unit of a fund on a given day.", long: "A fund with NAV ₹50 isn't “cheaper” than one with NAV ₹500. What matters is how the NAV changes over time." },
      { id: "units", term: "Units", short: "How many pieces of the fund you own. Value = units × NAV." },
      { id: "current-value", term: "Current value", short: "What your units are worth at the latest NAV: units × NAV." },
      { id: "invested", term: "Invested (cost)", short: "What you paid for the units you still hold. Units you've already sold aren't counted here." },
      { id: "gain", term: "Gain", short: "Current value minus what those units cost you. It's “on paper” (unrealised) until you sell." },
      { id: "realised", term: "Realised gain", short: "Profit (or loss) you've already locked in by selling units or receiving payouts." },
      { id: "xirr", term: "XIRR", short: "Your personal annual growth rate, accounting for the date and size of every investment and withdrawal.", long: "Ideal for SIPs: a ₹5,000 instalment from last month hasn't had time to grow, and XIRR knows that. Simple “total return %” doesn't. It's backward-looking — it tells you what happened, not what will." },
      { id: "absolute-return", term: "Absolute return", short: "Total gain as a % of cost, ignoring how long the money was invested." },
      { id: "sip", term: "SIP", short: "Systematic Investment Plan — investing a fixed amount automatically, usually every month." },
      { id: "expense-ratio", term: "Expense ratio (TER)", short: "The yearly fee a fund charges, as a % of your money. It's deducted daily from the NAV, so you never see a bill.", long: "TER = Total Expense Ratio. 1% sounds small, but over 20 years it compounds into a meaningful chunk of your wealth." },
      { id: "direct-vs-regular", term: "Direct vs Regular plan", short: "Every fund comes in two versions with the same portfolio. Regular plans pay a commission to the distributor from your money; direct plans don't, so they cost less.", long: "If someone helped you invest and you didn't pay them a fee directly, you're probably in regular plans. The commission is the price of that help — whether it's worth it is your call." },
      { id: "asset-allocation", term: "Asset allocation", short: "How your money is split between types of assets — equity (shares), debt (bonds), gold, etc." },
      { id: "asset-class", term: "Asset class", short: "A broad type of investment that behaves in a similar way: equity, debt, hybrid, gold, international." },
      { id: "equity", term: "Equity", short: "Owning shares of companies. Higher long-term growth potential, bigger short-term ups and downs." },
      { id: "debt", term: "Debt", short: "Lending money (bonds, deposits) in exchange for interest. Usually steadier than equity, with lower growth." },
      { id: "hybrid", term: "Hybrid", short: "A fund that mixes equity and debt in one portfolio." },
      { id: "category", term: "Category", short: "SEBI's label for what a fund invests in, e.g. Large Cap, Small Cap, Liquid. Funds in the same category often hold similar stocks." },
      { id: "large-cap", term: "Large cap", short: "India's 100 biggest listed companies by market value." },
      { id: "mid-cap", term: "Mid cap", short: "Companies ranked 101–250 by market value." },
      { id: "small-cap", term: "Small cap", short: "Companies ranked 251 and below. Can grow fast, and fall hard." },
      { id: "flexi-cap", term: "Flexi cap", short: "A fund free to invest in companies of any size." },
      { id: "elss", term: "ELSS", short: "Equity Linked Savings Scheme — an equity fund with a 3-year lock-in that qualified for tax deduction under section 80C (old tax regime)." },
      { id: "index-fund", term: "Index fund", short: "A fund that simply copies a market index like the Nifty 50. Usually very low cost." },
      { id: "amc", term: "AMC / Fund house", short: "Asset Management Company — the company that runs the fund, e.g. HDFC Mutual Fund." },
      { id: "folio", term: "Folio", short: "Your account number with a fund house. One folio can hold several schemes." },
      { id: "isin", term: "ISIN", short: "A unique 12-character code for each fund plan/option. We use it to look up NAVs and categories." },
      { id: "idcw", term: "IDCW / Growth", short: "Growth: profits stay invested. IDCW (formerly “dividend”): the fund pays out part of your own money periodically." },
      { id: "overlap", term: "Overlap", short: "How much two funds own the same companies. 50% overlap means half of each fund's money is in common stocks." },
      { id: "look-through", term: "Look-through exposure", short: "How much of a company you effectively own once you add it up across all your funds." },
      { id: "diversification", term: "Diversification", short: "Spreading money across different companies and asset types so one bad outcome hurts less." },
      { id: "concentration", term: "Concentration", short: "When a large share of your money depends on one fund, company or fund house." },
      { id: "redemption", term: "Redemption", short: "Selling units back to the fund to get money out." },
      { id: "stamp-duty", term: "Stamp duty", short: "A small government charge (0.005%) on mutual fund purchases since July 2020." },
      { id: "assumption", term: "Your assumption", short: "A growth rate YOU choose for a what-if calculation. It's not a prediction — markets don't move in straight lines." },
      { id: "compounding", term: "Compounding", short: "Growth on top of growth. It works for your returns — and against you for fees." },
      { id: "stcg", term: "STCG", short: "Short-term capital gain — profit on units sold before they count as long-term (12 months for equity funds, 24 for most others)." },
      { id: "ltcg", term: "LTCG", short: "Long-term capital gain — profit on units held longer than the threshold. Equity-fund LTCG up to ₹1.25 lakh a year is tax-free; above that, 12.5%." },
      { id: "fifo", term: "FIFO", short: "First in, first out: when you sell, the units you bought earliest are treated as sold first. That's how tax on fund units is worked out in India." },
      { id: "grandfathering", term: "Grandfathering", short: "For equity units bought on or before 31 Jan 2018, gains up to that date's value are protected from LTCG tax — the cost is stepped up to the 31-Jan-2018 NAV." },
      { id: "financial-year", term: "Financial year (FY)", short: "India's tax year: 1 April to 31 March. FY 2026-27 runs from 1 Apr 2026 to 31 Mar 2027." },
      { id: "benchmark", term: "Benchmark", short: "An index a fund compares itself to, e.g. Nifty 50 for large-cap funds." },
    ] satisfies Term[]
  ).map((t) => [t.id, t]),
);

export const term = (id: string): Term | undefined => GLOSSARY[id];
