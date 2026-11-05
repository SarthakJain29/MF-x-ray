# MF X-ray — developer guide

Everything a developer (or a new coding session) needs to run, change, deploy and continue this project.

## Quick start

```bash
npm install          # also copies the pdf.js worker into public/
npm run dev          # http://localhost:3000 — click “Try with sample data”
npm run check        # typecheck + lint + tests
npm run build && npm start
```

Requirements: Node ≥ 20 (developed on Node 22), npm 10. No database, no accounts.

## Environment variables

All optional. Copy `.env.example` to `.env.local`. Without any key, AI chat runs in **offline mode** (rule-based
answers computed on-device from the same anonymised data), so the app works end to end with zero configuration.

| Variable | Needed for | Where to get it (free) | Default |
|---|---|---|---|
| `GEMINI_API_KEY` | AI chat via Google Gemini | https://aistudio.google.com/apikey | — |
| `GEMINI_MODEL` | Override Gemini model | — | `gemini-flash-lite-latest` |
| `GROQ_API_KEY` | AI chat via Groq | https://console.groq.com/keys | — |
| `GROQ_MODEL` | Override Groq model | — | `openai/gpt-oss-120b` |
| `LLM_PROVIDER` | Which provider to try first (`gemini`/`groq`) | — | gemini first |

If both keys are present, the chat route tries them in order and falls through on errors (e.g. quota exceeded).
Keys are read **server-side only** in `src/app/api/chat/route.ts`; they're never shipped to the browser.

Sandbox-only: Node's `fetch` ignores `HTTPS_PROXY` by default. In environments that require an outbound proxy
(like the cloud container this was built in), run with `NODE_USE_ENV_PROXY=1 npm run dev`. Not needed on Vercel or a normal laptop.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest (CAS parsing on the real sample PDF, XIRR, overlap, costs, goals, anonymisation, providers) |
| `npm run typecheck` / `lint` / `check` | tsc / eslint / all three + tests |
| `npm run sample:generate` | Regenerates `public/sample/sample-cas.pdf` + `tests/fixtures/sample-cas.expected.json` (needs network for mfapi.in NAVs; caches them in `scripts/.nav-cache.json`, git-ignored) |
| `npm run data:schemes` | Rebuilds `public/data/schemes.json` from AMFI's NAVAll.txt (ISIN → AMFI code, category, AMC) |
| `npm run data:ter` | Rebuilds `public/data/ter.json` from AMFI's TER disclosure API (last month + current month; ~30 min because the API is paginated daily rows) |
| `npm run data:holdings` | Discovers + downloads AMC monthly portfolio disclosures and rebuilds `public/data/holdings.json` (needs Playwright + Chromium; ~10 min). Downloads cached in `scripts/.holdings-cache/` (git-ignored) |
| `npm run data:holdings:offline` | Rebuilds the holdings snapshot from the local download cache only |
| `node scripts/render-icons.cjs` | Renders PWA PNG icons with Playwright |

**Monthly refresh:** `.github/workflows/refresh-data.yml` runs on the 12th of each month (and on demand). It rebuilds
the scheme master, holdings snapshot and TER, runs the tests, and opens a PR on `data/monthly-refresh`. It needs
Actions to be allowed to create PRs (Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests").

## Architecture

```
src/
  app/                    Next.js App Router pages
    page.tsx              Landing + upload
    app/                  The app (Overview, Overlap, Costs, Goals, Ask, Learn, Fund detail)
    privacy/              Privacy explainer + Remember toggle + Delete my data
    api/chat/route.ts     Stateless LLM proxy (anonymised context only)
    api/nav/[code]/       Stateless fallback proxy for public NAV history
    manifest.ts           PWA manifest
  lib/
    cas/                  extract.ts (pdf.js items → lines), parser.ts (lines → CASData), browser.ts
    finance/              xirr, portfolio (FIFO cost, XIRR, allocation), costs, goals, timeline, categorize
    data/                 schemeIndex (AMFI master), ter (AMFI TER + estimates), nav (mfapi.in)
    ai/                   anonymize (the only thing that leaves the device), prompt, providers, localAnswer
    cas/diagnostic.ts     redaction + anonymised "didn't parse right?" report
    finance/lots.ts       FIFO lot engine (acquisition dates, disposals, merger carry-over)
    finance/capitalGains.ts  STCG/LTCG estimate (rules table, grandfathering, FY summary)
    holdings/             snapshot types + lookup (by plan ISIN, then name key)
    overlap.ts            pairwise overlap, verdicts, look-through stocks + sectors (ISIN-keyed)
    shareCard.ts          anonymised share-card data + canvas drawing
    health.ts             plain-language facts
    glossary.ts, learn.ts beginner content
  data/holdings-fallback.json  approximate top-holdings list, used only when no disclosure covers a fund
  store/store.ts          zustand store, optional localStorage persistence
public/
  data/schemes.json, ter.json, holdings.json   bundled public data snapshots
  sample/sample-cas.pdf         synthetic CAS (password: mfxray)
  sw.js                          service worker (offline shell + cached NAVs)
scripts/                         data/sample/icon generators
  holdings/                      AMC disclosure ingestion: sources.ts (per-AMC discovery), parse-disclosure.ts (generic SEBI-format parser), build-snapshot.ts, ingest.ts
tests/                           vitest
```

Parsing pipeline: `File → ArrayBuffer → pdf.js (web worker, password) → text items → itemsToLines()` (groups by y,
joins column gaps with `\t\t`) `→ parseCASLines()` (regex state machine modelled on CAMS/KFintech layout, with
tab-less fallbacks) `→ buildPortfolio()` (enriches with AMFI index, TER, live NAVs).

## Deploy (free)

**Vercel (recommended)**: import the GitHub repo → framework auto-detected → add `GEMINI_API_KEY` and/or
`GROQ_API_KEY` in Project Settings → Environment Variables → deploy. Hobby tier is enough (two tiny serverless
routes; everything else is static).

Alternatives: Netlify (Next runtime) or Cloudflare Pages via OpenNext. A fully static export is possible if you
drop AI chat's server route (offline mode still works) and the NAV proxy — set `output: "export"` in `next.config.ts`.

## Charts

Categorical colours use a CVD-validated 8-slot palette (light and dark steps validated separately against their
surfaces with the dataviz palette validator; worst adjacent CVD ΔE 9.1 light / 8.4 dark). Three light-mode slots
are below 3:1 contrast, so every chart that uses them also shows visible labels/values (allocation legend lists,
direct labels). Asset classes have a fixed colour each; categories/AMCs are assigned by alphabetical key so colours
follow the entity, not its rank.

## Decisions

- **Branch**: work is on `claude/v1` as requested in the task (the session also had a harness default branch; the task's explicit branch was used).
- **Next.js 16.4 + React 19 + Tailwind 4 + Recharts 3 + zustand**. Turbopack default. pdf.js 5 for PDF decryption/text.
- **Parsing in the browser** with pdf.js in a web worker; worker file is copied to `/public` (no CDN) by `postinstall`/`predev`/`prebuild`.
- **Detailed CAS only** (CAMS/KFintech). Summary statements are detected and rejected with a clear message (no transactions → no XIRR). NSDL/CDSL depository CAS is not supported in v1.
- **Text-only parser** (`parseCASLines`) decoupled from pdf.js, so it's testable with plain strings and has fallbacks for statements whose columns aren't separable.
- **Cost basis = FIFO** of remaining units (matches how capital gains are computed in India). If a statement doesn't start at the first purchase (opening balance > 0), the CAS's own “Total Cost Value” is used and XIRR for that fund is shown as unavailable with a warning.
- **XIRR**: Newton–Raphson with bisection fallback; Actual/365 like Excel. Dividend reinvestments are not cash flows; stamp duty/STT/TDS are. Switches are included per fund and net out at portfolio level.
- **Current value** uses the latest NAV from mfapi.in when newer than the statement; otherwise the statement's NAV. The UI shows which.
- **Scheme master**: AMFI NAVAll.txt snapshot bundled (`public/data/schemes.json`, ~190 KB gz, lazy-loaded) for ISIN → AMFI code/category/AMC and to find each regular plan's direct twin.
- **Expense ratios**: real per-scheme regular/direct TERs from AMFI's public TER disclosure API, bundled as a snapshot. Category-median estimates are used only when a scheme is missing, and are labelled “est”.
- **Fund holdings for overlap (v2)**: ingested from AMC **monthly portfolio disclosures** (the Excel files SEBI requires each AMC to publish). One generic parser handles every AMC because SEBI prescribes the columns: it finds the header row (ISIN + "% to NAV/Net Assets"), tracks equity/foreign/debt/derivative sections, auto-detects fraction vs percent weights, sums duplicate lines and uses the ISIN security-type code (positions 8–9: `01` = equity share) to separate shares from bonds. Derivative legs are excluded so hedged positions aren't double counted. Stock identity = ISIN. Snapshot (Sep 2026): **395 schemes from 9 AMCs** — SBI, Nippon India, Aditya Birla Sun Life, Mirae Asset, DSP, Tata, PPFAS, Motilal Oswal, Invesco — with 390 mapped to AMFI plan ISINs (≈108 KB gzipped, lazy-loaded). Arbitrage funds and schemes with < 35% equity are excluded. Lookup order: user's plan ISIN → name key → **index proxy** (an index fund whose AMC isn't covered borrows the disclosed portfolio of a sibling fund tracking the same index) → **approximate** hand-compiled top holdings (names mapped onto ISINs where possible). The UI always shows the source and month per fund.
- **Overlap verdicts**: Σ min(weightA, weightB) over common ISINs; ≥60% "nearly the same portfolio", ≥35% "a large shared core", ≥15% "some shared stocks", else "very different".
- **Regular-plan money lost (past)**: replays the user's actual purchase dates/amounts on the direct plan's real NAV history (mfapi.in) and compares today's values; falls back to average balance × TER gap × years when history is unavailable (labelled estimate).
- **Benchmark reference**: the dashboard replays the user's exact cash flows on UTI Nifty 50 Index Fund (direct) historical NAVs and shows value + XIRR side by side. Framed as a past-only yardstick, not a recommendation.
- **Projections** (fee drag, goals) use a growth rate the **user chooses** (slider), always labelled “your assumption, not a prediction”. Goals default to 0%; the cost slider defaults to 10% (editable).
- **Privacy**: parsed CAS lives in memory by default. “Remember on this device” (off by default) saves it to localStorage. “Delete my data” wipes localStorage + sessionStorage + memory. No analytics, no cookies.
- **AI context** (`buildAiContext`) includes only fund names, categories, AMC names, rounded amounts, percentages, XIRR, TER. Never PAN, name, email, phone, address, folio, ISIN or transactions. User questions are scrubbed of PAN/email/phone/long numbers/investor name on the client and again on the server; the server rejects any context that still looks like it contains PII. Tests enforce this.
- **Compliance**: the system prompt forbids recommendations and forecasts; the offline answerer refuses advice/forecast questions; a disclaimer is on every page.
- **NAV fetching**: browser calls mfapi.in directly (CORS-enabled). Some cached responses lack CORS headers, so a stateless same-origin proxy (`/api/nav/[code]`, public scheme code only) is used as fallback.
- **Sample data**: fully synthetic investor (“Ananya Rao”, PAN `ABCDE1234F`, fake folios, fake ARN-000000, example.com email) holding 8 real schemes with real ISINs and real historical NAVs, so live features work. Password `mfxray`. ~700 transactions, SIPs, lump sums, stamp duty, STT, partial and full redemptions, two regular plans.
- **PWA**: hand-written service worker (no plugin) — offline app shell, cache-first for static assets and bundled data, network-first with cache fallback for NAVs. Only registered in production.
- **Parser robustness (v2)**: classification order fixed so SWP → redemption, STP → switch, mergers → `MERGER_IN/OUT` (non-cash; cost basis and acquisition dates carried across schemes in the same folio), bonus → zero-cost lot, segregated/side-pocket → zero-cost lot, purchase rows with negative units → reversal. Dated lines can never become scheme headers. Missing valuation lines fall back to the last transaction NAV with a warning. Fixtures in `tests/fixtures/cas/` (CAMS-style edge cases, KFintech-style tab-less layout with a merger, noisy page headers/footers).
- **Diagnostic report**: raw statement text is never retained. Right after extraction the lines are redacted (personal block, PAN, e-mail, phone, folio, nominee, all digits → 9, dates → 99-Mmm-9999) and only that form is kept in memory (not persisted). Fund names are masked unless the user opts in. The user copies/downloads it; nothing is sent. A leak check warns if the (editable) text still looks like it contains an identifier.
- **Capital gains**: FIFO lots; rules table in `capitalGains.ts` (`RULES`). Equity-oriented (incl. index, ELSS, arbitrage, aggressive hybrid, balanced advantage, equity savings): LT > 12 months, 12.5% above ₹1.25 L/FY, ST 20%. Debt acquired ≥ 1 Apr 2023: slab. Debt acquired earlier, gold/silver, international FoFs, 35–65% equity hybrids: LT > 24 months at 12.5%, else slab. Grandfathering for equity lots ≤ 31 Jan 2018 using the 31-Jan-2018 NAV from mfapi.in. 4% cess included; surcharge and cross-bucket set-off not modelled. Tax estimates are shown only for FYs fully under the post-23-Jul-2024 rules. Rules verified 5 Nov 2026: Budget 2026 left MF capital-gains rates unchanged; the Income-tax Act, 2025 (from 1 Apr 2026) renumbered sections without changing rates. Slab rate is user-chosen (default 30%).
- **Share card**: percentages only by default (value is opt-in, XIRR toggle); drawn on a canvas in the browser; shared via the Web Share API with download fallback.
- **First-run tour**: 5-step bottom sheet on the first dashboard visit (flag in localStorage), replayable from Learn.
- **Fonts**: Bricolage Grotesque (display), Instrument Sans (body), JetBrains Mono via `next/font` (self-hosted at build).

## Blockers & workarounds

| What failed | What I tried | Workaround in v1 | What you need to do |
|---|---|---|---|
| AMC disclosures for HDFC, Edelweiss | Direct fetch + headless browser | "Access Denied" (Akamai bot protection). Not bypassed. Their funds use index proxy / approximate fallback, labelled | Optional: download those files manually into `scripts/.holdings-cache/` and add a `Source` entry, or ask the AMC for a feed |
| ICICI Prudential disclosures | Headless browser | Host unreachable under this build environment's network policy | Try `npm run data:holdings` from a normal machine/CI after adding an ICICI `Source` entry |
| Kotak disclosures | Their folder-list API (used by captn3m0/mf-portfolio) | Behind Radware bot protection. Not bypassed | Same as above |
| Axis, UTI, Franklin | Rendered download pages | No month-end portfolio files discoverable automatically (UTI/Franklin publish per fund / via CMS) | Add per-fund URL patterns in `scripts/holdings/sources.ts` |
| Mirae page lists only 10 latest files | Pagination not exposed | Known scheme codes are probed directly (`probe()`); Mirae Large Cap's code wasn't found, so it uses the approximate fallback | Add its code to the probe list |
| AMFI TER API is slow (one page ≈ 10 s, 650 pages for a month) | First run hit the 30-min background limit | Script defaults to last month + current month with concurrency 6; current month alone is ~1 min but some AMCs file late | Re-run `npm run data:ter` monthly (or in a scheduled GitHub Action) |
| mfapi.in sometimes omits CORS headers | — | Same-origin stateless proxy fallback `/api/nav/[code]`; statement NAVs used if both fail | None |
| Default LLM model names were retired (`gemini-2.5-flash`, `llama-3.3-70b-versatile`) / Gemini daily free quota hit | Listed available models | Defaults: `gemini-flash-lite-latest`, `openai/gpt-oss-120b`; provider fallback chain; offline answers if all fail | Override with `GEMINI_MODEL`/`GROQ_MODEL` if these change |
| Node fetch ignores proxy in the build sandbox | — | `NODE_USE_ENV_PROXY=1` when running locally in that sandbox | Not needed elsewhere |

## Known issues / limitations

- Only CAMS/KFintech **detailed** CAS is supported; NSDL/CDSL CAS and demat-held units aren't parsed.
- Real-world CAS layouts vary; the parser has been validated against the synthetic sample and hand-written line fixtures, not a corpus of real statements (no real data was used, by design). If a statement fails to reconcile, the UI shows a warning with the scheme name.
- Holdings come from 9 AMCs; funds from other AMCs use an index proxy (index funds) or an approximate top-holdings list (labelled). Disclosures are month-end and published ~10 days later.
- Per-fund XIRR is unavailable for a scheme created by a merger (its cash flows live in the old scheme); portfolio XIRR is unaffected.
- TER for a scheme whose AMC hasn't filed in the snapshot months falls back to a category estimate (“est”).
- Value-over-time chart is month-end; the final point uses the latest NAV.
- Capital-gains view is an estimate: no surcharge, loss set-off/carry-forward, exit loads, demat units outside the CAS, or official tax classification lookup (inferred from category).

## Progress

**Done (v1)** — CAS parsing in-browser, dashboard/XIRR/allocation, costs & TER, goals, beginner layer, AI chat with anonymisation, privacy controls, PWA, CI. PR: https://github.com/SarthakJain29/MF-x-ray/pull/1

**Done (v2, this round)**
- AMC monthly-disclosure ingestion: 9 AMCs, 395 schemes, ISIN-keyed, monthly GitHub Action, "data as of" in UI, labelled fallbacks
- Overlap hero: biggest-overlap verdict, heat-map with details, real top-10 look-through stocks (fund-coloured), sector exposure, per-fund source badges, dashboard teaser
- Parser robustness: STP/SWP/merger/bonus/segregation/NFO/reversal/zero-balance/multi-PAN/KFintech fixtures; shared FIFO lot engine
- "Statement didn't parse right?" anonymised diagnostic report (redaction tested against sample + fixtures)
- Capital gains estimate page (/app/tax) with rules, grandfathering, FY summary, upcoming long-term dates, IDCW income
- Share card image, first-run tour, error/404/empty states
- Tests: 99 (vitest)

**In progress**
- Nothing in flight.

**Next**
- More AMCs (HDFC/ICICI/Kotak/Axis/UTI via manual or partner feeds); Mirae Large Cap code
- NSDL/CDSL CAS support
- Capital-gains: loss set-off across buckets, exit loads
- Automated visual regression screenshots in CI
