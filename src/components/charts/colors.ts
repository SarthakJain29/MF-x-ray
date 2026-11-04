/** Categorical slots, in validated order. Colours follow the entity (fixed map), never its rank. */
export const SLOTS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)", "var(--s7)", "var(--s8)"];

export const ASSET_COLORS: Record<string, string> = {
  Equity: "var(--s1)",
  Debt: "var(--s2)",
  Hybrid: "var(--s3)",
  "Gold & Silver": "var(--s4)",
  International: "var(--s5)",
  Other: "var(--ink-3)",
};

/** Stable colour per key: assign slots by alphabetical order of the full key set, so filtering doesn't repaint. */
export function colorMap(keys: string[]): Record<string, string> {
  const sorted = [...new Set(keys)].sort();
  return Object.fromEntries(sorted.map((k, i) => [k, k === "Other" ? "var(--ink-3)" : SLOTS[i % SLOTS.length]]));
}
