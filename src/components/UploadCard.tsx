"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CASParseError } from "@/lib/cas/types";
import { useStore } from "@/store/store";

type Phase = "idle" | "reading" | "password" | "parsing" | "error";

export const SAMPLE_PASSWORD = "mfxray";

export function UploadCard() {
  const router = useRouter();
  const setCas = useStore((s) => s.setCas);
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [buf, setBuf] = useState<ArrayBuffer | null>(null);
  const [drag, setDrag] = useState(false);

  async function attempt(data: ArrayBuffer, pw?: string, sample = false) {
    setPhase("parsing");
    setError(null);
    try {
      const { parseCASFile } = await import("@/lib/cas/browser");
      const cas = await parseCASFile(data, pw);
      setCas(cas, sample);
      router.push("/app");
    } catch (e) {
      const err = e as CASParseError;
      if (err.code === "PASSWORD_REQUIRED") {
        setPhase("password");
      } else if (err.code === "INCORRECT_PASSWORD") {
        setPhase("password");
        setError("That password didn't open the file. It's the one you chose when requesting the CAS (often your PAN in capitals, or PAN + date of birth).");
      } else {
        setPhase("error");
        setError(err.message || "Something went wrong reading this file.");
      }
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.type && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setPhase("error");
      setError("Please choose your CAS PDF file.");
      return;
    }
    setFileName(f.name);
    setPhase("reading");
    const data = await f.arrayBuffer();
    setBuf(data);
    setPassword("");
    await attempt(data);
  }

  async function sample() {
    setFileName("sample-cas.pdf (synthetic)");
    setPhase("reading");
    try {
      const res = await fetch("/sample/sample-cas.pdf");
      const data = await res.arrayBuffer();
      setBuf(data);
      await attempt(data, SAMPLE_PASSWORD, true);
    } catch {
      setPhase("error");
      setError("Couldn't load the sample file.");
    }
  }

  const busy = phase === "reading" || phase === "parsing";

  return (
    <div className="card relative overflow-hidden p-5 sm:p-7 shadow-[0_30px_80px_-40px_rgba(18,16,25,0.45)]">
      {phase !== "password" ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              onFile(e.dataTransfer.files?.[0]);
            }}
            className={`group relative flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
              drag ? "border-brand bg-brand-soft" : "border-line bg-surface-2/60 hover:border-brand"
            } ${busy ? "scan" : ""}`}
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-bg transition group-hover:-rotate-6">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" /></svg>
            </span>
            <span className="font-display text-lg font-bold">{busy ? "Reading your statement…" : "Drop your CAS PDF here"}</span>
            <span className="text-sm text-ink-3">{busy ? fileName : "or tap to choose · CAMS / KFintech detailed statement"}</span>
          </button>
          <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-widest text-ink-3">
            <span className="h-px flex-1 bg-line" /> no statement handy? <span className="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={sample}
            className="w-full rounded-full bg-lime px-5 py-3.5 font-display text-base font-bold text-[#121019] transition hover:brightness-95 active:scale-[0.99] disabled:opacity-60"
          >
            Try with sample data →
          </button>
          <p className="mt-2 text-center text-xs text-ink-3">A fictional investor&apos;s statement. No real person&apos;s data.</p>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (buf && password) attempt(buf, password.trim());
          }}
          className="space-y-4"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-bg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            </span>
            <div>
              <h3 className="font-display text-lg font-bold">This statement is locked</h3>
              <p className="text-sm text-ink-2">
                Enter the password you set when requesting it. It&apos;s used only inside this browser tab to open <span className="font-medium">{fileName}</span>.
              </p>
            </div>
          </div>
          <input
            autoFocus
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="CAS password"
            className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3.5 font-mono text-base outline-none focus:border-brand"
            aria-label="CAS password"
          />
          {error && <p className="rounded-xl bg-watch-soft px-3 py-2 text-sm text-watch">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={!password || busy} className="flex-1 rounded-full bg-ink px-5 py-3.5 font-display font-bold text-bg disabled:opacity-50">
              {busy ? "Opening…" : "Unlock & analyse"}
            </button>
            <button type="button" onClick={() => { setPhase("idle"); setError(null); }} className="rounded-full border border-line px-5 py-3.5 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}
      {phase === "error" && error && <p className="mt-4 rounded-xl bg-watch-soft px-3 py-2 text-sm text-watch">{error}</p>}
      <p className="mt-5 flex items-center justify-center gap-2 text-xs text-ink-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /></svg>
        Parsed on your device. Your PDF and password never leave this browser.
      </p>
    </div>
  );
}
