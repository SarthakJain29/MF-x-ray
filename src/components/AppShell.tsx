"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/store/store";
import { Wordmark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/app", label: "Overview", icon: "M3 12 12 4l9 8M5 10v10h14V10" },
  { href: "/app/overlap", label: "Overlap", icon: "M9 12a5 5 0 1 0 0 .01M15 12a5 5 0 1 0 0 .01" },
  { href: "/app/costs", label: "Costs", icon: "M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6" },
  { href: "/app/goals", label: "Goals", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-3.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1" },
  { href: "/app/ask", label: "Ask", icon: "M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isSample = useStore((s) => s.isSample);
  const hasData = useStore((s) => !!s.cas);
  const active = (href: string) => (href === "/app" ? path === "/app" || path.startsWith("/app/fund") : path.startsWith(href));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-4 py-5 lg:flex">
        <Link href="/" aria-label="MF X-ray home">
          <Wordmark className="text-lg" />
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active(n.href) ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2"}`}
            >
              <Icon d={n.icon} />
              {n.label}
            </Link>
          ))}
          <div className="my-3 h-px bg-line" />
          <Link href="/app/learn" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${path.startsWith("/app/learn") ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2"}`}>
            <Icon d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5" />
            Learn
          </Link>
          <Link href="/privacy" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-2">
            <Icon d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" />
            Privacy & data
          </Link>
        </nav>
        <div className="mt-auto rounded-2xl bg-surface-2 p-3 text-xs text-ink-3">
          <span className="font-semibold text-ink-2">Not investment advice.</span> Facts & education only.
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="lg:hidden" aria-label="MF X-ray home">
              <Wordmark className="text-lg" />
            </Link>
            <span className="hidden items-center gap-2 text-xs text-ink-3 lg:flex">
              <span className="h-2 w-2 rounded-full bg-pos" /> Analysed on this device
            </span>
            <div className="flex items-center gap-2">
              {isSample && hasData && <span className="rounded-full bg-lime px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#121019]">Sample data</span>}
              <Link href="/app/learn" className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 lg:hidden" aria-label="Learn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5" /></svg>
              </Link>
              <Link href="/privacy" className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 lg:hidden" aria-label="Privacy and data">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /></svg>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12">{children}</main>
      </div>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/90 backdrop-blur-xl lg:hidden" aria-label="Main">
        <ul className="mx-auto grid max-w-md grid-cols-5 px-2 pt-1.5">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium ${active(n.href) ? "text-brand" : "text-ink-3"}`} aria-current={active(n.href) ? "page" : undefined}>
                <Icon d={n.icon} />
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
