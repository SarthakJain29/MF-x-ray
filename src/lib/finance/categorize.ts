export type AssetClass = "Equity" | "Debt" | "Hybrid" | "Gold & Silver" | "International" | "Other";

export const ASSET_CLASSES: AssetClass[] = ["Equity", "Debt", "Hybrid", "Gold & Silver", "International", "Other"];

/** Turn an AMFI category string ("Equity Scheme - Large Cap Fund") plus the scheme name into a friendly category. */
export function friendlyCategory(amfiCategory: string | null | undefined, schemeName: string): string {
  if (amfiCategory) {
    const part = amfiCategory.split(" - ").slice(1).join(" - ").trim() || amfiCategory;
    const p = part
      .replace(/ELSS-?\s*Tax Saver Fund|^ELSS$/i, "ELSS (Tax Saver)")
      .replace(/Balanced Advantage Fund\/ Dynamic Asset Allocation|Dynamic Asset Allocation or Balanced Advantage/i, "Balanced Advantage")
      .replace(/Banking and PSU( Debt)? Fund/i, "Banking & PSU Debt")
      .replace(/Sectoral\/ Thematic/i, "Sectoral / Thematic")
      .replace(/^(Equity|Debt|Hybrid) Funds$/i, "Index Fund ($1)")
      .replace(/\s+Fund$/i, "")
      .trim();
    if (/index funds/i.test(amfiCategory) && /^Index Fund/i.test(p) === false && /Other Scheme/i.test(amfiCategory)) return "Index Fund";
    return p || inferCategoryFromName(schemeName);
  }
  return inferCategoryFromName(schemeName);
}

const NAME_RULES: [RegExp, string][] = [
  [/\b(elss|tax ?saver|long term equity|tax relief)\b/i, "ELSS (Tax Saver)"],
  [/\bliquid\b/i, "Liquid"],
  [/\bovernight\b/i, "Overnight"],
  [/\bmoney market\b/i, "Money Market"],
  [/\bultra short\b/i, "Ultra Short Duration"],
  [/\bshort (term|duration)\b/i, "Short Duration"],
  [/\bcorporate bond\b/i, "Corporate Bond"],
  [/\bbanking (and|&) psu\b/i, "Banking & PSU Debt"],
  [/\bgilt\b/i, "Gilt"],
  [/\bdynamic bond\b/i, "Dynamic Bond"],
  [/\bcredit risk\b/i, "Credit Risk"],
  [/\barbitrage\b/i, "Arbitrage"],
  [/\b(balanced advantage|dynamic asset)\b/i, "Balanced Advantage"],
  [/\b(aggressive hybrid|equity (&|and) debt|hybrid equity)\b/i, "Aggressive Hybrid"],
  [/\bmulti asset\b/i, "Multi Asset Allocation"],
  [/\bequity savings\b/i, "Equity Savings"],
  [/\bsmall ?cap\b/i, "Small Cap"],
  [/\bmid ?cap\b/i, "Mid Cap"],
  [/\blarge (&|and) mid ?cap\b/i, "Large & Mid Cap"],
  [/\b(large ?cap|bluechip|blue chip|top 100)\b/i, "Large Cap"],
  [/\bflexi ?cap\b/i, "Flexi Cap"],
  [/\bmulti ?cap\b/i, "Multi Cap"],
  [/\bfocused\b/i, "Focused"],
  [/\bvalue\b/i, "Value"],
  [/\bcontra\b/i, "Contra"],
  [/\bgold\b/i, "Gold"],
  [/\bsilver\b/i, "Silver"],
  [/\b(nasdaq|s&p 500|us |global|international|overseas|world)\b/i, "International"],
  [/\b(index|nifty|sensex|etf)\b/i, "Index Fund"],
  [/\b(bond|debt|income|duration|treasury)\b/i, "Debt"],
];

export function inferCategoryFromName(name: string): string {
  for (const [re, cat] of NAME_RULES) if (re.test(name)) return cat;
  return "Other";
}

const DEBT_CATS = /liquid|overnight|money market|duration|corporate bond|banking & psu|gilt|dynamic bond|credit risk|floater|floating|debt|income|treasury|fixed term|constant maturity|medium|long term fund|short term/i;
const HYBRID_CATS = /hybrid|arbitrage|balanced|multi asset|equity savings|retirement|children/i;

export function assetClassFor(amfiCategory: string | null | undefined, category: string, schemeName: string): AssetClass {
  const all = `${amfiCategory ?? ""} | ${category}`;
  const n = schemeName;
  if (/gold|silver/i.test(category) || /\b(gold|silver)\b/i.test(n)) return "Gold & Silver";
  if (/overseas|investing overseas|international/i.test(all) || /\b(nasdaq|s&p 500|global|international|overseas|world|us equity|china|japan|taiwan)\b/i.test(n))
    return "International";
  if (/index funds - debt|debt etf/i.test(all)) return "Debt";
  if (/index funds - hybrid|hybrid etf/i.test(all)) return "Hybrid";
  if (/^(Debt Scheme|Income\/Debt)/i.test(amfiCategory ?? "")) return "Debt";
  if (/^(Hybrid)/i.test(amfiCategory ?? "")) return "Hybrid";
  if (/^(Equity|Growth\/Equity)/i.test(amfiCategory ?? "") || /ELSS/i.test(all)) return "Equity";
  if (/index fund|etf|fof|fund of funds/i.test(all)) {
    if (/\b(gilt|sdl|g-?sec|bond|crisil|psu|debt|t-?bill|target maturity|liquid)\b/i.test(n)) return "Debt";
    if (/\b(nifty|sensex|bse|equity|midcap|smallcap|momentum|quality|alpha|value|low vol)\b/i.test(n)) return "Equity";
    return "Other";
  }
  if (HYBRID_CATS.test(category)) return "Hybrid";
  if (DEBT_CATS.test(category)) return "Debt";
  if (/cap|elss|focused|value|contra|dividend|sector|thematic|index/i.test(category)) return "Equity";
  return "Other";
}

export function planOf(name: string, advisor: string | null): "Direct" | "Regular" {
  if (/\bdirect\b/i.test(name)) return "Direct";
  if (/\bregular\b/i.test(name)) return "Regular";
  if (advisor && /^(INA|DIRECT|INZ)/i.test(advisor.trim())) return "Direct";
  return "Regular";
}

export function optionOf(name: string): "Growth" | "IDCW" {
  return /\b(idcw|dividend|payout|reinvest)/i.test(name) ? "IDCW" : "Growth";
}

/** "HDFC Flexi Cap Fund - Regular Plan - Growth Option" -> "HDFC Flexi Cap Fund" */
export function familyName(name: string): string {
  return name
    .replace(/\(formerly[^)]*\)/gi, "")
    .replace(/\((erstwhile|earlier)[^)]*\)/gi, "")
    .split(/\s+-\s+|\s+–\s+/)[0]
    .replace(/\s+(direct|regular)\s+(plan\s+)?(growth|idcw).*$/i, "")
    .replace(/\s+(direct|regular)(\s+plan)?$/i, "")
    .replace(/\s+(growth|idcw)( option)?$/i, "")
    .replace(/-\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalised key for matching the same scheme across data sources. */
export function schemeKey(name: string): string {
  return familyName(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bfund\b|\bscheme\b|\bplan\b|\bthe\b/g, " ")
    .replace(/\bmf\b|\bmutual\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
