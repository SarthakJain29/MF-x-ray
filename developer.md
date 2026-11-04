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
| `node scripts/render-icons.cjs` | Renders PWA PNG icons with Playwright |

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
    overlap.ts            pairwise overlap + look-through exposure
    health.ts             plain-language facts
    glossary.ts, learn.ts beginner content
  data/holdings.json      approximate top-holdings snapshot (see Decisions)
  store/store.ts          zustand store, optional localStorage persistence
public/
  data/schemes.json, ter.json   bundled public data snapshots
  sample/sample-cas.pdf         synthetic CAS (password: mfxray)
  sw.js                          service worker (offline shell + cached NAVs)
scripts/                         data/sample/icon generators
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
- **Fund holdings for overlap**: no free, common API exists for AMC monthly portfolio disclosures (each AMC publishes its own Excel/PDF in different formats). v1 ships a hand-compiled, **approximate top-holdings snapshot** for ~20 popular funds plus approximate NIFTY 50 / SENSEX / NIFTY NEXT 50 weights for index funds, clearly labelled in the UI as not live. Funds without data fall back to a same-category note. See Roadmap.
- **Regular-plan money lost (past)**: replays the user's actual purchase dates/amounts on the direct plan's real NAV history (mfapi.in) and compares today's values; falls back to average balance × TER gap × years when history is unavailable (labelled estimate).
- **Projections** (fee drag, goals) use a growth rate the **user chooses** (slider), always labelled “your assumption, not a prediction”. Goals default to 0%; the cost slider defaults to 10% (editable).
- **Privacy**: parsed CAS lives in memory by default. “Remember on this device” (off by default) saves it to localStorage. “Delete my data” wipes localStorage + sessionStorage + memory. No analytics, no cookies.
- **AI context** (`buildAiContext`) includes only fund names, categories, AMC names, rounded amounts, percentages, XIRR, TER. Never PAN, name, email, phone, address, folio, ISIN or transactions. User questions are scrubbed of PAN/email/phone/long numbers/investor name on the client and again on the server; the server rejects any context that still looks like it contains PII. Tests enforce this.
- **Compliance**: the system prompt forbids recommendations and forecasts; the offline answerer refuses advice/forecast questions; a disclaimer is on every page.
- **NAV fetching**: browser calls mfapi.in directly (CORS-enabled). Some cached responses lack CORS headers, so a stateless same-origin proxy (`/api/nav/[code]`, public scheme code only) is used as fallback.
- **Sample data**: fully synthetic investor (“Ananya Rao”, PAN `ABCDE1234F`, fake folios, fake ARN-000000, example.com email) holding 8 real schemes with real ISINs and real historical NAVs, so live features work. Password `mfxray`. ~700 transactions, SIPs, lump sums, stamp duty, STT, partial and full redemptions, two regular plans.
- **PWA**: hand-written service worker (no plugin) — offline app shell, cache-first for static assets and bundled data, network-first with cache fallback for NAVs. Only registered in production.
- **Fonts**: Bricolage Grotesque (display), Instrument Sans (body), JetBrains Mono via `next/font` (self-hosted at build).

## Blockers & workarounds

| What failed | What I tried | Workaround in v1 | What you need to do |
|---|---|---|---|
| Free source for scheme holdings (overlap) | Looked for AMFI/AMC APIs; AMC disclosures are per-AMC Excel files with no common schema | Approximate top-holdings snapshot (`src/data/holdings.json`), labelled in UI; same-category fallback | Optional: build an ingestion job per AMC (see Roadmap) or plug in a licensed data source |
| AMFI TER API is slow (one page ≈ 10 s, 650 pages for a month) | First run hit the 30-min background limit | Script defaults to last month + current month with concurrency 6; current month alone is ~1 min but some AMCs file late | Re-run `npm run data:ter` monthly (or in a scheduled GitHub Action) |
| mfapi.in sometimes omits CORS headers | — | Same-origin stateless proxy fallback `/api/nav/[code]`; statement NAVs used if both fail | None |
| Default LLM model names were retired (`gemini-2.5-flash`, `llama-3.3-70b-versatile`) / Gemini daily free quota hit | Listed available models | Defaults: `gemini-flash-lite-latest`, `openai/gpt-oss-120b`; provider fallback chain; offline answers if all fail | Override with `GEMINI_MODEL`/`GROQ_MODEL` if these change |
| Node fetch ignores proxy in the build sandbox | — | `NODE_USE_ENV_PROXY=1` when running locally in that sandbox | Not needed elsewhere |

## Known issues / limitations

- Only CAMS/KFintech **detailed** CAS is supported; NSDL/CDSL CAS and demat-held units aren't parsed.
- Real-world CAS layouts vary; the parser has been validated against the synthetic sample and hand-written line fixtures, not a corpus of real statements (no real data was used, by design). If a statement fails to reconcile, the UI shows a warning with the scheme name.
- Holdings snapshot is approximate and limited to ~20 funds; overlap uses top holdings only, so true overlap may be higher.
- TER for a scheme whose AMC hasn't filed in the snapshot months falls back to a category estimate (“est”).
- Value-over-time chart is month-end; the final point uses the latest NAV.
- Tax (capital gains, exit loads) is not modelled.

## Progress

**Done**
- CAS PDF parsing in-browser (password-protected), parser tests on the synthetic sample + text fixtures
- Portfolio analytics: value, FIFO cost, gains, realised gains, XIRR overall + per fund, allocation (asset class / category / AMC)
- Live NAV refresh + value-vs-invested chart (mfapi.in, with proxy + statement fallbacks)
- Overlap matrix, common stocks, look-through exposure (approximate holdings snapshot)
- Cost check: real AMFI TERs, fee drag 5/10/20 yrs at user assumption, regular-plan detection, past money lost (actual direct NAV replay)
- Goals with progress rings and user-chosen assumptions; example goals for sample data
- Beginner layer: tap-to-explain terms everywhere, health summary, learn cards + glossary
- AI chat (Gemini/Groq with fallback, offline mode), anonymisation + PII tests, “see exactly what is sent”
- Privacy page with Remember toggle + Delete my data; PWA manifest, icons, service worker
- Light/dark themes, mobile bottom nav, desktop sidebar
- README with real screenshots; developer.md

**In progress**
- Refreshing `public/data/ter.json` with last month's AMFI data (some AMCs hadn't filed November yet)

**Next**
- Automated AMC holdings ingestion (top AMCs' monthly Excel) to replace the snapshot
- NSDL/CDSL CAS support
- Benchmark comparison (same cash flows into an index fund) — factual, past only
- Capital-gains view (STCG/LTCG with grandfathering)
- Scheduled GitHub Action to refresh `schemes.json` / `ter.json` monthly
