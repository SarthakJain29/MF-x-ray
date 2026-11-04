/** Goal tracking. Growth rates are user-chosen assumptions and always labelled as such in the UI. */
import type { Holding } from "./portfolio";

export interface Goal {
  id: string;
  name: string;
  emoji: string;
  target: number;
  /** ISO date */
  targetDate: string;
  /** Holding ids counted toward this goal; empty = whole portfolio */
  linked: string[];
  /** Share (0-100) of the linked value earmarked for this goal */
  sharePct: number;
  /** User's own growth assumption, % per year */
  assumedPct: number;
}

export interface GoalProgress {
  current: number;
  progress: number;
  monthsLeft: number;
  /** Value of current money at the target date IF it grew at the user's assumption */
  projectedAtAssumption: number;
  /** Monthly investment needed to close the gap at the user's assumption */
  monthlyNeeded: number;
  onTrackAtAssumption: boolean;
}

export function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00Z");
  const b = new Date(toIso + "T00:00:00Z");
  return Math.max(0, (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()));
}

/** Monthly SIP needed to accumulate `gap` in `months` at annual rate `pct`. */
export function sipNeeded(gap: number, months: number, pct: number): number {
  if (gap <= 0) return 0;
  if (months <= 0) return gap;
  const i = Math.pow(1 + pct / 100, 1 / 12) - 1;
  if (i === 0) return gap / months;
  // Annuity-due (SIP at the start of each month)
  return (gap * i) / ((Math.pow(1 + i, months) - 1) * (1 + i));
}

export function goalProgress(goal: Goal, holdings: Holding[], todayIso: string): GoalProgress {
  const pool = goal.linked.length ? holdings.filter((h) => goal.linked.includes(h.id)) : holdings;
  const current = (pool.reduce((s, h) => s + h.value, 0) * goal.sharePct) / 100;
  const monthsLeft = monthsBetween(todayIso, goal.targetDate);
  const projected = current * Math.pow(1 + goal.assumedPct / 100, monthsLeft / 12);
  const gap = goal.target - projected;
  return {
    current,
    progress: goal.target > 0 ? Math.min(1, current / goal.target) : 0,
    monthsLeft,
    projectedAtAssumption: projected,
    monthlyNeeded: sipNeeded(gap, monthsLeft, goal.assumedPct),
    onTrackAtAssumption: gap <= 0,
  };
}
