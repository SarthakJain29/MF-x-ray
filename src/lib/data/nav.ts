/** NAV data from mfapi.in (free, CORS-enabled). Only public AMFI scheme codes are sent — never personal data. */
import type { NavSeries } from "../finance/costs";

const BASE = "https://api.mfapi.in/mf";
const mem = new Map<number, Promise<NavSeries | null>>();

function toIso(d: string) {
  const [dd, mm, yyyy] = d.split("-");
  return `${yyyy}-${mm}-${dd}`;
}

export function navHistory(code: number): Promise<NavSeries | null> {
  let p = mem.get(code);
  if (!p) {
    const get = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
    // Direct first (CORS-enabled); fall back to our stateless same-origin proxy.
    p = get(`${BASE}/${code}`)
      .catch(() => get(`/api/nav/${code}`))
      .then((j: { data?: { date: string; nav: string }[] }) => {
        const rows = (j.data ?? [])
          .map((d) => ({ date: toIso(d.date), nav: parseFloat(d.nav) }))
          .filter((r) => r.nav > 0)
          .sort((a, b) => a.date.localeCompare(b.date));
        if (!rows.length) return null;
        return { dates: rows.map((r) => r.date), navs: rows.map((r) => r.nav) };
      })
      .catch(() => null);
    mem.set(code, p);
  }
  return p;
}

export async function navHistories(codes: number[]): Promise<Record<number, NavSeries>> {
  const out: Record<number, NavSeries> = {};
  const uniq = [...new Set(codes)];
  // small concurrency to be polite to the free API
  let i = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (i < uniq.length) {
        const c = uniq[i++];
        const s = await navHistory(c);
        if (s) out[c] = s;
      }
    }),
  );
  return out;
}
