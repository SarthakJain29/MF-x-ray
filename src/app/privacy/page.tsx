import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Disclaimer } from "@/components/Disclaimer";
import { DataControls } from "@/components/DataControls";

export const metadata: Metadata = { title: "Privacy & your data" };

const ROWS = [
  ["Your CAS PDF", "Never leaves your device", "Decrypted and read by pdf.js inside your browser tab."],
  ["Your password", "Never stored or sent", "Used once, in memory, to open the PDF."],
  ["Parsed portfolio", "Memory only (default)", "Optionally saved to this browser's localStorage if you turn on “Remember”."],
  ["Scheme codes", "Sent to mfapi.in", "Public AMFI codes, to fetch NAV history. Falls back to our stateless proxy."],
  ["AI chat", "Anonymised totals only", "Fund names, amounts, percentages. Never PAN, name, email, phone, folio or ISIN."],
  ["Analytics / cookies", "None", "No trackers, no ads, no accounts."],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <Link href="/"><Wordmark className="text-lg" /></Link>
        <div className="flex items-center gap-2">
          <Link href="/app" className="rounded-full border border-line px-4 py-2 text-sm font-semibold">Dashboard</Link>
          <ThemeToggle />
        </div>
      </header>
      <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight">Privacy & your data</h1>
      <p className="mt-3 text-lg text-ink-2">MF X-ray is built so that there&apos;s nothing to leak: no server stores your statement, because no server ever receives it.</p>

      <DataControls />

      <section className="card mt-6 overflow-hidden">
        <h2 className="p-5 pb-2 font-display text-xl font-bold">Where each piece of data goes</h2>
        <ul className="divide-y divide-line">
          {ROWS.map(([what, where, how]) => (
            <li key={what} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[160px_190px_1fr]">
              <span className="font-semibold">{what}</span>
              <span className="text-sm font-semibold text-brand">{where}</span>
              <span className="text-sm text-ink-2">{how}</span>
            </li>
          ))}
        </ul>
      </section>
      <Disclaimer className="mt-8" />
    </main>
  );
}
