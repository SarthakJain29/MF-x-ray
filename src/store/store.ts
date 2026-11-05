"use client";
/**
 * App state. The parsed CAS lives in memory only, unless the user turns on "Remember on this device",
 * in which case it's saved to this browser's localStorage (never to a server).
 */
import { create } from "zustand";
import type { CASData } from "@/lib/cas/types";
import type { DiagnosticLines } from "@/lib/cas/diagnostic";
import type { Goal } from "@/lib/finance/goals";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  mode?: "ai" | "local";
}

interface State {
  hydrated: boolean;
  cas: CASData | null;
  /** Redacted statement layout for the optional "didn't parse right?" report. Memory only — never persisted. */
  diagnostic: DiagnosticLines | null;
  isSample: boolean;
  remember: boolean;
  goals: Goal[];
  costAssumption: number;
  chat: ChatTurn[];
  setCas: (cas: CASData, isSample: boolean, diagnostic?: DiagnosticLines | null) => void;
  setDiagnostic: (d: DiagnosticLines | null) => void;
  setRemember: (v: boolean) => void;
  upsertGoal: (g: Goal) => void;
  removeGoal: (id: string) => void;
  setCostAssumption: (v: number) => void;
  pushChat: (t: ChatTurn) => void;
  clearChat: () => void;
  wipe: () => void;
}

const KEY = "mfxray:v1";

type Persisted = Pick<State, "cas" | "isSample" | "goals" | "costAssumption" | "remember">;

function save(s: State) {
  try {
    if (!s.remember) {
      localStorage.removeItem(KEY);
      return;
    }
    const data: Persisted = { cas: s.cas, isSample: s.isSample, goals: s.goals, costAssumption: s.costAssumption, remember: true };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable (private mode etc.) — app still works in memory */
  }
}

export const useStore = create<State>((set, get) => ({
  hydrated: false,
  cas: null,
  diagnostic: null,
  isSample: false,
  remember: false,
  goals: [],
  costAssumption: 10,
  chat: [],
  setCas: (cas, isSample, diagnostic = null) => {
    set({ cas, isSample, diagnostic, chat: [] });
    save(get());
  },
  setDiagnostic: (diagnostic) => set({ diagnostic }),
  setRemember: (v) => {
    set({ remember: v });
    save(get());
  },
  upsertGoal: (g) => {
    const goals = get().goals.some((x) => x.id === g.id) ? get().goals.map((x) => (x.id === g.id ? g : x)) : [...get().goals, g];
    set({ goals });
    save(get());
  },
  removeGoal: (id) => {
    set({ goals: get().goals.filter((g) => g.id !== id) });
    save(get());
  },
  setCostAssumption: (v) => {
    set({ costAssumption: v });
    save(get());
  },
  pushChat: (t) => set({ chat: [...get().chat, t] }),
  clearChat: () => set({ chat: [] }),
  wipe: () => {
    try {
      localStorage.removeItem(KEY);
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    set({ cas: null, diagnostic: null, isSample: false, remember: false, goals: [], chat: [], costAssumption: 10 });
  },
}));

export function hydrateStore() {
  if (useStore.getState().hydrated) return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      useStore.setState({ ...p, remember: true, hydrated: true });
      return;
    }
  } catch {
    /* ignore corrupt storage */
  }
  useStore.setState({ hydrated: true });
}
