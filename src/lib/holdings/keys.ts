import { familyName } from "../finance/categorize";

/**
 * Aggressive, punctuation-free key for matching the same scheme across AMC disclosures, AMFI's master and CAS
 * statements: "TATA ELSS - TAX SAVER FUND" / "Tata ELSS Tax Saver Fund - Direct Plan - Growth" → "tataelsstaxsaver".
 */
export function compactKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\((formerly|erstwhile|previously|earlier|known)[^)]*\)/g, " ")
    .replace(/\(an? [^)]*\)/g, " ")
    .replace(/&/g, "and")
    .replace(/\b(fund|scheme|the|mf|mutual|plan)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

/** Key for a CAS / AMFI scheme name, which carries plan & option suffixes. */
export function planNameKey(name: string): string {
  const fam = familyName(name);
  // familyName splits on " - "; names like "Tata ELSS - Tax Saver Fund - Direct" would lose words, so also
  // strip only the trailing plan/option segments.
  const trimmed = name
    .split(/\s+-\s+/)
    .filter((seg) => !/^(direct|regular|growth|idcw|dividend|payout|reinvest|bonus|plan|option|direct plan|regular plan|growth option|growth plan|idcw option)\b/i.test(seg.trim()))
    .join(" ");
  return compactKey(trimmed || fam);
}

const SUFFIX = /\s+(limited|ltd\.?|ltd|inc\.?|corp\.?|corporation|plc|co\.?)$/i;
/** "HDFC BANK LTD" → "HDFC Bank", "Alphabet Inc A" stays readable. */
export function displayStockName(raw: string): string {
  let n = raw.replace(/\s+/g, " ").replace(/\*+$/, "").trim();
  if (n === n.toUpperCase() && /[A-Z]{3,}/.test(n)) {
    n = n
      .toLowerCase()
      .replace(/\b([a-z])/g, (c) => c.toUpperCase())
      .replace(/\b(Hdfc|Icici|Sbi|Itc|Tcs|Ntpc|Ongc|Lic|Bse|Nse|Hcl|Dlf|Rec|Pfc|Bel|Hal|Irctc|Mrf|Abb|Lt|Gail|Bhel|Upl|Ipca|Kpit|Sjvn|Nhpc|Idfc|Au|Nbcc|Aia|Acc|Srf|Bpcl|Hpcl|Iocl|Ioc|Irfc|Rvnl|Cdsl|Mcx|Pnb|Idbi|Cpse)\b/g, (w) => w.toUpperCase());
  }
  for (let i = 0; i < 2; i++) n = n.replace(SUFFIX, "");
  return n.replace(/\s+\($/, "").trim();
}
