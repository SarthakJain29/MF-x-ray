"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import { scrubText } from "@/lib/ai/anonymize";
import { buildReport, looksLeaky } from "@/lib/cas/diagnostic";
import { useStore } from "@/store/store";

const REPO = "https://github.com/SarthakJain29/MF-x-ray";

export default function ReportPage() {
  const diagnostic = useStore((s) => s.diagnostic);
  const cas = useStore((s) => s.cas);
  const [includeNames, setIncludeNames] = useState(false);
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState<{ base: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const generated = useMemo(
    () => (diagnostic ? buildReport(diagnostic, cas, { includeFundNames: includeNames, note: scrubText(note).slice(0, 500), appVersion: "v1" }) : ""),
    [diagnostic, cas, includeNames, note],
  );
  const text = edit && edit.base === generated ? edit.text : generated;
  const leak = text ? looksLeaky(text) : null;

  if (!diagnostic) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Statement didn&apos;t parse right?</h1>
        <div className="card p-6">
          <p className="text-ink-2">
            The report is built from the statement you just opened, on this device, and isn&apos;t kept after you close the tab. Upload the statement again, then come back here.
          </p>
          <Link href="/" className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 font-display font-bold text-bg">Upload a statement</Link>
        </div>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.getElementById("report-text") as HTMLTextAreaElement | null;
      ta?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "mfxray-diagnostic.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const issueUrl = `${REPO}/issues/new?title=${encodeURIComponent("Statement parse problem")}&body=${encodeURIComponent(
    "**What looked wrong?**\n\n\n**Anonymised report** (paste from MF X-ray › Statement didn't parse right? › Copy report):\n\n```\n\n```\n",
  )}`;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Help us fix it</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Statement didn&apos;t parse right?</h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          Statement layouts vary. This builds a report of your statement&apos;s <em>layout</em> — with everything personal removed — that you can choose to share so the parser can be
          fixed. <strong>Nothing is sent automatically.</strong>
        </p>
      </header>

      <section className="card p-4 sm:p-6">
        <h2 className="font-display text-lg font-bold">What&apos;s removed before you see it</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["Your name, address, e-mail and phone", "whole lines replaced"],
            ["PAN and folio numbers", "removed (folio keeps its shape, e.g. 9999999)"],
            ["Every amount, unit and NAV", "all digits become 9, so only the format survives"],
            ["Every date", "shown as 99-Mmm-9999"],
            ["Nominee names", "removed"],
            ["Fund names", "masked unless you choose to include them"],
          ].map(([a, b]) => (
            <li key={a} className="flex gap-2">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-good-soft text-xs font-bold text-pos" aria-hidden>✓</span>
              <span><strong className="font-semibold">{a}</strong> <span className="text-ink-3">— {b}</span></span>
            </li>
          ))}
        </ul>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface-2 p-3 text-sm">
            <input type="checkbox" checked={includeNames} onChange={(e) => setIncludeNames(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--brand)]" />
            <span>
              <strong>Include fund names</strong>
              <span className="block text-xs text-ink-3">Helps pinpoint the problem. Fund names are public, but they do show what you hold.</span>
            </span>
          </label>
          <label className="block rounded-2xl bg-surface-2 p-3 text-sm">
            <strong>What looked wrong? (optional)</strong>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="e.g. my SWP shows as a purchase" className="mt-1 w-full resize-none rounded-lg border border-line bg-surface p-2 text-sm outline-none focus:border-brand" />
          </label>
        </div>
      </section>

      <section className="card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Your report</h2>
          <span className="text-xs text-ink-3">Review it — you can edit the text before sharing</span>
        </div>
        {leak && (
          <p role="alert" className="mt-3 rounded-xl bg-watch-soft px-3 py-2 text-sm text-watch">
            This text still contains something that looks like an identifier ({leak}). Please edit it out before sharing.
          </p>
        )}
        <textarea
          id="report-text"
          value={text}
          onChange={(e) => setEdit({ base: generated, text: e.target.value })}
          spellCheck={false}
          rows={16}
          className="mt-3 w-full rounded-2xl border border-line bg-film p-3 font-mono text-[11px] leading-relaxed text-[#c8f53a] outline-none focus:border-brand"
          aria-label="Anonymised diagnostic report"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={copy} className="rounded-full bg-ink px-5 py-2.5 font-display font-bold text-bg">{copied ? "Copied ✓" : "Copy report"}</button>
          <button onClick={download} className="rounded-full border border-line px-5 py-2.5 font-semibold">Download .txt</button>
          <a href={issueUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-5 py-2.5 font-semibold">Open a GitHub issue ↗</a>
        </div>
        <p className="mt-3 text-xs text-ink-3">
          “Open a GitHub issue” opens a blank, pre-titled issue in a new tab; paste the report in yourself. Issues on GitHub are public, so check the text first.
        </p>
      </section>
      <Disclaimer className="px-1" />
    </div>
  );
}
