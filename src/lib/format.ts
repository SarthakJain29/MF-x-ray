const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrFmt2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const inr = (n: number | null | undefined, decimals = false) =>
  n == null || !Number.isFinite(n) ? "—" : (decimals ? inrFmt2 : inrFmt).format(n);

/** ₹12.4 L / ₹1.23 Cr / ₹45.2 K */
export function inrShort(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e7) return `${sign}₹${trim(a / 1e7, 2)} Cr`;
  if (a >= 1e5) return `${sign}₹${trim(a / 1e5, 2)} L`;
  if (a >= 1e3) return `${sign}₹${trim(a / 1e3, 1)} K`;
  return `${sign}₹${Math.round(a)}`;
}
const trim = (n: number, d: number) => n.toFixed(d).replace(/\.?0+$/, "");

export const pct = (n: number | null | undefined, d = 1) => (n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(d)}%`);
export const signedPct = (n: number | null | undefined, d = 1) =>
  n == null || !Number.isFinite(n) ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(d)}%`;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${+d} ${MON[+m - 1]} ${y}`;
}
export function fmtMonth(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MON[+m - 1]} '${y.slice(2)}`;
}
export const todayIso = () => new Date().toISOString().slice(0, 10);

/** "2026-09" → "Sep 2026" */
export function fmtYearMonth(ym: string | null | undefined): string {
  if (!ym || !/^\d{4}-\d{2}/.test(ym)) return ym ?? "—";
  return `${MON[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
}
