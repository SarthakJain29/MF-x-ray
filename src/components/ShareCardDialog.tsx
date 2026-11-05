"use client";
import { useEffect, useRef, useState } from "react";
import { drawShareCard, shareCardData } from "@/lib/shareCard";
import type { Portfolio } from "@/lib/finance/portfolio";
import type { OverlapReport } from "@/lib/overlap";

function fonts() {
  const cs = getComputedStyle(document.body);
  const fam = (v: string) => cs.getPropertyValue(v).trim() || "system-ui, sans-serif";
  return { display: fam("--font-display"), body: fam("--font-body") };
}

export function ShareCardButton({ p, overlap }: { p: Portfolio; overlap: OverlapReport | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-3 font-display font-bold">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
        Share my X-ray card
      </button>
      {open && <ShareDialog p={p} overlap={overlap} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareDialog({ p, overlap, onClose }: { p: Portfolio; overlap: OverlapReport | null; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const [showXirr, setShowXirr] = useState(true);
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      drawShareCard(ctx, shareCardData(p, overlap, { showAmounts, showXirr }), fonts());
      setUrl(c.toDataURL("image/png"));
    });
    return () => {
      alive = false;
    };
  }, [p, overlap, showAmounts, showXirr]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  async function share() {
    const c = canvas.current;
    if (!c) return;
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/png"));
    if (!blob) return;
    const file = new File([blob], "my-mf-xray.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "My portfolio X-ray" });
        return;
      } catch {
        /* cancelled */
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-mf-xray.png";
    a.click();
    setMsg("Saved as my-mf-xray.png");
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Share your X-ray card" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Your X-ray card</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-line" aria-label="Close">✕</button>
        </div>
        <p className="mt-1 text-sm text-ink-2">Percentages only by default. No name, PAN, folio or e-mail — ever. The image is made on your device.</p>
        <canvas ref={canvas} width={1080} height={1350} className="hidden" />
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-film">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="Preview of your shareable portfolio X-ray card" className="w-full" /> : <div className="scan aspect-[4/5]" />}
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
            <span>Show portfolio value <span className="block text-xs text-ink-3">Off by default — adds your ₹ amount to the card</span></span>
            <input type="checkbox" checked={showAmounts} onChange={(e) => setShowAmounts(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
            <span>Show XIRR</span>
            <input type="checkbox" checked={showXirr} onChange={(e) => setShowXirr(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />
          </label>
        </div>
        <button onClick={share} className="mt-4 w-full rounded-full bg-lime px-5 py-3.5 font-display font-bold text-[#121019]">Share or save image</button>
        {msg && <p className="mt-2 text-center text-xs text-ink-3" role="status">{msg}</p>}
      </div>
    </div>
  );
}
