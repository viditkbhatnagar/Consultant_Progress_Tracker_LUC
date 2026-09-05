# 08 — Dependencies & Integrations

This document is the complete inventory of everything the Sales Tracker depends on that it does not
itself contain: every npm package in `server/package.json`, `client/package.json` and the root
`package.json`, the Python packages in `server/requirements.txt`, and every external service the
running system talks to. For each package it says **what it is actually used for in this codebase**,
with a file and line reference — not what the package does in general. For each external service it
says what configures it, where the integration code lives, what breaks when the service is down, and
whether it is **billed** (i.e. whether an account and payment method must change hands as part of the
handover). Everything here was verified against the code on 5 September 2026; where something could
not be verified from the repository it is marked **UNVERIFIED**.

---

## Conventions used below

| Marker | Meaning |
|---|---|
| **BILLED** | Costs money. Account ownership and payment method must transfer. |
| **UNUSED** | Installed in `package.json` but never imported anywhere in the source. |
| **INDIRECT** | Never imported directly; present because another package requires it as a peer. |
| **UNVERIFIED** | Cannot be confirmed from the repository — needs confirmation from the outgoing developer or a dashboard. |

Versions are given as *range* (what `package.json` asks for) and *locked* (what `package-lock.json`
currently resolves to). When those differ, a fresh `npm install` on a clean machine can pull a
different version than the one that has been running — noted where it matters.

---

# Part A — Package dependencies

## A.0 Where the manifests live

There are **four** dependency manifests. There is no monorepo tool (no workspaces, no Lerna, no
pnpm); the root `package.json` just shells into the two sub-projects.

| Manifest | Purpose | Install command |
|---|---|---|
| `package.json` (root) | Dev orchestration only — `concurrently` to run both servers | `npm install` |
| `server/package.json` | Express API runtime + test tooling | `cd server && npm install` |
| `client/package.json` | React SPA (CRA) | `cd client && npm install` |
| `server/requirements.txt` | Python 3 — used by **one** optional script | `pip3 install -r server/requirements.txt` |

`npm run install:all` (root `package.json:9`) does all four in sequence, and deliberately tolerates
the Python step failing:

```
"install:all": "npm install && cd server && npm install && cd ../client && npm install && cd .. &&
  (pip3 install -r server/requirements.txt || python3 -m pip install -r server/requirements.txt ||
   echo 'pip install failed — Python highlight script will not run; see DEPLOYMENT.md')"
```

**Node version:** there is **no `engines` field, no `.nvmrc`, and no Dockerfile** anywhere in the
repo. The Node version used in production is whatever the Render service is configured with, which
lives only in the Render dashboard — **UNVERIFIED** from the repo. This is a real handover risk: a
future Render default-Node bump could break the build with nothing in version control to pin it.
Mongoose 9 and Express 5 both require Node 18+; the AWS SDK v3 and `openai` v6 effectively require
Node 18+ too.

**No CI:** there is no `.github/` directory. Nothing runs `npm audit`, tests, or a build on push.

---

## A.1 Server runtime dependencies

All 21 are in `server/package.json` `dependencies`.

| Package | Range / locked | What it is used for **here** | Key reference |
|---|---|---|---|
| `express` | `^5.1.0` / 5.1.0 | The whole HTTP layer. 19 route groups mounted under `/api`, plus static serving of the React build and the auth-gated PDF directories. **Express 5 specific:** the SPA catch-all is a *regex* (`app.get(/^(?!\/api).*/)`) because Express 5's path-to-regexp v8 rejects the old `'*'` string form. Do not "simplify" it back. | `server/server.js:2`, catch-all at `server/server.js:111` |
| `mongoose` | `^9.0.0` / 9.0.0 | ODM for all 27 models. Single connection opened at boot. **Trap:** `findByIdAndUpdate` runs validators in *query* context, so conditional `required` functions see `this.organization === undefined` and silently pass — controllers re-check in JS. | `server/config/db.js:5` |
| `dotenv` | `^17.2.3` / 17.2.3 | Loads `server/.env`. Called once at the top of `server.js`, and again independently by ~50 one-off scripts (46 files in `server/scripts/`, 4 in `server/utils/`), each with its own explicit path because scripts run with a different cwd. | `server/server.js:1`; e.g. `server/scripts/backfillCommitmentDate.js:11` |
| `jsonwebtoken` | `^9.0.2` / 9.0.2 | Signs JWTs on the User model, verifies them in the `protect` middleware, and **also** authenticates every Socket.IO connection with the same token. | `server/models/User.js:3`, `server/middleware/auth.js:1`, `server/services/realtime.js:10` |
| `bcryptjs` | `^3.0.3` / 3.0.3 | Password hashing (salt rounds 10) in a `pre('save')` hook, and `matchPassword()` on login. Pure-JS implementation — no native build step, which is why it was chosen over `bcrypt`. | `server/models/User.js:2,80,93` |
| `cors` | `^2.8.5` / 2.8.5 | `app.use(cors())` — **fully permissive, all origins**. Fine today because prod is same-origin (Render serves the SPA and the API from one service) and dev is 3001→5001. It would need tightening the moment the API is consumed from anywhere else. | `server/server.js:3,29` |
| `helmet` | `^8.1.0` / 8.1.0 | Global security headers. Two deliberate relaxations: `contentSecurityPolicy: false` (CRA's inline styles and dynamic chunks would need a longer pass) and `crossOriginResourcePolicy: 'same-site'` (so the auth-blob PDF viewer and PNG snippets keep working). | `server/server.js:4,20-25` |
| `express-rate-limit` | `^7.5.1` / 7.5.1 | Two limiters only. (1) Export Center pivot/template endpoints: 5 req/min keyed on `req.user._id` with IP fallback. (2) Institute schedule import: 10 req/min, because SheetJS parsing is CPU-heavy on a single Node process. Everything else is unlimited. | `server/middleware/exportRateLimit.js:4-24`, `server/routes/institute.js:3,29-36` |
| `multer` | `^2.1.1` / 2.1.1 | Three multipart upload paths, **all `memoryStorage()` — nothing is ever written to disk**: voice notes for Whisper (25 MB cap), Institute schedule workbooks (8 MB, extension-filtered to `.xlsx/.xlsm/.xls/.csv`), Tier Fight base images (12 MB). | `server/routes/chat.js:22-25`, `server/routes/institute.js:13-25`, `server/routes/tiers.js:12-15` |
| `socket.io` | `^4.8.3` / 4.8.3 | Real-time "something changed" broadcasts so open dashboards re-fetch. Attached to the same HTTP server at path `/socket.io`. Clients join rooms `org:<org>`, `org:<org>:admin`, `org:<org>:team:<id>`. **Required lazily inside a `try/catch`** so a missing install degrades to "no realtime" instead of crashing boot; also a no-op when `NODE_ENV=test`. | `server/services/realtime.js:16-31` |
| `node-cron` | `^4.2.1` / 4.2.1 | Exactly **two** scheduled jobs, both registered inline in `server.js` and both skipped when `NODE_ENV=test`: nightly DB snapshot at `30 0 * * *` and student birthday notifications at `0 8 * * *`, both `timezone: 'Asia/Dubai'`. (A third recurring job, the LUC drift monitor at `server.js:149-152`, is **not** node-cron — it uses `setTimeout` + `setInterval` inside `server/services/driftMonitor.js:72-73`.) | `server/server.js:157-187` |
| `openai` | `^6.22.0` / 6.22.0 | Every OpenAI call — chat completions, embeddings, Whisper transcription, and `gpt-image-2` poster generation. Instantiated separately in 10 files (there is no shared client module; see §B.4). | `server/services/aiService.js:1`, `server/services/chatService.js:22`, `server/controllers/tierController.js:1`, +7 more |
| `groq-sdk` | `^1.1.2` / 1.1.2 | Groq chat completions. Two consumers: the Docs-RAG answer generator (primary provider) and the tracker/docs query classifier. Both share an HTTP keep-alive agent with the OpenAI client. | `server/services/docsRagService.js:16,43-53`, `server/services/classifierService.js:13,41-53` |
| `wink-bm25-text-search` | `^3.1.2` / 3.1.2 | The lexical half of the Docs-RAG hybrid retriever. An in-memory BM25 index over the ~215 chunks, fused with dense cosine similarity via RRF in "Tier 2" retrieval. | `server/services/docsRagService.js:17` |
| `pdf-parse` | `^1.1.1` / **1.1.4** | PDF → text extraction during Docs-RAG ingestion. **Build-time only** — used by one script, never at request time. Note the range/locked drift: a clean install can pull a newer 1.1.x than the one the corpus was built with. | `server/scripts/ingestProgramDocs.js:19` |
| `tiktoken` | `^1.0.15` / **1.0.22** | Token counting while chunking PDFs, so chunks land in the target token window before embedding. Same script only — **not** used for runtime cost accounting (costs are computed from the API's own `usage` object). Ships a WASM binary, so it is the heaviest install in the server tree. | `server/scripts/ingestProgramDocs.js:20` |
| `xlsx` (SheetJS) | `^0.18.5` / 0.18.5 | Server-side workbook parsing: the Institute schedule importer (the pure `scheduleParser` service, shared with a CLI script) and the legacy student/Excel import scripts. See the security note in §A.6. | `server/services/institute/scheduleParser.js:17`, `server/scripts/importInstituteFromExcel.js:19` |
| `@aws-sdk/client-s3` | `^3.1057.0` / 3.1057.0 | S3 put/get/list. Two consumers: Tier Fight poster storage and the nightly gzipped DB snapshot. | `server/services/s3.js:5-10` |
| `@aws-sdk/s3-request-presigner` | `^3.1057.0` / 3.1057.0 | Generates time-limited (1 h) presigned GET URLs so the **private** bucket can serve posters to a browser, and presigned download URLs with `Content-Disposition: attachment`. This is why no bucket CORS config is needed — the browser *navigates* to the URL rather than fetching it. | `server/services/s3.js:11,49-67` |
| `csv-parser` | `^3.2.0` / 3.2.0 | **Effectively dead.** Only consumer is `server/utils/importCSV.js`, a standalone legacy import script that is not referenced by any npm script or any other file and self-invokes on require. Safe to delete along with that script. | `server/utils/importCSV.js:5` |
| `express-validator` | `^7.3.1` / 7.3.1 | **UNUSED.** Zero imports anywhere in the repo. All request validation is hand-written inside controllers. Either adopt it or drop it — the current state misleads a reader into thinking validation is schema-driven. | — |

### A.2 Server dev dependencies

| Package | Range / locked | Used for |
|---|---|---|
| `jest` | `^29.7.0` / 29.7.0 | Test runner. Config is inline in `server/package.json` (`testEnvironment: node`, `testTimeout: 60000`). |
| `supertest` | `^7.2.2` / 7.2.2 | HTTP assertions against an Express app mounted in-process by each test suite. |
| `mongodb-memory-server` | `^10.4.3` / 10.4.3 | Spins a real in-memory `mongod` per suite so tests never touch Atlas. **Downloads a MongoDB binary from `fastdl.mongodb.org` on first run** — see §B.8. | `server/tests/exports/_setup.js:6,13` |
| `nodemon` | `^3.1.11` / 3.1.11 | `npm run dev` watch-restart. |

> **Gotcha:** `npm test` in `server/` runs `jest --testPathPattern="tests/(exports|meetings|institute|commitments)"` — it does **not** run every suite under `tests/`. A green run is not a green repo. See [10 — Known Issues](10-known-issues-and-roadmap.md).

### A.3 Root dependencies

The root manifest has **no** `dependencies` block at all — only `devDependencies`, with one entry.

| Package | Range / locked | Used for |
|---|---|---|
| `concurrently` | `^8.2.2` / 8.2.2 | `npm run dev` — runs `dev:server` and `dev:client` in one terminal. Dev-only; irrelevant in production. |

---

## A.4 Client dependencies

Create React App convention puts **everything** in `dependencies` — there is no `devDependencies`
block in `client/package.json`. That means the test libraries and the build toolchain are installed
on Render at build time even though they never reach the browser bundle. Harmless, but it makes the
list misleading at a glance; the "Ships to browser?" column below disambiguates.

| Package | Range / locked | Ships to browser? | What it is used for **here** | Key reference |
|---|---|---|---|---|
| `react` | `^19.2.0` / 19.2.0 | Yes | The UI framework. | `client/src/index.js` |
| `react-dom` | `^19.2.0` / 19.2.0 | Yes | `createRoot` render, `StrictMode`. | `client/src/index.js:60-66` |
| `react-scripts` | **`5.0.1` (exact, no caret)** / 5.0.1 | No (build tool) | Create React App: webpack, Babel, Jest, dev server. Pinned exactly. **CRA is unmaintained upstream** — this is the single largest long-term maintenance liability in the client. Migrating to Vite is the natural exit but is a real project, not a patch. | `client/package.json:30` |
| `react-router-dom` | `^7.9.6` / 7.9.6 | Yes | All routing, `PrivateRoute` guards, `HomeRedirect` role-based landing. 34 files. | `client/src/App.js` |
| `@mui/material` | `^7.3.5` / 7.3.5 | Yes | The entire component library — 141 files import from it. The base theme (12 px radius at `theme.js:101`, gradient buttons/AppBar) is built on it. **Note the font split:** the base theme declares `fontFamily: '"Inter", "Roboto", …'` (`theme.js:49`) but Inter is *not* one of the families loaded from Google Fonts, so it resolves to a fallback; the newer dashboard/tracker themes override it with a Geist-first stack (`client/src/utils/trackerTheme.js:10`, `client/src/components/dashboard/DashboardShell.js:12`) and Geist *is* loaded. See §B.6. | `client/src/theme.js:49,101` |
| `@mui/icons-material` | `^7.3.5` / 7.3.5 | Yes | Icons. 89 files. |  |
| `@mui/x-date-pickers` | `^8.19.0` / 8.19.0 | Yes | Date pickers in 13 dialogs. **Wired to `date-fns` via `AdapterDateFns`** — that is why `date-fns` is a hard requirement, not just a convenience. Note the MUI X major (8) intentionally differs from MUI core (7); they version independently. | `client/src/components/StudentFormDialog.js:21-22,624` |
| `@emotion/react` | `^11.14.0` / 11.14.0 | Yes | **INDIRECT.** Zero direct imports. It is MUI v7's default style engine and a required peer. Do not remove it because "nothing imports it". | — |
| `@emotion/styled` | `^11.14.1` / 11.14.1 | Yes | **INDIRECT.** Same as above. | — |
| `axios` | `^1.13.2` / 1.13.2 | Yes | Every API call, across 20 service/component files. **Gotcha:** three modules register *global* `axios.interceptors.request` handlers independently — `services/userService.js:12`, `services/commitmentService.js:7` and `utils/axiosAdminOrgInterceptor.js:21` — so they stack on the shared default instance. `authService.js` is a fourth writer to that same global axios but works differently: it sets/clears `axios.defaults.headers.common['Authorization']` (`authService.js:9,12`) rather than registering an interceptor — easy to miss when debugging auth headers. `userService.js:6-9` carries an explicit warning never to set `axios.defaults.baseURL` — in production `API_BASE_URL === '/api'`, so a baseURL would double-prefix every request to `/api/api/...`. | `client/src/services/userService.js:1-12` |
| `date-fns` | `^4.1.0` / 4.1.0 | Yes | All week maths (`weekStartsOn: 1`, ISO week numbers), date formatting in exports, and the MUI date-picker adapter. 32 files. | `client/src/utils/weekUtils.js:1` |
| `echarts` | `^6.1.0` / 6.1.0 | Yes | Charting engine. **Imported once, tree-shaken:** `echartsCore.js` imports from `echarts/core` and registers only Pie/Bar/Line + 7 components (Grid, Tooltip, Legend, Title, Graphic, Dataset, MarkLine) + 2 features (LabelLayout, UniversalTransition) + `CanvasRenderer`. If a new chart renders blank with a console warning, the missing series/component must be registered *there*. | `client/src/components/charts/echartsCore.js:8-36` |
| `echarts-for-react` | `^3.0.6` / 3.0.6 | Yes | The React wrapper — imported as `echarts-for-react/lib/core` so it uses the tree-shaken instance above rather than pulling all of ECharts. | `client/src/components/charts/EChart.js:2` |
| `framer-motion` | `^12.38.0` / 12.38.0 | Yes | Dashboard motion: number count-ups, reduced-motion handling, card/panel transitions. 17 files. | `client/src/utils/dashboardMotion.js:11` |
| `react-data-grid` | **`7.0.0-beta.59` (exact, no caret)** / 7.0.0-beta.59 | Yes | The Export Center preview grid — the only consumer. **Deliberately pinned to an exact beta.** See §A.6 for both reasons why. | `client/src/components/exports/DataGrid.js:2` |
| `xlsx` (SheetJS) | `^0.18.5` / 0.18.5 | Yes | Client-side workbook generation for every export (raw sheets, pivot sheets, multi-sheet template workbooks). | `client/src/services/xlsxBuilder.js:1` |
| `file-saver` | `^2.0.5` / 2.0.5 | Yes | `saveAs()` — turns the generated blob into a browser download. | `client/src/services/xlsxBuilder.js:2,122` |
| `jspdf` | `^2.5.2` / 2.5.2 | Yes, **lazily** | PDF export option in the Export Center. **Dynamically imported** so ~150 KB stays out of the main bundle. | `client/src/services/xlsxBuilder.js:129-137` |
| `jspdf-autotable` | `^3.8.4` / 3.8.4 | Yes, lazily | Table layout inside the jsPDF export. Same dynamic import. | `client/src/services/xlsxBuilder.js:131` |
| `react-markdown` | `^10.1.0` / 10.1.0 | Yes | Renders LLM answers in the chat drawer as Markdown. | `client/src/components/chat/ChatMessage.js:9` |
| `remark-gfm` | `^4.0.1` / 4.0.1 | Yes | GitHub-flavoured Markdown plugin for the above — tables and strikethrough in chat answers. | `client/src/components/chat/ChatMessage.js:10` |
| `fastest-levenshtein` | `^1.0.16` / 1.0.16 | Yes | Fuzzy matching of program names in the **client-side** query router (`classifyQuery`), which decides whether a chat turn goes to `/api/chat/stream` (tracker) or `/api/docs-chat` (program docs). Only when the rules are ambiguous does it call the server-side LLM classifier. | `client/src/utils/classifyQuery.js:18` |
| `socket.io-client` | `^4.8.3` / 4.8.3 | Yes | Singleton socket, `autoConnect: false`, connected explicitly once a JWT exists. Origin derived from `API_BASE_URL` minus `/api`. | `client/src/services/socket.js:1-27` |
| `@testing-library/react` | `^16.3.0` / 16.3.0 | No (tests) | Component tests — 4 suites under `client/src/components/exports/__tests__/`. | |
| `@testing-library/jest-dom` | `^6.9.1` / 6.9.1 | No (tests) | Custom matchers, loaded in `setupTests.js`. | `client/src/setupTests.js:5` |
| `@testing-library/dom` | `^10.4.1` / 10.4.1 | No (tests) | **INDIRECT** — peer of `@testing-library/react`. Never imported directly. | — |
| `@testing-library/user-event` | `^13.5.0` / 13.5.0 | No (tests) | **UNUSED.** Zero imports. Also two majors behind (current is 14.x) and the v13→v14 API is async-by-default, so adopting it is not a drop-in. | — |
| `react-calendar-heatmap` | `^1.10.0` / 1.10.0 | No (dead) | **UNUSED.** Zero imports anywhere in `client/`. `CLAUDE.md` still claims "Heatmap: `react-calendar-heatmap`" — **that claim is stale**; whatever used it was removed. | — |
| `web-vitals` | `^2.1.4` / 2.1.4 | No (dead at runtime) | **Effectively UNUSED.** `reportWebVitals.js` only performs its `import('web-vitals')` when passed a callback, and `index.js:71` calls `reportWebVitals()` with **no argument** — so the dynamic import never executes and no metric is ever collected. Untouched CRA boilerplate. Also pinned to v2, whose `getCLS/getFID` API was replaced in v3+. | `client/src/reportWebVitals.js:1-11`, `client/src/index.js:71` |

### A.5 Python dependencies (`server/requirements.txt`)

Used by exactly one script: `server/scripts/generateHighlightedPdfs.py`, invoked by the root npm
script `highlight:docs` (and therefore by `ingest:docs` / `ingest:docs:force`). It produces the
single-page pre-highlighted PDFs and PNG snippets that the Docs-RAG source-preview pane shows.

| Package | Constraint | Used for |
|---|---|---|
| `PyMuPDF` | `>=1.24.0` | Imported as `fitz`. Extracts a single page from a source PDF, draws the yellow (answer) and light-blue (question) highlight rectangles, and rasterises 150-DPI PNG snippets. |
| `pymongo` | `>=4.6.0` | Reads `DocChunk` rows and writes back `highlightedPdfPath`. Talks to the **same** database as the Node app. |
| `python-dotenv` | `>=1.0.0` | Loads `MONGODB_URI` from `server/.env` — the same file the Node side uses. |

> This is the only place the platform depends on a runtime other than Node. If Python 3 or PyMuPDF
> is missing, everything still works **except** the highlighted-PDF/snippet regeneration step; the
> chat answers and source chips still function, they just point at previously generated (or missing)
> highlight assets. `install:all` deliberately swallows a pip failure for this reason.

---

## A.6 Pins, dead weight, and traps

### The two deliberate exact pins

**`react-data-grid@7.0.0-beta.59` — no caret. Bump only deliberately.**

Two independent reasons:

1. **It is a beta.** 7.x betas iterate fast and have made breaking API changes between numbers. A
   caret would silently move the Export Center's only grid onto an untested build.
2. **It has a CRA-specific rendering trap that is already worked around.** rdg v7-beta ships its
   layout inside CSS cascade layers (`@layer rdg { … }`). CRA 5's cssnano minification **strips those
   rules from the production bundle**, so the grid's `display: grid` never applies and the header row
   falls to natural DOM order — i.e. it renders *below* the rows, but only in a production build.
   The fix was to load the stylesheet as a static `public/` asset that bypasses the PostCSS pipeline:
   `client/public/rdg-styles.css`, linked from `client/public/index.html:31`. If you upgrade rdg you
   must re-copy that stylesheet, and you must verify in a **production build**, not `npm start`.

Also note `client/src/setupTests.js:8-16` stubs `ResizeObserver`, which rdg needs and jsdom does not
provide — required for the grid tests to run at all.

**`react-scripts@5.0.1` — no caret.** CRA is no longer maintained upstream, so there is nothing to
upgrade *to* within CRA. Treat this as frozen and plan a Vite migration if the client needs modern
tooling.

### Installed but unused — safe to remove

| Package | Where | Note |
|---|---|---|
| `express-validator` (server) | — | Zero imports. All validation is manual in controllers. |
| `react-calendar-heatmap` (client) | — | Zero imports. `CLAUDE.md`'s claim that it powers a heatmap is stale. |
| `@testing-library/user-event` (client) | — | Zero imports, and two majors behind. |
| `web-vitals` (client) | `reportWebVitals.js` | Imported only inside a branch that never executes. |
| `csv-parser` (server) | `server/utils/importCSV.js` | Only consumer is an orphaned legacy script. |

Removing these is low-risk but not zero-risk on a system with no CI — do it as its own commit and
run a full production build afterwards.

### Do **not** remove (they look unused but are not)

- `@emotion/react`, `@emotion/styled` — MUI v7's style engine, required peers.
- `@testing-library/dom` — peer of `@testing-library/react`.
- `pdf-parse`, `tiktoken` — used only by `server/scripts/ingestProgramDocs.js`, which is a
  build/ops script, not request-path code. A naive "unused dependency" scanner that only walks
  `require()` graphs from `server.js` will report both as dead. They are not.

### `xlsx@0.18.5` — a standing security note

Both the server and the client pin SheetJS `0.18.5`. Published advisories against `xlsx` at
`<0.19.3` (prototype pollution) and `<0.20.2` (ReDoS) apply to this version, and SheetJS has since
**moved distribution off the public npm registry to its own CDN**, so `npm install xlsx@latest` does
not give you a fixed build — the upgrade path is a registry change, not a version bump. Mitigating
factors in this codebase: server-side parsing is restricted to authenticated Institute/admin users,
rate-limited to 10 uploads/min, extension-filtered, capped at 8 MB, and held in memory
(`server/routes/institute.js:13-36`). It is still the top dependency item to resolve. There is no
`npm audit` in CI to catch the next one — `docs/security/06-vulnerability-management-policy.md:27`
already flags this as a gap.

### Version-skew hazards to know before upgrading

| Upgrade | Why it is not routine |
|---|---|
| `express` 5 → anything | The SPA catch-all regex at `server/server.js:111` exists *because* of Express 5's path-to-regexp v8. Any router change needs that route re-verified. |
| `mongoose` 9 → 10 | Query-context validator behaviour is load-bearing here (controllers compensate for it). Read the migration guide against `Student.js` and `Meeting.js` conditional-required fields specifically. |
| `@mui/material` 7 → 8 | 141 files import it. There is no visual-regression suite. |
| `@mui/x-date-pickers` 8 → 9 | Adapter API has changed across MUI X majors; the `AdapterDateFns`/`date-fns` pairing is the coupling point. |
| `react-router-dom` 7 → 8 | 34 files; role-gated routing logic lives in `App.js` with no route tests. |
| `openai` 6 → 7 | 10 separate client instantiations, no shared wrapper — an SDK breaking change means 10 edits. |
| `date-fns` 4 → 5 | Coupled to `@mui/x-date-pickers` via the adapter; upgrade the pair together. |

---

# Part B — Third-party services

## B.0 At a glance

| Service | What it does here | Billed? | Configured by | Integration code |
|---|---|---|---|---|
| **MongoDB Atlas** | The only datastore. All 27 collections. | **BILLED** | `MONGODB_URI` | `server/config/db.js` |
| **Render** | Hosts the single web service (API + built SPA). | **BILLED** | Dashboard only — **no `render.yaml` in the repo** | — |
| **AWS S3** | Tier Fight posters + nightly DB snapshots. | **BILLED** | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET` | `server/services/s3.js` |
| **OpenAI** | Chat, analyses, embeddings, Whisper, poster images. | **BILLED** | `OPENAI_API_KEY` (+ model overrides) | 10 files; see §B.4 |
| **Groq** | Primary LLM for Docs-RAG answers + query classification. | **BILLED** (free tier exists) | `GROQ_API_KEY`, `GROQ_CHAT_MODEL` | `server/services/docsRagService.js`, `server/services/classifierService.js` |
| **Google Fonts** | Geist / Geist Mono / Instrument Serif web fonts. | Free | `client/public/index.html:13-18` | — |
| **CodePen asset bucket** (served from `s3-us-west-2.amazonaws.com/s.cdpn.io/24650/`) | Parallax layer images on the **login page**. Third-party, not owned by the org. | Free | Hard-coded URL | `client/src/components/MountainVistaParallax.js:214` |
| **GitHub** | Source of truth; Render deploys from `main`. | Free/paid plan | — | — |
| **npm registry** | Package installs at build time. | Free | — | — |
| **`fastdl.mongodb.org`** | `mongodb-memory-server` binary download, first test run only. | Free | — | `server/tests/exports/_setup.js` |

**Services that must have account + payment ownership transferred: MongoDB Atlas, Render, AWS,
OpenAI, Groq.** See [11 — Credentials & Access](11-credentials-and-access-handover.md) for the
rotation runbook.

---

## B.1 MongoDB Atlas — **BILLED**

**What it does.** It is the entire persistence layer. Every one of the 27 Mongoose models, the
Docs-RAG chunk corpus and its query cache, session-less auth data, and the AI usage/cost log all live
here. There is no cache tier, no search service, no queue — Atlas is the only stateful dependency.

**Configuration.** One environment variable: `MONGODB_URI`. Consumed at `server/config/db.js:5`
(`mongoose.connect(process.env.MONGODB_URI)`) and independently by ~30 standalone scripts and by the
Python highlight script.

**Integration code.** `server/config/db.js` (14 lines — connect, log the host, `process.exit(1)` on
failure). Note the failure mode: **a bad or unreachable `MONGODB_URI` kills the process at boot**
rather than starting degraded.

**Critical gotcha — the cluster is named "dev" and it IS production.** The host is
`dev.gdddmth.mongodb.net`. There is no separate development database. Local development, ad-hoc
scripts in `server/scripts/`, and the live site all point at the same data. In particular
`npm run seed` (`server/scripts/seedDatabase.js`) opens with three unconditional `deleteMany({})`
calls — **it wipes every User, every Consultant *and* every Commitment** and recreates only the
seed accounts (`seedDatabase.js:35-37`), then overwrites `LOGIN_CREDENTIALS.md` at the repo root
(`:224-226`). Do not run it "to try things out".

**What breaks if it is unavailable.** Everything. Boot fails, or in-flight requests hang until
Mongoose's buffering times out. `/api/health` (`server/server.js:99`) does **not** check the database
— it returns 200 as long as the Node process is alive, so it will happily report healthy during a
total database outage. `GET /api/docs-chat/health` is the closer thing to a readiness probe because
it reports `chunksLoaded` — but be precise about what that proves: it reads
`docsRag.getStats()`, which is purely in-memory (`server/services/docsRagService.js:195-197`), so a
non-zero `chunksLoaded` means *the boot-time load from Mongo succeeded at some point*, **not** that
the database is reachable right now. **There is no endpoint in this app that live-checks the
database.** Adding one (a `mongoose.connection.readyState` check on `/api/health`) is a cheap,
high-value first task.

**Cost/billing.** Paid Atlas cluster; tier, region and monthly spend are **UNVERIFIED** from the
repository. `docs/legal/06-subprocessor-list.md` records the region as Ireland (`eu-west-1`), while
`docs/engineering/04-deployment-runbook.md:16` records the Render service as Singapore
(`ap-southeast-1`) — if both are still true, every request pays a cross-region round trip, and
`DEPLOYMENT.md:432-440` explicitly warns that a non-colocated Atlas makes Docs-RAG cold boot take
~25 s instead of <2 s (the in-memory index pulls ~5 MB of embeddings at every boot). **Confirm the
actual regions in the Atlas and Render dashboards on day one.**

---

## B.2 Render — **BILLED**

**What it does.** Hosts one web service that serves both the API and the compiled React app. In
production `NODE_ENV=production` makes Express serve `client/build` statically with an SPA fallback
(`server/server.js:107-114`), so there is no separate frontend host and no CDN.

**Configuration.** Entirely in the Render dashboard. **There is no `render.yaml`, no Dockerfile, and
no `.github/workflows/` in the repository** — the infrastructure definition exists in exactly one
place, and it is not version-controlled. Per `docs/engineering/04-deployment-runbook.md:26-27` the
build command is `npm run build` and the start command is `npm start` from the repo root; that
document also mentions `npm run install:all && npm run build` at line 50, so the exact configured
build command is **UNVERIFIED** — read it off the dashboard and, ideally, commit a `render.yaml`.

All environment variables listed in Part C are set here.

**Deployment model.** Auto-deploy on push to `main`. No CI gate, no staging environment, no automated
tests before deploy. Rollback is Render dashboard → Deploys → redeploy a previous commit (~3 min).

**What breaks if it is unavailable.** The whole product. There is no failover.

**Cost/billing.** Paid Render plan; tier and spend **UNVERIFIED**. Two operational notes worth
knowing: (a) if the service is on a plan that sleeps when idle, the first request after a sleep also
pays the Docs-RAG index load; (b) the service is a **single Node process** — this is why the schedule
importer is rate-limited (CPU-heavy SheetJS parsing on the same thread that serves every other
request) and why the cron jobs run in-process rather than as separate workers. **If you ever scale to
more than one instance, both cron jobs will run once per instance** — the birthday notifier is
idempotent, but the nightly S3 snapshot would duplicate work and overwrite itself.

---

## B.3 AWS S3 — **BILLED**

**What it does.** Two unrelated jobs, both through one thin helper:

1. **Tier Fight posters.** Generated PNGs are uploaded under
   `tier-images/YYYY/MM/DD/<timestamp>-<theme>.png` (`server/controllers/tierController.js:220-226`)
   and served back to the browser through 1-hour presigned URLs (`:302-327`).
2. **Nightly database snapshots.** `server/services/dbSnapshot.js` dumps **every non-system
   collection** as gzipped JSON to `db-snapshots/YYYY-MM-DD/<collection>.json.gz` plus a
   `_manifest.json` with per-collection counts and byte sizes. Scheduled at 00:30 Asia/Dubai
   (`server/server.js:157-170`). Also runnable on demand:
   `cd server && node scripts/runDbSnapshot.js`.

**Configuration.** Four environment variables, all read in `server/services/s3.js`:

| Var | Line | Note |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | `s3.js:19,26` | Static IAM user credentials (no role assumption). |
| `AWS_SECRET_ACCESS_KEY` | `s3.js:19,27` | |
| `AWS_REGION` | `s3.js:13` | Defaults to `me-central-1` (UAE) if unset. |
| `S3_BUCKET` | `s3.js:14` | Defaults to `''`, which disables S3 entirely. |

**Graceful degradation is built in.** `isEnabled()` (`s3.js:35-37`) returns false unless all of key,
secret and bucket are present. When false: the nightly cron is **never registered** and the server
logs `[db-snapshot] S3 not configured — nightly backup disabled` (`server/server.js:169`), and
poster generation still works but the image is only returned inline as a data URL and is not
persisted (`tierController.js:223-233` — the same inline fallback also fires when the upload itself
throws).

**What breaks if it is unavailable.** Nothing user-facing goes down. You silently lose the nightly
backup — which is the *only* automated backup in the system — and historical poster thumbnails 404.
**The dangerous failure is the silent one:** nothing alerts when snapshots stop. There is no
monitoring, and no code path anywhere lists or restores snapshots (`s3.listObjects` is defined at
`s3.js:71-82` and exported at `s3.js:84`, but has **no caller** anywhere in the repo — the
"snapshot browser" its comment refers to does not exist).
Restoring is a manual S3-download-and-`mongoimport` job. **Verify a recent snapshot exists in the
bucket on day one**, because nothing else will tell you.

**Cost/billing.** AWS account with an IAM user. Storage volume is small (a few thousand documents,
gzipped) so cost is dominated by the account minimum, but the snapshots have **no lifecycle policy in
code** — retention is whatever is configured on the bucket, **UNVERIFIED**. Left unbounded, daily
full dumps accumulate forever.

> `docs/legal/06-subprocessor-list.md` explicitly states the platform does **not** use cloud object
> storage. **That is now wrong** — S3 was added after that document was written, and it stores a
> complete copy of every collection, including personal data on students (some of them minors). The
> sub-processor list and the DPA/retention docs need updating.

---

## B.4 OpenAI — **BILLED**

The most widely used external service, and the largest variable cost.

**Configuration.**

| Var | Default in code | Where |
|---|---|---|
| `OPENAI_API_KEY` | none — required | 10 files |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` | `server/config/docsRagConfig.js:28`, `server/services/classifierService.js:95` |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | `server/config/docsRagConfig.js:27`, `server/scripts/ingestProgramDocs.js:34` |

Note the asymmetry: only the Docs-RAG and classifier paths honour `OPENAI_CHAT_MODEL`. **Every other
feature hard-codes `gpt-4o-mini` in source.**

**Every touchpoint:**

| Feature | Endpoint | Model | Code |
|---|---|---|---|
| Dashboard / student / team / consultant AI analysis | `POST /api/ai/analysis`, `/student-analysis`, `/team-analysis`, `/consultant-analysis` | `gpt-4o-mini` (hard-coded) | `server/services/aiService.js:379` |
| Tracker chatbot (streaming, tool-calling, max 6 tool rounds) | `POST /api/chat/stream` | `gpt-4o-mini` (hard-coded) | `server/services/chatService.js:28` |
| Voice input → text | `POST /api/chat/transcribe` | `whisper-1` | `server/controllers/chatController.js:142` |
| Chat route classifier (**fallback** — Groq is primary) | `POST /api/chat/classify` | `OPENAI_CHAT_MODEL` | `server/services/classifierService.js:95` |
| Docs-RAG query embedding (**every uncached query**) | `POST /api/docs-chat` | `OPENAI_EMBEDDING_MODEL` | `server/services/docsRagService.js` |
| Docs-RAG answer generation (**fallback** — Groq is primary) | `POST /api/docs-chat` | `OPENAI_CHAT_MODEL` | `server/services/docsRagService.js:507` (model), `:546` (fallback swap) |
| Commitment AI analysis | `GET /api/commitments/ai-analysis` | `gpt-4o-mini` | `server/controllers/commitmentController.js:798` |
| Meeting AI analysis | `GET /api/meetings/ai-analysis` | `gpt-4o-mini` | `server/controllers/meetingController.js:499` |
| Hourly Tracker AI analysis | `GET /api/hourly/ai-analysis` | `gpt-4o-mini` | `server/controllers/hourlyController.js:936+` |
| **Tier Fight poster generation** | `POST /api/tiers/generate-image` | **`gpt-image-2`**, 1536×1024, quality `medium` | `server/controllers/tierController.js:101-103` |
| Corpus ingestion (build-time, not request-path) | `npm run ingest:docs[:force]` | `OPENAI_EMBEDDING_MODEL` | `server/scripts/ingestProgramDocs.js` |

**Integration shape — and a maintenance smell.** There is **no shared OpenAI client module**. Ten
files each do their own `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`, most behind a
lazy-singleton guard that throws `'OPENAI_API_KEY is not configured'` on first use
(`aiService.js:7-13`, `meetingController.js:13-16`, `commitmentController.js:11-14`,
`hourlyController.js:60-61`). Only `docsRagService.js:27` and `classifierService.js:25` share an
`https.Agent({ keepAlive: true, maxSockets: 10 })`; everything else opens fresh sockets. If you ever
need to add a proxy, a timeout, retry policy, or an org header, you will be editing ten files.

**Cost tracking is built in — but it has a hole.** Six modules write an `AIUsage` row
(`server/models/AIUsage.js`) with user, role, team, organization, model, prompt/completion/total
tokens and computed USD cost, tagged `type: 'analysis' | 'chat' | 'image'`: `aiController.js`,
`commitmentController.js:821`, `meetingController.js:522`, `hourlyController.js` (8 call sites),
`tierController.js:257` and `chatService.js:616`. **The entire Docs-RAG path writes nothing** —
`server/services/docsRagService.js` and `server/services/classifierService.js` never import
`AIUsage`, so every query embedding, every Docs-RAG answer (Groq *or* the OpenAI fallback) and every
LLM classification is invisible to the in-app AI Usage dashboard. Prices are **hard-coded constants
that will drift from reality**:

- `server/services/aiService.js:373` — `'gpt-4o-mini': { input: 0.15, output: 0.60 }` per 1M tokens.
- `server/controllers/tierController.js:48` — `IMAGE_COST_USD = 0.041` per poster
  (gpt-image-2 medium 1536×1024).
- `DEPLOYMENT.md:417` — embeddings quoted at $0.02/M tokens.

Admins can read the aggregate at `GET /api/ai/usage` (`server/routes/ai.js:26`, admin-only). **Treat
these numbers as an internal accounting estimate, not a bill.** The authoritative figure is the
OpenAI dashboard; reconcile the two before trusting either. Actual monthly spend is **UNVERIFIED**.

**What breaks if OpenAI is unavailable or the key is missing/over quota.**

- All AI analysis endpoints return an error; controllers special-case the missing-key message and
  return a clean response (`meetingController.js:538`, `commitmentController.js:837`).
- The tracker chatbot fails.
- Voice input fails; a 429 from OpenAI is translated into a 502 with a user-friendly message
  (`chatController.js:155-161`).
- Tier Fight poster generation fails.
- **Docs-RAG breaks even when Groq is healthy**, because the *query embedding* is always OpenAI. Groq
  only replaces the generation step, not retrieval. There is no embedding fallback.
- The route classifier silently degrades: it catches everything and returns `route: 'tracker'` — at
  `classifierService.js:75` for an unexpected model reply, and at `:122-126` when Groq *and* OpenAI
  both throw (that path deliberately does **not** cache, so the next call retries). The chat drawer
  keeps working but ambiguous docs questions get answered by the wrong backend.
- **Everything non-AI is unaffected** — trackers, exports, student database, institute, dashboards.

**Cost-control levers that exist today:** none for AI. Neither `/api/ai/*` nor `/api/chat/*` nor
`/api/tiers/generate-image` is rate-limited (the only two limiters in the app cover exports and
schedule imports). `/api/chat/*` has **no role gate at all** — `server/routes/chat.js:17` applies
only `protect`, by explicit product decision. Any authenticated user can generate unbounded LLM spend.
The only spend guards are role gates on the analysis endpoints and admin-only poster generation.
Set a hard usage limit in the OpenAI dashboard.

---

## B.5 Groq — **BILLED** (has a free tier)

**What it does.** Primary LLM for two paths, with OpenAI as the fallback in both:

1. **Docs-RAG answer generation** — `server/services/docsRagService.js`. Model
   `GROQ_CHAT_MODEL`, default `llama-3.3-70b-versatile` (`config/docsRagConfig.js:29`). Chosen for
   latency: answers stream token-by-token into the chat drawer.
2. **Query classification** — `server/services/classifierService.js:81`, deciding tracker-vs-docs
   when the client-side keyword rules are ambiguous. `temperature: 0`, `max_tokens: 3` — it returns a
   single word. Results are cached in-process for 1 hour.

**Configuration.**

| Var | Default | Meaning |
|---|---|---|
| `GROQ_API_KEY` | none | Obtain at console.groq.com. |
| `GROQ_CHAT_MODEL` | `llama-3.3-70b-versatile` | |
| `LLM_PRIMARY` | `groq` | Set to `openai` to bypass Groq entirely (`docsRagConfig.js:30`). |
| `LLM_FALLBACK` | `openai` | Used when the primary errors (`docsRagConfig.js:31`). |

**The fallback is a genuine pre-flight, not a retry.** `chooseGenerator()`
(`docsRagService.js:523-547`) starts the Groq stream and **awaits the first token before writing any
bytes to the client**. If the SDK throws during setup — bad key, network, rate limit — it swaps to
OpenAI cleanly. Once the first token lands it commits to that provider for the rest of the stream, so
a mid-stream Groq failure will truncate an answer rather than transparently recover.

**What breaks if Groq is unavailable.** Nothing, provided `OPENAI_API_KEY` is set and has quota:
Docs-RAG answers and classification transparently move to OpenAI, at higher cost and (usually) higher
latency. If **both** providers are down, `/api/docs-chat` fails and the classifier returns
`route: 'tracker'` for everything.

**Cost/billing.** Usage-based with a free tier. Groq calls are **not** written to `AIUsage`, because
neither `docsRagService.js` nor `classifierService.js` imports the model at all (§B.4) — so **Groq
spend is invisible inside the app**, and so is the OpenAI spend on those same two paths. Check the
Groq console directly. Actual spend **UNVERIFIED**.

---

## B.6 Google Fonts — free, but a real runtime dependency

`client/public/index.html:13-18` preconnects to `fonts.googleapis.com` / `fonts.gstatic.com` and
loads **Geist**, **Geist Mono** and **Instrument Serif**. If Google Fonts is blocked (corporate
proxy, some networks) or slow, the UI renders in fallback fonts — cosmetic, not functional. Two
notes: (a) it is an unavoidable third-party request on **every** page load, which matters for the
privacy documentation; (b) there is a **font mismatch worth knowing about**: `CLAUDE.md` says the
theme uses "Inter", and for the base MUI theme that is still literally true —
`client/src/theme.js:49` sets `fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'`.
But Inter is **not** among the families loaded above, so on a machine without Inter installed the
base theme silently falls through to Roboto/Helvetica/Arial. The screens that actually look like
the product (dashboards, trackers) sidestep this by overriding the stack with a Geist-first one at
`client/src/utils/trackerTheme.js:10` and `client/src/components/dashboard/DashboardShell.js:12`.
Either load Inter or change `theme.js:49` to the Geist stack — today the two disagree.

## B.7 CodePen asset bucket (`s3-us-west-2.amazonaws.com/s.cdpn.io/24650/`) — undeclared, third-party, on the login page

`client/src/components/MountainVistaParallax.js:214` builds background-image URLs as:

```js
const url = `https://s3-us-west-2.amazonaws.com/s.cdpn.io/24650/${layer.image}.png`;
```

That component is rendered by `client/src/pages/Login.js:88` — i.e. on the **login screen, the first
page every user sees**. The images are hotlinked from a CodePen user's asset bucket (account
`24650`) that the organisation does not control. If those assets are removed or the bucket policy
changes, the login page's parallax background silently disappears. It also leaks a request to a
third party before authentication. **Recommendation: download the PNGs into `client/public/` and
serve them locally.** This dependency appears in no existing documentation.

## B.8 `fastdl.mongodb.org` — dev/test only

`mongodb-memory-server` downloads a real `mongod` binary on first use and caches it. The first
`npm test` on a fresh machine (or in any future CI container) needs outbound access to
`fastdl.mongodb.org`, and will appear to hang while downloading. Not a production dependency.

## B.9 npm registry & GitHub

`registry.npmjs.org` at install/build time — an outage blocks deploys, not the running service.
GitHub hosts the private repo (`viditkbhatnagar/Consultant_Progress_Tracker_LUC`) and is the deploy
trigger for Render; if GitHub is down you cannot ship, but the live service is unaffected. **Both
need access transferred** — see [11 — Credentials & Access](11-credentials-and-access-handover.md).

---

# Part C — Environment variable → service map

Every `process.env.*` reference found in `server/`, with what it configures. Names only — **no values
appear in this document or in any handover document**.

| Variable | Service | Required? | Default in code | Read at |
|---|---|---|---|---|
| `MONGODB_URI` | MongoDB Atlas | **Yes** — process exits on failure | none | `server/config/db.js:5` (+ ~30 scripts, + the Python script) |
| `JWT_SECRET` | — (internal) | **Yes** | none | `server/middleware/auth.js`, `server/models/User.js`, `server/services/realtime.js:38` |
| `JWT_EXPIRE` | — (internal) | Yes | none | `server/models/User.js` |
| `NODE_ENV` | — | No | undefined | Gates prod static serving (`server.js:107`), disables cron, the drift monitor and Socket.IO under `test` (`server.js:149,157`, `realtime.js:17`) |
| `PORT` | Render | No | **`5000`** | `server/server.js:119` — **gotcha: the app's own default is 5000, not 5001.** With no `server/.env`, the client (which expects 5001 in dev) cannot reach it. |
| `OPENAI_API_KEY` | OpenAI | For all AI features | none | 10 files |
| `OPENAI_CHAT_MODEL` | OpenAI | No | `gpt-4o-mini` | `docsRagConfig.js:28`, `classifierService.js:95` |
| `OPENAI_EMBEDDING_MODEL` | OpenAI | No | `text-embedding-3-small` | `docsRagConfig.js:27`, `ingestProgramDocs.js:34` |
| `GROQ_API_KEY` | Groq | No (falls back to OpenAI) | none | `docsRagService.js:43-55`, `classifierService.js:41-52`; also surfaced as `groqConfigured` on the health probe (`routes/docsChat.js:69`) |
| `GROQ_CHAT_MODEL` | Groq | No | `llama-3.3-70b-versatile` | `docsRagConfig.js:29`, `classifierService.js:81` |
| `LLM_PRIMARY` | Groq/OpenAI | No | `groq` | `docsRagConfig.js:30` |
| `LLM_FALLBACK` | Groq/OpenAI | No | `openai` | `docsRagConfig.js:31` |
| `DOCS_RAG_ENABLED` | — (kill switch) | No | `true` | `docsRagConfig.js:18`, `middleware/docsRagEnabled.js:14` |
| `DOCS_RAG_TOPK` | — | No | `5` | `docsRagConfig.js:19` |
| `DOCS_RAG_MIN_SCORE` | — | No | `0.35` | `docsRagConfig.js:20` |
| `DOCS_RAG_EXACT_MATCH_THRESHOLD` | — | No | `0.82` | `docsRagConfig.js:22` |
| `DOCS_RAG_CACHE_TTL_SECONDS` | — | No | `86400` (24 h) | `docsRagConfig.js:25` |
| `AWS_ACCESS_KEY_ID` | AWS S3 | No (S3 self-disables) | none | `server/services/s3.js:19,25` |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 | No | none | `server/services/s3.js:19,26` |
| `AWS_REGION` | AWS S3 | No | `me-central-1` | `server/services/s3.js:13` |
| `S3_BUCKET` | AWS S3 | No (empty ⇒ disabled) | `''` | `server/services/s3.js:14` |
| `JWT_REFRESH_EXPIRE` | — | Documented, **no code reference found** | — | Listed in `server/.env.example` and `docs/engineering/05`; **there is no refresh-token flow in the code.** |
| `ENV_PATH`, `EXCEL_PATH`, `YEAR`, `WIPE_YEAR`, `DRY_RUN` | — | Script-only | varies | One-off scripts in `server/scripts/` / `server/utils/`; never read by the server. |

**Client-side:** despite `CLAUDE.md` and `docs/engineering/05-environment-and-secrets.md:27` both
claiming a `REACT_APP_API_URL` variable, **no `REACT_APP_*` variable is read anywhere in
`client/src/`**. The API base is derived purely from `NODE_ENV`:

```js
// client/src/utils/constants.js:157
export const API_BASE_URL = process.env.NODE_ENV === 'production'
    ? '/api'
    : 'http://localhost:5001/api';
```

Both docs are stale on this point. A `client/.env` file is therefore not needed, and setting
`REACT_APP_API_URL` will have no effect.

> ### Security note on `server/.env.example`
> The committed template at `server/.env.example` contains a **real-looking MongoDB connection string
> with an embedded username and password**, plus a default `JWT_SECRET` value. This document does not
> reproduce them. Treat those credentials as compromised (the file is in git history, so deleting the
> file does not remove them), rotate the database user, and replace the template with placeholders.
> `docs/engineering/05-environment-and-secrets.md:69-84` already flags this as a P0; it is still
> unfixed as of this writing.

---

# Part D — Failure matrix

What actually happens when each dependency is unavailable. Useful during an incident.

| Down / misconfigured | Blast radius | Symptom | Degrades gracefully? |
|---|---|---|---|
| MongoDB Atlas | **Total** | Boot exits (`db.js:9-10`), or requests hang. `/api/health` still returns 200 — it does not check the DB. | No |
| Render | **Total** | Site unreachable. No failover. | No |
| `OPENAI_API_KEY` missing/quota | All AI features **incl. Docs-RAG retrieval** (query embedding is OpenAI-only) | Analysis/chat/poster endpoints error; classifier silently defaults to `tracker` | Partially — the rest of the app is untouched |
| Groq down | Docs-RAG + classifier only | Transparent pre-flight swap to OpenAI; higher cost/latency | **Yes** (`docsRagService.js:523-547`) |
| Both LLM providers down | Docs-RAG + chat | `/api/docs-chat` errors; classifier returns `tracker` | Partially |
| S3 unavailable / unconfigured | Nightly backups + poster history | **Silent.** Cron is never registered; a warning is logged once at boot | Yes — dangerously so; nothing alerts |
| Docs-RAG index fails to load at boot | Docs chatbot | `GET /api/docs-chat/health` returns 503 with `chunksLoaded: 0`; boot is **not** blocked (`server.js:135-144`) | Yes — admin re-triggers Force re-ingest from the admin dashboard (the old `/admin/docs-rag` URL now redirects to `/admin/dashboard?section=ai-usage&tab=docs-rag`, `client/src/App.js:273-276`) |
| `DOCS_RAG_ENABLED=false` | Docs chatbot + program PDFs | Deliberate kill switch: 503 on `/api/docs-chat/*` **and** on `/program-docs*` static routes, in lockstep, mounted *before* `protect` so it never leaks 401-vs-403 | Yes, by design (`middleware/docsRagEnabled.js`) |
| Socket.IO fails to init | Live dashboard refresh | Emit helpers become no-ops; REST API unaffected | Yes (`realtime.js:16-31`) |
| Google Fonts blocked | Cosmetic | Fallback fonts | Yes |
| `s.cdpn.io` gone | Login page background | Parallax layers blank | Yes (cosmetic) |
| npm registry / GitHub down | Deploys only | Cannot build or ship | Live service unaffected |

> **Correction to existing docs:** `DEPLOYMENT.md:492-495` states that `DOCS_RAG_ENABLED` "is loaded
> but not enforced as a kill-switch yet". That is **out of date** — `server/middleware/docsRagEnabled.js`
> enforces it on both the chat routes and the static PDF routes, and reads `process.env` live on every
> request so a Render env change plus restart is sufficient.

---

# Part E — Billing & account-ownership transfer checklist

Do these before the outgoing developer's access is revoked. Each is a service that will keep charging
— or keep running under a personal account — if it is missed.

| # | Service | What must transfer | Verify by |
|---|---|---|---|
| 1 | **MongoDB Atlas** | Organisation/project ownership, billing contact, payment method. Create a *new* database user for the new owner; rotate/remove the one embedded in `server/.env.example`. Confirm the cluster region and backup settings. | Log in as the new owner; confirm you can view billing and Network Access |
| 2 | **Render** | Team/service ownership, payment method, and the GitHub connection (it is authorised against a specific GitHub account). Export the full env-var list from the dashboard **before** anything is revoked — it exists nowhere else. | New owner can view env vars and trigger a manual deploy |
| 3 | **AWS** | Account root or org-member ownership, billing, and the IAM user behind `AWS_ACCESS_KEY_ID`. Rotate that key. Check the bucket's lifecycle/retention policy — snapshots are unbounded in code. | Run `cd server && node scripts/runDbSnapshot.js` and confirm new objects appear under `db-snapshots/` |
| 4 | **OpenAI** | Organisation ownership, billing, and API-key rotation. **Set a hard monthly usage limit** — nothing in the app rate-limits AI spend. | New key works end-to-end: an AI analysis, a chat turn, and a Docs-RAG answer |
| 5 | **Groq** | Account ownership, billing, key rotation. Note Groq spend is **not** visible in the app's own AI-usage dashboard. | Ask a program-docs question and confirm the answer streams |
| 6 | **GitHub** | Repository ownership/admin transfer; re-authorise the Render integration under the new owner. | New owner can push to `main` and see the deploy fire |
| 7 | **Google Fonts / CodePen CDN** | Nothing to transfer (no account). Optional hardening: self-host both. | — |

**After every rotation:** update the Render env vars, restart the service, then re-verify
`GET /api/health` (200) **and** `GET /api/docs-chat/health` (200 with a non-zero `chunksLoaded`).
Neither endpoint live-checks Mongo — `/api/health` only proves the process is up, and
`/api/docs-chat/health` reads an in-memory counter (§B.1) — so a non-zero `chunksLoaded` proves only
that the boot-time read from Mongo succeeded *on that boot*. To actually confirm the database, log
in through the UI and load a data page.

---

# Part F — Where the existing `docs/` set is wrong about dependencies

The pre-existing documentation (last updated 2026-04-26) predates ~207 commits. Corrections relevant
to this document:

| Existing doc | Claim | Reality |
|---|---|---|
| `docs/legal/06-subprocessor-list.md` | "The Platform does **not** use … Cloud object storage (S3, GCS, Cloudinary)." | **Wrong.** AWS S3 stores Tier Fight posters and a nightly gzipped dump of **every collection**, including student personal data. S3 must be added to the sub-processor list, DPA and retention schedule. |
| `docs/engineering/05-environment-and-secrets.md` | Env table lists only `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_*`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `GROQ_CHAT_MODEL`. | **Incomplete.** Missing all four `AWS_*`/`S3_BUCKET` vars, `OPENAI_CHAT_MODEL`, `OPENAI_EMBEDDING_MODEL`, `LLM_PRIMARY`, `LLM_FALLBACK`, and the five `DOCS_RAG_*` vars. |
| `docs/engineering/05-environment-and-secrets.md:27` | Client reads `REACT_APP_API_URL`. | **Wrong.** No `REACT_APP_*` variable is read anywhere in `client/src`; the base URL is derived from `NODE_ENV` at `client/src/utils/constants.js:157`. |
| `DEPLOYMENT.md:492-495` | `DOCS_RAG_ENABLED` "is loaded but not enforced as a kill-switch yet." | **Wrong now.** `server/middleware/docsRagEnabled.js` enforces it on chat routes and static PDF routes. |
| `DEPLOYMENT.md` §"Backend Deployment" | Documents Heroku / DigitalOcean / PM2, and Vercel / Netlify / S3+CloudFront for the frontend. | **Obsolete.** Production is a single Render web service serving both. Only the "Docs RAG — Render Deploy Cutover" section (line 407 onward) reflects reality. |
| `CLAUDE.md` | "Charts: Recharts (`recharts`). Heatmap: `react-calendar-heatmap`." | **Wrong.** `recharts` is **not installed** — charts are Apache ECharts 6 via `echarts-for-react`. `react-calendar-heatmap` is installed but has zero imports. Only stale comments mentioning recharts remain. |
| `CLAUDE.md` | "Theme … Inter font". | **Half true, and the half that is true is a bug.** `client/src/theme.js:49` really does declare Inter — but `client/public/index.html:13-18` loads only Geist, Geist Mono and Instrument Serif, so Inter is never fetched and the base theme falls back to Roboto/Helvetica/Arial. The dashboard/tracker themes override the stack with Geist (`utils/trackerTheme.js:10`, `components/dashboard/DashboardShell.js:12`). See §B.6. |
| `docs/security/06-vulnerability-management-policy.md:27,53` | `npm audit` run manually, weekly. | Accurate as *policy*, but there is no CI and no evidence of a cadence. `xlsx@0.18.5` carries known advisories today (§A.6). |

---

## Related documents

- [00 — Start Here](00-START-HERE.md) — the map of this pack
- [01 — System Architecture](01-system-architecture.md) — where these packages sit in the design
- [02 — Application Workflows](02-application-workflows.md) — the features these services power
- [03 — Database Schema](03-database-schema.md) — the 27 collections Atlas holds
- [04 — Deployment & Infrastructure](04-deployment-and-infrastructure.md) — Render build/start config
- [05 — Environment Setup](05-environment-setup.md) — installing all of the above locally
- [06 — API Reference](06-api-reference.md) — the endpoints that call these services
- [07 — Roles & Permissions](07-roles-and-permissions.md) — who can trigger billed AI calls
- [09 — Operations, Backup & Recovery](09-operations-backup-recovery.md) — the S3 snapshot restore path
- [10 — Known Issues & Roadmap](10-known-issues-and-roadmap.md) — unused packages, CRA, `xlsx`, no CI
- [11 — Credentials & Access Handover](11-credentials-and-access-handover.md) — the rotation runbook for Part E
