"use client";
/** A term with a tap/hover explainer. Every piece of jargon in the app is wrapped in one. */
import { useEffect, useId, useRef, useState } from "react";
import { GLOSSARY } from "@/lib/glossary";

export function Term({ id, children, className = "" }: { id: string; children?: React.ReactNode; className?: string }) {
  const t = GLOSSARY[id];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!btn.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  if (!t) return <>{children}</>;
  const toggle = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) {
      const w = Math.min(300, window.innerWidth - 32);
      const left = Math.max(16, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 16));
      const above = r.bottom + 180 > window.innerHeight;
      setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above });
    }
    setOpen((o) => !o);
  };
  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={popId}
        className={`cursor-help underline decoration-dotted decoration-[1.5px] underline-offset-[3px] decoration-ink-3 hover:decoration-brand ${className}`}
      >
        {children ?? t.term}
      </button>
      {open && pos && (
        <div
          ref={pop}
          id={popId}
          role="dialog"
          aria-label={t.term}
          className="fixed z-[60] w-[min(300px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-4 text-left text-sm font-normal normal-case tracking-normal text-ink shadow-2xl shadow-black/20"
          style={{ left: pos.left, top: pos.top, transform: pos.above ? "translateY(-100%)" : undefined }}
        >
          <div className="mb-1 font-display text-base font-bold">{t.term}</div>
          <p className="leading-relaxed text-ink-2">{t.short}</p>
          {t.long && <p className="mt-2 leading-relaxed text-ink-3">{t.long}</p>}
        </div>
      )}
    </>
  );
}
