"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { WithPortfolio } from "@/components/Guard";
import { buildAiContext, scrubText } from "@/lib/ai/anonymize";
import { localAnswer, SUGGESTED_QUESTIONS } from "@/lib/ai/localAnswer";
import { useStore } from "@/store/store";
import type { PortfolioState } from "@/lib/usePortfolio";

export default function AskPage() {
  return <WithPortfolio>{(s) => <AskInner s={s} />}</WithPortfolio>;
}

/** Minimal, safe markdown: **bold** and line breaks only. */
function Rich({ text }: { text: string }) {
  return (
    <div className="prose-chat">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>
          {para.split("\n").map((line, j) => (
            <span key={j} className="block">
              {line.split(/(\*\*[^*]+\*\*)/).map((seg, k) => (seg.startsWith("**") ? <strong key={k}>{seg.slice(2, -2)}</strong> : <span key={k}>{seg.replace(/^[-*] /, "• ")}</span>))}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

function AskInner({ s }: { s: PortfolioState & { portfolio: NonNullable<PortfolioState["portfolio"]> } }) {
  const ctx = useMemo(() => buildAiContext(s.portfolio, s.overlap), [s.portfolio, s.overlap]);
  const chat = useStore((st) => st.chat);
  const push = useStore((st) => st.pushChat);
  const clear = useStore((st) => st.clearChat);
  const investor = useStore((st) => st.cas?.investor);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"ai" | "local" | null>(null);
  const [showData, setShowData] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((j) => setMode(j.mode === "ai" ? "ai" : "local"))
      .catch(() => setMode("local"));
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.length, busy]);

  async function ask(question: string) {
    const clean = scrubText(question, [investor?.name, investor?.email, investor?.mobile]);
    if (!clean.trim() || busy) return;
    setQ("");
    push({ role: "user", content: clean });
    setBusy(true);
    let answer: string | null = null;
    let m: "ai" | "local" = "local";
    if (mode === "ai") {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: clean, context: ctx, history: chat.slice(-6).map(({ role, content }) => ({ role, content })) }),
        });
        if (res.ok) {
          answer = (await res.json()).answer;
          m = "ai";
        }
      } catch {
        /* fall through to local */
      }
    }
    if (!answer) answer = localAnswer(clean, ctx);
    push({ role: "assistant", content: answer, mode: m });
    setBusy(false);
  }

  return (
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Ask</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Ask about your portfolio</h1>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === "ai" ? "bg-brand-soft text-brand" : "bg-surface-2 text-ink-2"}`}>
          {mode === null ? "…" : mode === "ai" ? "AI mode · anonymised" : "Offline mode · on-device answers"}
        </span>
      </header>

      <button onClick={() => setShowData((v) => !v)} className="mt-3 self-start text-xs font-semibold text-brand underline underline-offset-2">
        {showData ? "Hide" : "See"} exactly what {mode === "ai" ? "is sent to the AI" : "the assistant reads"}
      </button>
      {showData && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-2xl bg-film p-3 text-[11px] leading-relaxed text-[#c8f53a]">{JSON.stringify(ctx, null, 2)}</pre>
      )}

      <div className="mt-4 flex-1 space-y-3" aria-live="polite">
        {chat.length === 0 && (
          <div className="card p-5">
            <p className="text-sm text-ink-2">
              Answers come from your parsed statement. No PAN, name, email or folio numbers are ever sent. The assistant explains facts; it won&apos;t tell you what to buy or sell, or
              predict returns.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((sq) => (
                <button key={sq} onClick={() => ask(sq)} className="rounded-full border border-line bg-surface-2 px-3 py-2 text-left text-sm hover:border-brand">
                  {sq}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.map((t, i) => (
          <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-3xl px-4 py-3 text-[15px] leading-relaxed ${t.role === "user" ? "rounded-br-md bg-ink text-bg" : "rounded-bl-md border border-line bg-surface"}`}>
              <Rich text={t.content} />
              {t.role === "assistant" && <div className="mt-2 text-[10px] uppercase tracking-wide text-ink-3">{t.mode === "ai" ? "AI · educational, not advice" : "Computed on-device · educational, not advice"}</div>}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-3xl rounded-bl-md border border-line bg-surface px-4 py-3">
              <span className="inline-flex gap-1"><span className="h-2 w-2 animate-bounce rounded-full bg-ink-3" /><span className="h-2 w-2 animate-bounce rounded-full bg-ink-3 [animation-delay:120ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-ink-3 [animation-delay:240ms]" /></span>
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="sticky bottom-[4.75rem] mt-4 flex gap-2 rounded-full border border-line bg-surface p-1.5 shadow-xl shadow-black/10 lg:bottom-4"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Which fund costs me the most?" className="min-w-0 flex-1 bg-transparent px-4 text-[15px] outline-none" aria-label="Your question" maxLength={500} />
        <button type="submit" disabled={!q.trim() || busy} className="rounded-full bg-brand px-5 py-2.5 font-display font-bold text-on-brand disabled:opacity-40">Ask</button>
      </form>
      {chat.length > 0 && (
        <button onClick={clear} className="mt-2 self-center text-xs text-ink-3 hover:text-ink">Clear conversation</button>
      )}
    </div>
  );
}
