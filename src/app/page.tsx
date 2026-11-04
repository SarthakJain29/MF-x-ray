import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { Wordmark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UploadCard } from "@/components/UploadCard";
import { ResumeLink } from "@/components/ResumeLink";

const FEATURES = [
  { k: "XIRR", t: "Your real return", d: "True XIRR for the whole portfolio and every fund — the fair way to measure SIPs.", c: "var(--s1)" },
  { k: "∩", t: "Fund overlap", d: "Find funds that secretly own the same companies, and how much of each stock you hold.", c: "var(--s7)" },
  { k: "₹", t: "Cost X-ray", d: "Expense-ratio drag in rupees over 5, 10, 20 years. Regular plans flagged, with money lost.", c: "var(--s2)" },
  { k: "◎", t: "Goal tracker", d: "Earmark funds for goals. See progress — with growth assumptions you choose.", c: "var(--s3)" },
  { k: "?", t: "Plain language", d: "Every term explained on tap. A health summary that reads like a friend wrote it.", c: "var(--s5)" },
  { k: "AI", t: "Ask your portfolio", d: "Chat about your own numbers. Only anonymous totals are ever shared.", c: "var(--s4)" },
];

export default function Home() {
  return (
    <main className="relative overflow-x-clip">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Wordmark className="text-xl" />
        <div className="flex items-center gap-2">
          <ResumeLink />
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pt-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">
            <span className="h-2 w-2 rounded-full bg-pos" /> 100% on-device · no sign-up · free
          </span>
          <h1 className="mt-5 font-display text-[clamp(2.6rem,8vw,5.4rem)] font-extrabold leading-[0.92] tracking-[-0.04em]">
            See inside your
            <br />
            <span className="relative inline-block">
              <span className="relative z-10">mutual funds.</span>
              <span className="absolute inset-x-0 bottom-[0.08em] z-0 h-[0.32em] -rotate-1 rounded-sm bg-lime" aria-hidden />
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            Drop in your CAMS / KFintech statement. Get your true returns, hidden fees, overlapping funds and goal progress — explained in plain
            language, computed entirely in your browser.
          </p>
          <dl className="mt-8 grid max-w-md grid-cols-3 gap-4">
            {[
              ["0", "bytes uploaded"],
              ["~5s", "to analyse"],
              ["₹0", "forever"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-display text-3xl font-extrabold">{v}</dt>
                <dd className="text-xs text-ink-3">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rotate-2 rounded-[2rem] bg-brand/15 blur-2xl" aria-hidden />
          <UploadCard />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">What the X-ray shows</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="card group p-6 transition hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="grid h-11 min-w-11 place-items-center rounded-xl px-2 font-display text-lg font-extrabold text-white" style={{ background: f.c }}>
                  {f.k}
                </span>
                <span className="text-ink-3 transition group-hover:translate-x-1">→</span>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold">{f.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="film relative mx-2 overflow-hidden rounded-[2rem] px-5 py-14 sm:mx-6 sm:px-12">
        <div className="film-grid absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-lime">Privacy by architecture</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-tight tracking-tight">Your statement never leaves your device.</h2>
            <p className="mt-4 text-white/70">
              The PDF is decrypted and read by JavaScript running in your browser. There is no upload, no account and no database. Only public fund codes
              are used to fetch NAVs. If you use AI chat, only anonymous totals (fund names, amounts, percentages) are sent — never your PAN, name, email or
              folio numbers.
            </p>
          </div>
          <ol className="space-y-3">
            {[
              ["Your device", "PDF + password stay here. Parsed with pdf.js in a web worker."],
              ["Public data", "Scheme codes → mfapi.in for NAVs. AMFI expense ratios bundled."],
              ["Optional AI", "Anonymised summary only. Works offline without it."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                <span className="font-display text-2xl font-extrabold text-lime">0{i + 1}</span>
                <div>
                  <div className="font-display font-bold">{t}</div>
                  <div className="text-sm text-white/65">{d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Get your CAS in two minutes</h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ["Visit", "camsonline.com or kfintech.com → Investor services → CAS (CAMS + KFintech)."],
              ["Choose", "Statement type “Detailed”, period from your first investment, and set a password."],
              ["Drop it here", "The PDF lands in your email. Open MF X-ray and drop it in."],
            ].map(([t, d], i) => (
              <li key={t} className="card p-5">
                <span className="font-mono text-xs text-ink-3">STEP {i + 1}</span>
                <div className="mt-2 font-display text-lg font-bold">{t}</div>
                <p className="mt-1 text-sm text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <Disclaimer className="max-w-3xl" />
        <div className="mt-6 flex flex-wrap gap-4 text-sm text-ink-3">
          <Link href="/privacy" className="hover:text-ink">Privacy & your data</Link>
          <Link href="/app/learn" className="hover:text-ink">Learn the basics</Link>
          <a href="https://github.com/sarthakjain29/mf-x-ray" className="hover:text-ink">Source on GitHub</a>
        </div>
        <div aria-hidden className="mt-10 select-none font-display text-[clamp(4rem,19vw,15rem)] font-extrabold leading-[0.8] tracking-[-0.06em] text-ink/[0.07]">
          X-RAY
        </div>
      </footer>
    </main>
  );
}
