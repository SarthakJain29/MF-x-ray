/**
 * FIFO lot engine shared by portfolio analytics and the capital-gains estimate.
 * Every unit knows when it was bought and what it cost, so holding periods and grandfathering are possible.
 */
import type { Transaction } from "../cas/types";

export interface Lot {
  units: number;
  cost: number;
  /** Acquisition date; null for units already held when the statement starts (history unknown). */
  date: string | null;
}

export interface LotSlice {
  acquired: string | null;
  units: number;
  cost: number;
}

export interface Disposal {
  date: string;
  units: number;
  /** Cash value received (a switch-out counts as a sale at the switch value). */
  proceeds: number;
  cost: number;
  kind: "redemption" | "switch-out";
  slices: LotSlice[];
}

export interface MergerOut {
  date: string;
  units: number;
  slices: LotSlice[];
}

export interface FifoResult {
  lots: Lot[];
  disposals: Disposal[];
  mergerOuts: MergerOut[];
  /** Cost of units still held */
  cost: number;
  /** Cash-basis realised gain (matches the dashboard; STT/TDS reduce it) */
  realised: number;
  invested: number;
  withdrawn: number;
}

export interface FifoOptions {
  /** Provide carried-over lots for a MERGER_IN row (cost basis and dates survive a merger). */
  mergerIn?: (t: Transaction, index: number) => LotSlice[] | null;
}

const EPS = 1e-9;

export function runFifo(txns: Transaction[], openUnits: number, opts: FifoOptions = {}): FifoResult {
  const lots: Lot[] = openUnits > 0 ? [{ units: openUnits, cost: 0, date: null }] : [];
  const disposals: Disposal[] = [];
  const mergerOuts: MergerOut[] = [];
  let realised = 0;
  let invested = 0;
  let withdrawn = 0;

  const consume = (units: number): { slices: LotSlice[]; cost: number } => {
    let toSell = units;
    let cost = 0;
    const slices: LotSlice[] = [];
    while (toSell > EPS && lots.length) {
      const lot = lots[0];
      const take = Math.min(lot.units, toSell);
      const c = lot.units > 0 ? (lot.cost * take) / lot.units : 0;
      slices.push({ acquired: lot.date, units: take, cost: c });
      cost += c;
      lot.units -= take;
      lot.cost -= c;
      toSell -= take;
      if (lot.units <= EPS) lots.shift();
    }
    return { slices, cost };
  };

  txns.forEach((t, index) => {
    const units = t.units ?? 0;
    const amt = Math.abs(t.amount ?? 0);
    switch (t.type) {
      case "STAMP_DUTY_TAX":
        invested += amt;
        if (lots.length) lots[lots.length - 1].cost += amt; // part of the cost of the units just bought
        return;
      case "STT_TAX":
      case "TDS_TAX":
        withdrawn -= amt;
        realised -= amt;
        return;
      case "DIVIDEND_PAYOUT":
        withdrawn += amt;
        realised += amt;
        return;
      default:
    }

    if (units > 0) {
      if (t.type === "MERGER_IN") {
        const carried = opts.mergerIn?.(t, index);
        if (carried?.length) for (const s of carried) lots.push({ units: s.units, cost: s.cost, date: s.acquired });
        else lots.push({ units, cost: amt, date: t.date }); // no matching merger-out in this statement
        return;
      }
      const isCash = t.type === "PURCHASE" || t.type === "PURCHASE_SIP" || t.type === "SWITCH_IN";
      if (isCash) invested += amt;
      const free = t.type === "SEGREGATION" || t.type === "BONUS" || t.amount == null;
      lots.push({ units, cost: free ? 0 : amt, date: t.date });
      return;
    }
    if (units < 0) {
      const { slices, cost } = consume(-units);
      if (t.type === "MERGER_OUT") {
        mergerOuts.push({ date: t.date, units: -units, slices });
      } else if (t.type === "REVERSAL") {
        invested -= amt;
      } else {
        withdrawn += amt;
        realised += amt - cost;
        disposals.push({ date: t.date, units: -units, proceeds: amt, cost, kind: t.type === "SWITCH_OUT" ? "switch-out" : "redemption", slices });
      }
    }
  });

  return {
    lots,
    disposals,
    mergerOuts,
    cost: lots.reduce((s, l) => s + l.cost, 0),
    realised,
    invested,
    withdrawn,
  };
}

/**
 * Split the units/cost that left a folio in a merger among the schemes that received them.
 * Cost basis and acquisition dates carry over; units are re-based to the new scheme's unit count.
 */
export function allocateMerger(pool: MergerOut[], incoming: { units: number; amount: number }[], idx: number): LotSlice[] | null {
  if (!pool.length || !incoming.length) return null;
  const slices = pool.flatMap((m) => m.slices).sort((a, b) => (a.acquired ?? "").localeCompare(b.acquired ?? ""));
  const poolUnits = slices.reduce((s, x) => s + x.units, 0);
  if (poolUnits <= 0) return null;
  const totalAmt = incoming.reduce((s, x) => s + x.amount, 0);
  const totalUnits = incoming.reduce((s, x) => s + x.units, 0);
  const share = totalAmt > 0 ? incoming[idx].amount / totalAmt : incoming[idx].units / (totalUnits || 1);
  return slices.map((s) => ({ acquired: s.acquired, units: incoming[idx].units * (s.units / poolUnits), cost: s.cost * share }));
}
