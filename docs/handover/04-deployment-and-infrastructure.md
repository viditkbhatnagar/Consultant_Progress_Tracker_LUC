# 04 — Deployment & Infrastructure

**What this document is.** Everything about how the Sales Tracker gets from a git commit to a running
production system: the Render web service and its build/start commands, how one Express process ends
up serving both the API and the React single-page app, the complete list of environment variables the
service needs, the MongoDB Atlas cluster (whose host is literally named `dev` but *is* production), the
AWS S3 bucket that holds nightly database snapshots and Tier Fight poster images, the two cron jobs
that run inside the web process, and step-by-step runbooks for deploying, verifying a deploy actually
landed, and rolling back. Everything here was checked against the code in this repository on
**5 September 2026**; where a fact lives only in a vendor dashboard and cannot be read from the code,
it is explicitly marked **UNVERIFIED**.

---

## 1. Topology at a glance

```
                    push to main
                         │
                         ▼
   GitHub  ──────►  Render Web Service  ──────────────────┐
   (private)        (single Node process)                 │
                         │                                │
      ┌──────────────────┼──────────────────┐             │
      │                  │                  │             │
      ▼                  ▼                  ▼             ▼
  Express API      React build        node-cron jobs   Socket.IO
  /api/*           client/build/      · 00:30 snapshot  /socket.io
                   (SPA fallback)     · 08:00 birthdays
      │                                    │
      ▼                                    ▼
  MongoDB Atlas                        AWS S3 bucket
  cluster host "dev"                   · db-snapshots/
  (IS production)                      · tier-images/
      ▲
      │  also: OpenAI + Groq (outbound HTTPS only)
```

| Concern | Reality |
|---|---|
| Hosting | **One** Render Web Service. Serves API *and* frontend from the same process and origin. |
| Deploy trigger | Auto-deploy on push to `main`. No CI, no gate, no staging. |
| Infrastructure-as-code | **None in the repo.** No `render.yaml`, `Dockerfile`, `Procfile`, or `.github/workflows/`. |
| Database | MongoDB Atlas, single cluster, single database. No separate dev/staging DB. |
| Object storage | AWS S3, one private bucket, accessed only from the server via `server/services/s3.js`. |
| Real-time | Socket.IO attached to the same HTTP server (`server/server.js:127`). |
| Background jobs | `node-cron` **inside the web process** — not a separate Render Cron Job. |
| Frontend hosting | None separate. There is no Vercel/Netlify/CDN in front. |

> **Verified absence of IaC.** `find . -name "render*" -o -name "Dockerfile*" -o -name "Procfile"`
> returns nothing, and there is no `.github/` directory. This is confirmed, not assumed.

---

## 2. The Render web service

### 2.1 The single biggest infrastructure risk: the config lives only in a dashboard

Every production setting — build command, start command, branch, region, instance size, health-check
path, and **every environment variable including all secrets** — exists *only* inside the Render
dashboard for the service. None of it is in this repository, so:

- You cannot diff it, review it, or see who changed what and when.
- If the Render account is lost or the service is accidentally deleted, the configuration is gone and
  must be reconstructed from this document plus the secret values (which live nowhere else either).
- A new engineer cannot answer "what is actually set in production?" without dashboard access.

**Action for the incoming owner, in your first week:**

1. Get Owner (not member) access to the Render account — see
   [11 — Credentials & Access](11-credentials-and-access-handover.md).
2. Screenshot or transcribe the service's Settings page and Environment page (variable **names** and
   whether each is set — never the values) into your own secure notes.
3. Consider committing a `render.yaml` Blueprint so the service definition is version-controlled.
   Note that a Blueprint still stores secret values outside the repo (`sync: false`), so this is safe.

### 2.2 Service settings

| Setting | Value | Confidence |
|---|---|---|
| Service type | Web Service (Node runtime) | High — the app is a long-running HTTP server |
| Repository | `viditkbhatnagar/Consultant_Progress_Tracker_LUC` (private) | Verified — `git remote -v` |
| Branch | `main` | Verified — stated in `00-START-HERE.md:5` and `DEPLOYMENT_GUIDE.md:36` |
| Auto-deploy | On push to `main` | High |
| Root directory | *(empty — repo root)* | From `DEPLOYMENT_GUIDE.md:37` |
| Build command | `npm run install:all && npm run build` | From `DEPLOYMENT_GUIDE.md:39` — **UNVERIFIED** against the live dashboard |
| Start command | `npm start` | From `DEPLOYMENT_GUIDE.md:40` — matches `package.json:11` `"start": "cd server && npm start"` |
| Public URL | `https://team-progress-tracker.onrender.com` | From `DEPLOYMENT_GUIDE.md:64` — **UNVERIFIED** (may have a custom domain now) |
| Region | Singapore per `docs/engineering/04-deployment-runbook.md` | **UNVERIFIED and possibly wrong** — see §5.3 |
| Instance type | **UNVERIFIED** — `DEPLOYMENT_GUIDE.md:41` says `Free`, but a Free instance sleeps after 15 min idle, which would break the 00:30 and 08:00 cron jobs. If backups are actually running, the service is on a paid always-on plan. |
| Health check path | **UNVERIFIED** — `GET /api/health` is the obvious candidate (`server/server.js:99`) |
| Node version | **Not pinned anywhere.** See §2.5. |

### 2.3 The build command chain

```
Render build command:  npm run install:all && npm run build
                            │                      │
   package.json:9 ──────────┘                      └────── package.json:10
```

**`npm run install:all`** (`package.json:9`) expands to:

```
npm install
  && cd server  && npm install
  && cd ../client && npm install
  && cd ..
  && ( pip3 install -r server/requirements.txt
       || python3 -m pip install -r server/requirements.txt
       || echo 'pip install failed — Python highlight script will not run; see DEPLOYMENT.md' )
```

- The root `npm install` only installs `concurrently` (a dev dependency used by `npm run dev`).
- The `pip3` step installs `PyMuPDF`, `pymongo`, `python-dotenv` (`server/requirements.txt`) for
  `server/scripts/generateHighlightedPdfs.py`. **On Render this almost certainly fails** — a Node
  runtime image has no guaranteed `pip3`. That is *fine*: the trailing `|| echo` swallows the failure
  so the build still succeeds, and the highlight script is only ever run locally during a docs
  re-ingest. Do not "fix" this by making it fatal.

**`npm run build`** (`package.json:10`) expands to:

```
cd client && npm install && npm run build     →  react-scripts build  →  client/build/
```

Note the client `npm install` runs **twice** (once from `install:all`, once from `build`). Harmless,
just slow — the second is a near no-op cache hit.

**What the build produces:** `client/build/` containing `index.html`, `asset-manifest.json`, and
content-hashed bundles under `static/js/` and `static/css/` (e.g. `main.d75d53dc.js`,
`main.e6c13ad2.css`). It also copies everything in `client/public/` — which includes ~84 MB of program
PDFs and highlight assets (see §3.3).

**Build-time gotchas**

| Gotcha | Detail |
|---|---|
| CRA forces `NODE_ENV=production` during `react-scripts build` | So the client's `API_BASE_URL` resolves to the relative `'/api'` (`client/src/utils/constants.js:157-159`). You do **not** need `REACT_APP_API_URL` on Render. |
| Client env vars are baked in at build time | Any `REACT_APP_*` change requires a **rebuild**, not a restart. |
| Source maps are shipped | `client/build/static/js/*.map` are generated and served publicly. Setting `GENERATE_SOURCEMAP=false` on Render would stop leaking readable frontend source. Not done today. |
| `<title>` is still `React App` | `client/build/index.html` — cosmetic, but it is what shows in the browser tab in production. |
| Repo size | 84 MB of PDFs/PNGs under `client/public/program-docs*` are committed to git (16 PDFs tracked). This lengthens clone and build time on every deploy. |

### 2.4 The start command

```
npm start  →  package.json:11  →  cd server && npm start  →  server/package.json:7  →  node server.js
```

Boot sequence, in order (`server/server.js`):

| Line | What happens |
|---|---|
| `:1` | `dotenv.config()` — reads `server/.env` **if present**. On Render there is no `.env`; the values come from the real process environment, which `dotenv` leaves alone. |
| `:14` | `connectDB()` — `mongoose.connect(process.env.MONGODB_URI)`. On failure it logs and calls `process.exit(1)` (`server/config/db.js:9`), so a bad URI is a crash-loop, not a degraded boot. |
| `:20-25` | `helmet()` with `contentSecurityPolicy: false` and `crossOriginResourcePolicy: 'same-site'`. |
| `:28` | `cors()` with **no options** — allows all origins. Acceptable only because the SPA is same-origin; it is still a hardening gap. |
| `:35-53` | 19 API route groups mounted under `/api/*`. |
| `:59-96` | Three auth-gated static mounts for program PDFs (see §3.3). |
| `:99` | `GET /api/health`. |
| `:107-114` | **Production-only** static SPA serving (see §3). |
| `:117` | Error handler. |
| `:119-123` | `app.listen(process.env.PORT || 5000)`. |
| `:127` | Socket.IO attached to the same HTTP server. |
| `:135` | Docs RAG index loaded from Mongo into memory (non-blocking). |
| `:149-152` | Drift monitor started (`NODE_ENV !== 'test'`). |
| `:157-187` | Two `node-cron` jobs registered (`NODE_ENV !== 'test'`). |

**Expected first log lines on a healthy Render boot:**

```
MongoDB Connected: <cluster-host>
Server running in production mode on port <PORT>
[realtime] socket.io attached
[db-snapshot] nightly backup scheduled — 00:30 Asia/Dubai
[birthdays] student birthday reminders scheduled — 08:00 Asia/Dubai
Docs RAG: loaded 215 chunks (N questions in exact-match index) in Xms
```

(215 is the corpus size at the time of writing — recorded in `CLAUDE.md:170`, not a constant in the
code. Any non-zero number is healthy; **zero** is not, and makes `/api/docs-chat/health` return 503.)

If you see `[db-snapshot] S3 not configured — nightly backup disabled` instead, **there are no
application-level backups running**. See §6.4.

### 2.5 Node version is not pinned — a live upgrade risk

There is **no** `engines` field in any `package.json`, no `.nvmrc`, and no `.node-version`. Render
therefore picks its own default Node version, and that default changes over time. When Render bumps
it, your next deploy runs on a Node version nobody chose.

This matters because the stack has real floors: **Mongoose 9** and **Express 5** both require modern
Node (18+/20+), and native deps in the AWS SDK and `tiktoken` are version-sensitive.

**Recommended first-week fix** — pin it deliberately, matching whatever Render currently reports in
the build log:

```jsonc
// package.json
"engines": { "node": ">=20 <25" }
```

Local development is currently on Node v24.10.0 / npm 11.6.0 (this workstation). The Render version
is **UNVERIFIED** — read it from the top of any build log.

---

## 3. How Express serves the SPA in production

### 3.1 The mechanism

```js
// server/server.js:107-114
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));

    // All other GET requests not handled by API routes serve the React app
    app.get(/^(?!\/api).*/, (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
    });
}
```

Request resolution order for `https://<host>/some/path`:

1. `helmet` → `cors` → body parsers.
2. `/api/*` routers — if the path starts with `/api`, it is handled here. An unmatched `/api` path is
   **not** caught by `errorHandler` (`server/middleware/errorHandler.js:1` is a four-argument *error*
   middleware, which Express only invokes when something calls `next(err)`); it falls through to
   Express's own built-in 404, which returns an HTML `Cannot GET /api/…` page rather than the usual
   `{ success: false, message }` JSON envelope. Worth knowing when a client reports "the API returned
   HTML".
3. `/program-docs`, `/program-docs-highlighted`, `/program-docs-snippets` — auth-gated static.
4. `express.static(client/build)` — serves `/static/js/main.<hash>.js`, `/favicon.ico`, `/logo.png`,
   `/manifest.json`, `/rdg-styles.css`, etc.
5. The catch-all regex — any other **GET** returns `index.html`, and React Router takes over
   client-side. This is what makes `/exports`, `/admin/dashboard`, `/institute` work on a hard refresh.

### 3.2 Four traps in those nine lines

**Trap 1 — `NODE_ENV` must be exactly `production`.**
If `NODE_ENV` is unset, misspelled, or set to `prod`, the entire `if` block is skipped. The API keeps
working perfectly while *every page of the app returns 404*. This is the highest-frequency "the site is
down but the health check is green" failure mode. `GET /api/health` will still return 200 because it is
registered at `:99`, outside the block.

**Trap 2 — the catch-all is a regex, not a string, and that is deliberate.**
`/^(?!\/api).*/` is a negative-lookahead regex. In Express 5 the old `app.get('*', ...)` form throws at
startup (path-to-regexp no longer accepts a bare `*`). Do not "simplify" this line.

**Trap 3 — it is `app.get`, so only GET falls through.**
A `POST` to a non-`/api` path is not rewritten to `index.html`; it falls through to Express's built-in
404 (not to `errorHandler`, which only runs on `next(err)`). That is correct behaviour, but surprising
if you are debugging a form post to a wrong URL.

**Trap 4 — `/socket.io` never reaches Express.**
Socket.IO attaches its own listener to the raw HTTP server (`server/server.js:127`,
`server/services/realtime.js:26-31`, where `path: '/socket.io'` is set) and intercepts its path before
Express sees it. The client uses
`transports: ['websocket', 'polling']` (`client/src/services/socket.js:14-19`) and derives its origin
by stripping `/api` off `API_BASE_URL`, which in production is the empty string — i.e. same origin. If
you ever put a proxy or CDN in front of Render, it **must** forward WebSocket upgrades or the app
silently loses real-time updates and falls back to polling.

### 3.3 The auth-gated PDFs, and why mount order is load-bearing

`server/server.js:59-96` mounts three static directories behind
`docsRagEnabled` → `protect` (JWT) → `orgGate('luc')`:

| Mount | Filesystem path | Size |
|---|---|---|
| `/program-docs` | `client/public/program-docs` | 34 MB |
| `/program-docs-highlighted` | `client/public/program-docs-highlighted` | 37 MB |
| `/program-docs-snippets` | `client/public/program-docs-snippets` | 13 MB |

**The trap:** CRA copies everything in `client/public/` into `client/build/`. So after a build, the
*same* PDFs also exist at `client/build/program-docs/...`. The only thing preventing them from being
served **without authentication** is that the gated mounts are registered at lines 59-96, *before*
`express.static(client/build)` at line 108. Move the production block earlier, or move the gated mounts
later, and every LUC program PDF becomes publicly downloadable to anyone who guesses a filename.

Each gated mount also sets `fallthrough: false`, so a miss inside those directories returns 404 rather
than dribbling through to the SPA catch-all.

The kill switch (`server/middleware/docsRagEnabled.js`) is mounted *first*, before `protect`, so that
when the feature is off the response is a flat 503 that does not reveal the 401-vs-403 distinction.

---

## 4. Environment variables

All values live **only** in the Render dashboard's Environment panel. Locally they live in
`server/.env` (gitignored). **Names only below — no values appear in this document.**

### 4.1 Required for the app to function

| Name | Used at | If missing |
|---|---|---|
| `NODE_ENV` | `server/server.js:107,122,149,157`; `server/services/realtime.js:17` | Must be exactly `production`. Otherwise the SPA is not served (Trap 1, §3.2). |
| `PORT` | `server/server.js:119` | Falls back to **5000**. Render injects `PORT` itself; do not override it with 5001 or the port scan fails and the deploy is marked unhealthy. |
| `MONGODB_URI` | `server/config/db.js:5` | Process exits 1 → crash loop. |
| `JWT_SECRET` | `server/models/User.js:86`, `server/middleware/auth.js:25`, `server/services/realtime.js:38` | **No boot-time check.** Server starts fine, then every login and every socket handshake throws. Changing it invalidates all live sessions (there is no token-version field). |
| `JWT_EXPIRE` | `server/models/User.js:87` | Passed straight to `jwt.sign({ expiresIn })`. If unset, `expiresIn: undefined` means tokens **never expire** — a real security regression. Keep it set. |

### 4.2 AI / LLM

| Name | Used at | Default if unset | Effect if missing |
|---|---|---|---|
| `OPENAI_API_KEY` | `server/services/aiService.js`, `chatService.js`, `docsRagService.js`, `controllers/tierController.js` | none | AI dashboard analysis, `/api/chat/stream`, Docs-RAG fallback generation, embeddings, and Tier Fight poster generation all fail. Rest of app unaffected. |
| `GROQ_API_KEY` | `server/services/docsRagService.js`, `routes/docsChat.js:69` | none | Docs RAG falls back to OpenAI. |
| `LLM_PRIMARY` | `server/config/docsRagConfig.js:30` | `groq` | — |
| `LLM_FALLBACK` | `server/config/docsRagConfig.js:31` | `openai` | — |
| `GROQ_CHAT_MODEL` | `docsRagConfig.js:29` | `llama-3.3-70b-versatile` | — |
| `OPENAI_CHAT_MODEL` | `docsRagConfig.js:28` | `gpt-4o-mini` | — |
| `OPENAI_EMBEDDING_MODEL` | `docsRagConfig.js:26-27` | `text-embedding-3-small` | Changing this **invalidates every stored embedding** — dimensions must match. Re-ingest after any change. |

Tier Fight posters call `gpt-image-2` at `1536x1024`, `quality: medium`
(`server/controllers/tierController.js:101,103`) — the model id is **hard-coded**, not an env var,
and costs roughly $0.041 per image (comment at `tierController.js:47`).

### 4.3 Docs RAG tuning

All parsed once at require-time in `server/config/docsRagConfig.js` — **changing any of these requires a
service restart**, not just a save.

| Name | Line | Default |
|---|---|---|
| `DOCS_RAG_ENABLED` | `:18` | `true` |
| `DOCS_RAG_TOPK` | `:19` | `5` |
| `DOCS_RAG_MIN_SCORE` | `:20` | `0.35` |
| `DOCS_RAG_EXACT_MATCH_THRESHOLD` | `:21` | `0.82` |
| `DOCS_RAG_CACHE_TTL_SECONDS` | `:25` | `86400` (24 h) |

`DOCS_RAG_ENABLED=false` is the emergency kill switch. `server/middleware/docsRagEnabled.js:13-14`
reads **both** the frozen config *and* the live `process.env`, so either signal disables the feature.
`/api/docs-chat/health` and `/api/docs-chat/stats` stay reachable while it is off
(`server/routes/docsChat.js:20-23`).

### 4.4 AWS S3

| Name | Used at | Default |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | `server/services/s3.js:19,26` | none |
| `AWS_SECRET_ACCESS_KEY` | `server/services/s3.js:19,27` | none |
| `AWS_REGION` | `server/services/s3.js:13` | `me-central-1` (UAE) |
| `S3_BUCKET` | `server/services/s3.js:14` | `''` |

`isEnabled()` (`s3.js:35`) returns true only when key, secret **and** bucket are all set. If any is
missing, the whole S3 layer no-ops: no nightly backups, and Tier posters fall back to storing a base64
data URL inline in MongoDB (`tierController.js:223-238`).

> **Open question you must resolve on day one.** A project note dated 2026-05-31 records the S3 bucket
> and four Render env vars as *pending*. Whether they were ever set in production is **UNVERIFIED from
> the code**. Check the Render logs for `[db-snapshot] nightly backup scheduled` versus
> `[db-snapshot] S3 not configured`. If it is the latter, the only backups you have are whatever Atlas
> is doing.

### 4.5 Set but unused / local-script-only

| Name | Status |
|---|---|
| `JWT_REFRESH_EXPIRE` | Present in `server/.env` and `server/.env.example`, but **no code outside `node_modules` reads it**. There is no refresh-token flow. Harmless; don't build on it assuming it works. |
| `REACT_APP_API_URL` | Client-side. In production it is irrelevant — `client/src/utils/constants.js:157` hard-branches on `NODE_ENV` to `'/api'`. Only used locally. Do **not** set it on Render. |
| `EXCEL_PATH`, `YEAR`, `DRY_RUN`, `WIPE_YEAR` | `server/scripts/seedTeamEntriesFromExcel.js:25-31`. One-off local import script only. |
| `ENV_PATH` | `server/scripts/importInstituteFromExcel.js:18`. Local only. |
| `CSP_ENABLED` | Not an app variable. The only occurrences of the string in the tree are inside `server/node_modules/sift` (a Mongoose transitive dependency), where it is unrelated to Content-Security-Policy. Setting it on Render does nothing — CSP is turned off in code at `server/server.js:23`. |

### 4.6 Two secret-hygiene problems in the repo itself

Both are **verified with `git ls-files`** and need action, not discussion:

1. **`server/.env.example` is tracked in git and contains a real-looking MongoDB Atlas connection
   string with an embedded username and password**, plus a default `JWT_SECRET` string. Even if that
   database user has since been removed, this trips secret scanners and undermines every other control.
   → Replace every value with a `<PLACEHOLDER>`, commit, and **rotate the Atlas database user
   password** regardless of whether you believe it is live.
2. **`LOGIN_CREDENTIALS.md` is tracked in git.** `npm run seed` writes generated user passwords into it
   (`server/scripts/seedDatabase.js:225`, `server/scripts/seedSkillhub.js:131`). It is *not* in
   `.gitignore`. → Add it to `.gitignore`, `git rm --cached` it, and rotate any account whose password
   appears in git history.

Neither file's contents are reproduced here. Details of ownership and rotation are in
[11 — Credentials & Access](11-credentials-and-access-handover.md).

---

## 5. MongoDB Atlas

### 5.1 The cluster is named "dev" and it *is* production

The Atlas cluster host is `dev.gdddmth.mongodb.net` — readable from the committed `server/.env.example`,
which is itself the problem flagged in §4.6. **There is no separate development or staging database.** Your laptop, every one-off maintenance script in `server/scripts/`, and the live Render
service all point at the same data.

Practical consequences you must internalise before touching anything:

- `npm run seed` **wipes and recreates users, consultants *and* commitments** — the three
  `deleteMany({})` calls at `server/scripts/seedDatabase.js:35-37` are unconditional and unfiltered.
  Running it "to see what happens" destroys live logins *and* every commitment record. It is the single
  most dangerous command in the repo. (Note that `DEPLOYMENT_GUIDE.md:92-95` recommends running it
  post-deployment. Do not.)
- Any script in `server/scripts/` that you run locally with your `.env` loaded is a **production write**.
  Scripts that only read (`audit*`, `profile*`, `verify*`, `analyze*`, `trace*`, `dump*`) are safe;
  everything else writes. Do **not** treat that as an exhaustive allowlist — the destructive prefixes
  currently in the directory include `add*`, `backfill*`, `cleanup*`, `clear*`, `create*`,
  `deactivate*`, `exclude*`, `fire*`, `fix*`, `import*`, `ingest*`, `migrate*`, `normalize*`,
  `recompute*`, `reconcile*`, `rename*`, `reset*`, `restore*`, `round*` and `seed*`. In particular
  `clearAndImportStudents.js` and `resetBahrainPassword.js` do exactly what their names say.
- The one useful mitigation: many scripts honour a dry-run flag or log before writing. Read the top of
  a script before running it, every time. There is no undo.

**Strongly recommended first-month change:** create a genuinely separate `team_progress_tracker_dev`
database (same cluster is fine, different database name is enough) and point local `.env` at it. Seed
it once. Then "did I just nuke production?" stops being a question you have to ask.

### 5.2 Connection

`server/config/db.js` is five lines of substance:

```js
const conn = await mongoose.connect(process.env.MONGODB_URI);
console.log(`MongoDB Connected: ${conn.connection.host}`);
// on error: console.error + process.exit(1)
```

No pool tuning, no retry policy, no `serverSelectionTimeoutMS` override — Mongoose 9 defaults apply.
A connection failure at boot is fatal, which on Render means a crash-loop and a failed deploy. That is
the correct behaviour: you find out immediately rather than serving a half-broken app.

### 5.3 Network access, region, and backups — what you must verify

| Item | Status |
|---|---|
| Atlas IP allowlist | **UNVERIFIED.** Render does not publish stable egress IPs on lower plans, so this is almost certainly `0.0.0.0/0`. If so, the database is reachable from anywhere with valid credentials — the password is the only control. Confirm in Atlas → Network Access. |
| Atlas region | `docs/engineering/04-deployment-runbook.md:17` says Ireland (`eu-west-1`); `DEPLOYMENT.md:432-439` warns that a Render/Atlas region mismatch adds **~25 s to every cold boot** (the Docs RAG index ships ~5 MB of embeddings at startup). Both statements are stale-doc claims — **verify in the Atlas dashboard.** If Render is in Singapore and Atlas is in Ireland, that ~25 s boot penalty is real and is your slow-restart explanation. |
| Atlas automated backups | **UNVERIFIED** — depends on cluster tier. M0/M2/M5 shared tiers have **no** automated snapshots. Check Atlas → Backup. If backups are off, the S3 nightly dump in §6 is your *only* backup. |
| Atlas cluster tier | **UNVERIFIED.** |

---

## 6. AWS S3

One private bucket, named by `S3_BUCKET`, in `AWS_REGION` (default `me-central-1`, UAE). The bucket
name is **UNVERIFIED** from the code — read it off the Render env panel. All access goes through
`server/services/s3.js`; nothing else constructs an S3 client.

### 6.1 What lives in it

| Prefix | Written by | Content | Key shape |
|---|---|---|---|
| `db-snapshots/` | `server/services/dbSnapshot.js:21,38` | One gzipped JSON file per collection, plus `_manifest.json` | `db-snapshots/YYYY-MM-DD/<collection>.json.gz` |
| `tier-images/` | `server/controllers/tierController.js:220` | Tier Fight poster PNGs from `gpt-image-2` | `tier-images/YYYY/MM/DD/<epoch-ms>-<theme>.png` |

### 6.2 The helper API (`server/services/s3.js`)

| Function | Line | Notes |
|---|---|---|
| `isEnabled()` | `:35` | True only if key + secret + bucket are all set. Every caller checks this first. |
| `uploadBuffer(key, body, contentType)` | `:40` | Throws a clear error when unconfigured. |
| `getSignedGetUrl(key, expiresIn=3600)` | `:49` | Presigned GET so the private bucket can serve a browser directly for 1 hour. Returns `null` when unconfigured. |
| `getSignedDownloadUrl(key, filename, expiresIn=3600)` | `:58` | Same, plus `Content-Disposition: attachment`. Sanitises the filename to `[a-zA-Z0-9._-]`. Works cross-origin with **no bucket CORS config** because the browser *navigates* to it rather than `fetch`ing it — don't "fix" this by adding CORS rules. |
| `listObjects(prefix, max)` | `:71` | Paginates, returns newest-first. **Currently has no caller** — written for a snapshot browser that was never built. |

### 6.3 The bucket must stay private

Nothing is ever served from a public S3 URL. Poster images reach the browser only through short-lived
presigned URLs generated per request (`tierController.js:303,326-327`). If someone makes the bucket
public "to simplify things", every nightly database dump — containing the full student, commitment and
user records — becomes world-readable. **The database snapshots and the poster images share one
bucket.** That is the reason the bucket must never be opened up.

### 6.4 Known gaps in the S3 setup

| Gap | Why it matters |
|---|---|
| **No lifecycle policy is defined in code** | Snapshots accumulate forever. Cost grows linearly; old dumps of personal data are retained indefinitely, which conflicts with `docs/legal/09-records-retention-schedule.md`. Whether a lifecycle rule exists in the AWS console is **UNVERIFIED** — check it, and set one (e.g. keep 30 daily + 12 monthly). |
| **No restore script exists** | `server/scripts/runDbSnapshot.js` writes snapshots; nothing reads them back. See §11 for the manual procedure. |
| **The dump loads whole collections into memory** | `dbSnapshot.js:35-36` does `find({}).toArray()` then `zlib.gzipSync` per collection. The file's own comment acknowledges this. On a small Render instance a large collection could OOM the web process at 00:30. Fine today; revisit if any collection passes ~100k documents. |
| **Snapshots are not verified** | Nothing checks that a snapshot is restorable. Do a restore drill (§11) at least once before you need it. |

---

## 7. Scheduled jobs

All three run **inside the web process**, not as separate Render Cron Jobs. There is no external
scheduler.

| Job | Schedule | Timezone | Registered at | Implementation |
|---|---|---|---|---|
| Nightly DB snapshot to S3 | `30 0 * * *` (00:30) | `Asia/Dubai` | `server/server.js:162-166` | `server/services/dbSnapshot.js` |
| Student birthday reminders | `0 8 * * *` (08:00) | `Asia/Dubai` | `server/server.js:177-185` | `server/services/birthdayNotifier.js` |
| Admission drift monitor | every 24 h, first run 30 s after boot | n/a (interval) | `server/server.js:149-152` | `server/services/driftMonitor.js:59-74` |

### 7.1 The `NODE_ENV !== 'test'` guard

There are two guarded blocks, not three: the drift monitor at `server/server.js:149-152`, and a single
`if (process.env.NODE_ENV !== 'test')` at `:157-187` that contains *both* cron jobs. Socket.IO has the
same guard (`realtime.js:17`).

This exists so the Jest suites — which boot the real app against `mongodb-memory-server` — don't
schedule timers that keep the Node process alive after the tests finish (the classic
"Jest did not exit one second after the test run completed" hang) and don't fire real S3 uploads.

**The consequence to remember:** in `development` these jobs *do* run. If you leave `npm run dev`
running overnight on your laptop with production credentials in `server/.env`, your machine will take
a full production database snapshot at 00:30 Dubai time and upload it to the production bucket. Not
destructive, but surprising — and it does copy the entire production dataset onto a laptop's outbound
connection.

### 7.2 The snapshot folder is dated in UTC — so it is "yesterday"

This one costs people twenty minutes every time.

- The cron fires at **00:30 Asia/Dubai**. UAE is UTC+4 with no DST, so that instant is
  **20:30 UTC on the previous calendar day**.
- `dbSnapshot.js:20` computes the folder name as `now.toISOString().slice(0, 10)` — a **UTC** date.

So the backup taken on the morning of **Saturday 5 September** is stored under
`db-snapshots/2026-09-04/`. When you go looking for "last night's backup", look under **yesterday's**
date. The `startedAt` field inside `_manifest.json` carries the true ISO timestamp — trust that, not
the folder name.

### 7.3 Cron jobs assume exactly one instance

`node-cron` runs per process. If the Render service is ever scaled to 2+ instances:

- **Two** full database snapshots are written at 00:30, racing on identical S3 keys.
- **Two** birthday-notification runs fire. The job is described as idempotent
  (`server/server.js:172-175`), so duplicates are unlikely but the safety depends on read-then-write
  timing, not on a lock.
- Socket.IO has **no Redis adapter** (`realtime.js` uses the default in-memory adapter), so a broadcast
  from instance A never reaches clients connected to instance B. Dashboards would stop updating for
  roughly half of users, silently.

**Therefore: do not horizontally scale this service without first** moving the cron jobs to Render Cron
Jobs (or adding a distributed lock) **and** adding `@socket.io/redis-adapter`. Vertical scaling — a
bigger instance — is safe.

### 7.4 A sleeping instance runs nothing

If the service is on Render's Free tier it spins down after ~15 minutes of inactivity. A sleeping
process has no cron. At 00:30 Dubai there is no user traffic, so **on a Free instance the nightly
backup would essentially never run.** Confirming the instance type is therefore a backup question, not
a performance question.

---

## 8. Runbook: how to deploy

There is no CI and no staging environment. `git push origin main` *is* the deploy. Treat it with
corresponding care.

### 8.1 Pre-flight (on your machine)

```bash
# 1. Get up to date
git checkout main && git pull

# 2. Server tests — note this only runs 4 of the test directories
cd server && npm test

# 3. Client tests
cd ../client && npm test

# 4. Prove the production build compiles. CRA treats warnings as errors in CI-ish
#    contexts, and a build failure on Render costs you a full deploy cycle.
cd .. && npm run build

# 5. Optional but recommended: run the built app exactly as production does
cd server && NODE_ENV=production npm start
#    → visit http://localhost:5001 and confirm the SPA loads, not a 404
```

Step 4 is the one people skip and regret. A broken client build fails the Render *build* step, so the
old version stays live — annoying but not an outage. A broken *server* boot fails after the build, and
Render keeps the previous deploy running, so still not an outage. The genuinely dangerous class is code
that builds and boots but is wrong, which only the tests and step 5 catch.

### 8.2 Deploy

```bash
git checkout main
git merge --no-ff <your-branch>      # or merge the PR on GitHub
git push origin main
```

Render's GitHub integration picks up the push and starts a deploy automatically.

### 8.3 Watch the build

Render dashboard → the service → **Logs** (or the Events tab → the in-progress deploy).

| Phase | What you should see |
|---|---|
| Clone | Repo checkout — slow, because of the 84 MB of PDFs |
| Build | `npm run install:all` output, possibly a `pip install failed` line (harmless — §2.3), then `Creating an optimized production build...` and `Compiled successfully.` |
| Start | The six boot log lines listed in §2.4 |
| Live | Render marks the deploy **Live** and switches traffic |

Render performs a zero-downtime cutover: the old instance keeps serving until the new one passes its
health check.

### 8.4 Verify (do not skip this — see §9)

```bash
HOST=https://team-progress-tracker.onrender.com     # confirm the real host first

# 1. API is up
curl -s $HOST/api/health
# → {"success":true,"message":"Server is running"}

# 2. The new bundle is actually being served (§9)
curl -s $HOST/ | grep -o 'main\.[a-f0-9]\{8\}\.js'

# 3. Docs RAG index loaded (200, not 503)
curl -s -o /dev/null -w "docs-chat health: %{http_code}\n" $HOST/api/docs-chat/health

# 4. The gated PDFs still require auth (should be 401, never 200)
curl -s -o /dev/null -w "pdf unauthenticated: %{http_code}\n" \
  $HOST/program-docs/ssm-dba/DBA.pdf
```

Then, in a browser: hard-refresh, log in as an admin, load one page from each major area you touched,
and confirm the browser console is clean.

### 8.5 Post-deploy, only when relevant

| If your change… | Then also… |
|---|---|
| Added or replaced a program PDF | Log in as admin → `/admin/docs-rag` → **Force re-ingest** (shells `server/scripts/ingestProgramDocs.js` via `server/routes/docsChat.js:78-84`). Wait for the green banner, then re-check that `/api/docs-chat/health` returns 200 with a non-zero `chunksLoaded`. |
| Changed `OPENAI_EMBEDDING_MODEL` | Force re-ingest is **mandatory** — old embeddings have the wrong dimensions. |
| Changed any env var | Save in Render → the service restarts (~90 s). Env vars are read at process start; `docsRagConfig.js` in particular freezes them at require-time. |
| Added a schema field with a conditional `required` | Remember `findByIdAndUpdate` validators run in *query* context, so org-conditional `required` silently passes. Controllers must re-check in JS. → [03 — Database Schema](03-database-schema.md) |
| Needs a data backfill | Run the script from your machine against production **after** confirming a fresh snapshot exists (§11). Existing idempotent scripts: `server/scripts/migrateOrganization.js`, `server/scripts/backfillCommitmentDate.js`. |

---

## 9. How to tell whether a deploy actually landed

Render will happily report "Live" while your browser serves you a cached page, and a Free instance
waking from sleep looks identical to a fresh deploy. The reliable signal is the **CRA content hash**.

`react-scripts build` names every bundle after a hash of its contents:

```html
<!-- client/build/index.html -->
<script defer="defer" src="/static/js/main.d75d53dc.js"></script>
<link href="/static/css/main.e6c13ad2.css" rel="stylesheet">
```

Change *any* client source file and that hash changes. It cannot be faked by a cache, because
`index.html` itself is served by `express.static` with no long-lived cache headers (Express's default
`maxAge` is 0), so the browser and any intermediary always revalidate it.

**The one-liner:**

```bash
curl -s https://<host>/ | grep -o 'main\.[a-f0-9]\{8\}\.js'
```

**How to use it:**

1. **Before** you push, record the current production hash with the command above.
2. Push, wait for Render to report Live.
3. Run it again. **A different hash means your build is live.** The same hash means either the deploy
   has not switched over yet, or your change was server-only.

**Comparing against your own build:** run `npm run build` locally on the same commit and
`grep -o 'main\.[a-f0-9]\{8\}\.js' client/build/index.html`. Identical hashes prove production is
serving *exactly* your commit's frontend. (`client/build/asset-manifest.json` lists every hashed asset
if you need finer detail.)

**Caveats, so you don't misread it:**

- A **server-only** change (anything under `server/`) does not alter the hash. For those, verify via
  the boot logs or a behaviour check on the endpoint instead.
- The hash is deterministic per content, so reverting a change reverts the hash to its previous value.
- Users with the app already open keep running the old bundle until they reload. There is no service
  worker (CRA 5 does not register one by default and `client/src/index.js` does not add one) and no
  "new version available" prompt — after a breaking frontend change, tell people to hard-refresh.

---

## 10. Runbook: how to roll back

### 10.1 Decide which lever you need

| Situation | Fastest correct action |
|---|---|
| Docs RAG chatbot misbehaving | Set `DOCS_RAG_ENABLED=false` in Render (restart, ~90 s). Nothing else is affected. |
| Bad env var value | Fix the value in Render and let it restart. Do **not** redeploy. |
| Bad code, previous deploy was fine | Render rollback (§10.2) — ~1 minute, no build. |
| Bad code, needs git history to be correct too | `git revert` + push (§10.3) — slower, but `main` stays truthful. |
| Bad data written by a migration | Rollback does **not** undo data. Go to §11. |

### 10.2 Rollback via the Render dashboard (fastest)

1. Render dashboard → the service → **Deploys** (or Events).
2. Find the last deploy that was known-good. Its commit SHA is shown.
3. Click **Rollback to this deploy** (older Render UIs: **Redeploy**).
4. Render re-serves that build. If it re-runs the build it takes a few minutes; a cached rollback is
   near-instant.
5. Verify with the §8.4 checks — in particular confirm the bundle hash has returned to the old value.

**What a rollback does not do:** it does not revert environment variables (those are not versioned),
and it does not revert database writes. If the bad deploy ran a migration or wrote data, undoing the
code leaves the data as-is. Reason about the data separately, every time.

### 10.3 Rollback via git (keeps history honest)

```bash
git checkout main && git pull
git revert --no-edit <bad-sha>        # or: git revert --no-edit <first-sha>..<last-sha>
git push origin main                  # triggers a normal auto-deploy
```

Prefer this when the bad commit will otherwise be re-merged by someone else, or when you need the
revert itself to be reviewable. Prefer §10.2 when the site is broken *right now* — dashboard rollback
skips the build entirely.

### 10.4 After any rollback

- Re-run the §8.4 verification.
- Write down what happened and why in whatever incident log you keep
  (`docs/security/07-incident-response-plan.md` describes the intended process).
- If the rolled-back deploy had already written data, note the window — you may need §11.

---

## 11. Disaster recovery: restoring from an S3 snapshot

**There is no restore script in this repository.** `server/services/dbSnapshot.js` and
`server/scripts/runDbSnapshot.js` only write. Writing and *testing* a restore path is the highest-value
infrastructure task you will inherit.

### 11.1 What a snapshot contains

```
db-snapshots/YYYY-MM-DD/
├── _manifest.json          # startedAt, finishedAt, database, bucket, prefix,
│                           # per-collection { name, count, bytes, key }, totals
├── users.json.gz           # gzipped `JSON.stringify` of the raw driver documents
├── students.json.gz        # (dbSnapshot.js:36) — plain JSON, NOT extended JSON
├── commitments.json.gz
└── … one per non-system collection
```

Remember §7.2: **the folder date is the previous UTC day.** Confirm with `startedAt` inside
`_manifest.json`.

### 11.2 Taking a snapshot on demand — always do this before a risky operation

```bash
cd server
node scripts/runDbSnapshot.js
```

It prints a per-collection table of document counts and gzipped sizes. It requires `MONGODB_URI` plus
the four `AWS_*`/`S3_BUCKET` variables. **Run this before every backfill, migration, or bulk delete.**

### 11.3 Restoring (manual, until someone writes the script)

Restoring is deliberately not one command, because a careless restore is worse than the incident.

1. **Do not overwrite the live database.** Restore into a *new* Atlas database (or a new cluster) so
   the damaged state is preserved for diagnosis.
2. Download the day's objects from S3 (AWS CLI or console) and `gunzip` them.
3. Load each collection with a short Node script using the driver's `insertMany`. **A naive
   `mongoimport --jsonArray` will silently corrupt the data.** `dbSnapshot.js:36` dumps with a plain
   `JSON.stringify` over driver documents, and BSON's `toJSON` implementations flatten types rather
   than emitting extended JSON: an `ObjectId` becomes a bare hex **string** (`"6650…"`, not
   `{"$oid": "6650…"}`) and a `Date` becomes an ISO **string**. Re-imported as-is, every `_id` and
   every `teamLead` / `consultant` / `user` reference comes back as a string, so all the `populate()`
   joins across the app quietly return `null`. Your restore script must re-cast: `new ObjectId(v)` for
   `_id` and every ref field, `new Date(v)` for every date field. **Validate this on one small
   collection and confirm a `populate()` still resolves before trusting it on `students`.**
4. Verify: compare document counts against `_manifest.json`, then spot-check a few `User` and `Student`
   documents.
5. Only then repoint `MONGODB_URI` on Render at the restored database and restart.
6. Announce the data-loss window (everything written after `startedAt`) to stakeholders.

### 11.4 Recovery expectations

| | |
|---|---|
| **RPO** (worst-case data loss) | Up to 24 h from the S3 snapshot alone, less if Atlas backups are enabled — **verify §5.3** |
| **RTO** (time to restore) | Realistically several hours today, because the restore path is manual and untested |
| **Application recovery** | The app itself is stateless: redeploy from `main`. No local disk state — every upload path uses `multer.memoryStorage()` (`server/routes/tiers.js:13`, `institute.js:14`, `chat.js:23`), so nothing important is ever written to the container's ephemeral filesystem. |
| **Program PDFs** | Live in git (`client/public/program-docs/`, 16 tracked files). Recovered by cloning the repo. |
| **Secrets** | Live **only** in the Render env panel. If the Render account is lost, they are gone — this is exactly why [11 — Credentials & Access](11-credentials-and-access-handover.md) matters. |

Cross-reference `docs/security/10-backup-and-disaster-recovery.md` for the policy framing — but note
that document predates the S3 snapshot feature entirely and describes Atlas snapshots as the only
mechanism. **Where they disagree, this document is correct.**

---

## 12. Infrastructure risks, ranked

| # | Risk | Evidence | Suggested fix |
|---|---|---|---|
| 1 | Production credentials in git: `server/.env.example` (real-looking Atlas URI) and `LOGIN_CREDENTIALS.md` are both tracked | `git ls-files` | Scrub both, `git rm --cached`, **rotate** the DB user and any listed account |
| 2 | Cluster named `dev` *is* production; no separate dev DB | §5.1 | Create a real dev database; point local `.env` at it |
| 3 | Backups may not be running at all | `[db-snapshot] S3 not configured` branch, `server/server.js:169`; S3 vars recorded as *pending* in a 2026-05-31 note | Verify in Render logs today; set the four S3 vars if absent |
| 4 | Restore path is untested and unscripted | No restore script exists | Write one; do a drill into a scratch database |
| 5 | All infrastructure config exists only in the Render dashboard | No `render.yaml` | Commit a Blueprint; document current settings |
| 6 | No CI — a push to `main` deploys untested code | No `.github/` | Add a GitHub Action running `server && npm test` + `client && npm test` + `npm run build` on PRs; protect `main` |
| 7 | No error tracking, APM, or uptime alerting | Nothing but `console.log` | Add Sentry (or equivalent) + an uptime monitor on `/api/health` |
| 8 | Node version unpinned | No `engines`/`.nvmrc` | Pin `engines.node` |
| 9 | Cron + Socket.IO both assume a single instance | §7.3 | Document "do not scale horizontally"; move cron out and add a Redis adapter before you ever do |
| 10 | CSP disabled; `cors()` wide open; no `trust proxy` | `server/server.js:23,28`; no `app.set('trust proxy')` anywhere | Enable CSP behind a flag; restrict CORS to the known origin; set `trust proxy` so `express-rate-limit` sees real client IPs (`server/middleware/exportRateLimit.js:12-15` falls back to `req.ip`) |
| 11 | No S3 lifecycle policy in code — snapshots of personal data accumulate forever | §6.4 | Add a lifecycle rule; reconcile with `docs/legal/09-records-retention-schedule.md` |
| 12 | Frontend source maps published | `client/build/static/js/*.map` | `GENERATE_SOURCEMAP=false` on Render |

---

## 13. Where the older docs are wrong

The repo carries three older deployment documents. Read them for background, but trust this one.

| Document | Verdict |
|---|---|
| `DEPLOYMENT.md` (root) | §1-6 describe **Heroku, DigitalOcean, PM2 and Nginx** — none of which are used. It also lists `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD` as environment variables (`:48-51`); **no such variables exist in the code** — `grep -r SMTP_ server client/src` returns nothing and `nodemailer` is not a dependency, so there is no email sending anywhere; notifications are in-app only. The one section still worth reading is `§ Docs RAG Feature — Render Deploy Cutover` (`:407` onward), which is accurate about the Docs RAG env vars and the Atlas region caveat. |
| `DEPLOYMENT_GUIDE.md` (root) | Closest to reality — it is where the documented build/start commands come from. But it states `JWT_EXPIRE=30d` and `PORT=10000` as if they were fixed (they are not — Render injects `PORT`), says the dev frontend runs on port 3002 (it is **3001**, `client/package.json`), and suggests running `npm run seed` post-deployment, which would **wipe production users**. Do not follow that step. |
| `docs/engineering/04-deployment-runbook.md` | Structurally correct and correctly notes the absence of `render.yaml` (`:9`). Stale on specifics: its deploy-time list at `:41-43` names only 9 environment variables (there are 20+ in use), and it omits S3, the cron jobs and the drift monitor entirely. Its `server/server.js:114-133` citation (`:53`) for the boot log is stale — the `Server running…` line is emitted at `:122` and the `Docs RAG: loaded…` line at `:134-144`. It says nothing at all about running the test suites, so check `server/package.json:9` for the real pattern (`tests/(exports\|meetings\|institute\|commitments)`) rather than assuming. Its Render/Atlas region claims (`:16-17`) are unverified. |
| `docs/engineering/05-environment-and-secrets.md` | Its variable table is missing all five Docs-RAG tuning vars, all four S3 vars, and every model-selection var except `GROQ_CHAT_MODEL` (`:21`) — so `OPENAI_CHAT_MODEL`, `OPENAI_EMBEDDING_MODEL`, `LLM_PRIMARY` and `LLM_FALLBACK` are undocumented there. It does correctly flag the `server/.env.example` credential problem as a P0 (`:69-80`) — that flag is still open, four months later. |

---

## Related documents

- [00 — Start Here](00-START-HERE.md) — the map of this handover pack
- [01 — System Architecture](01-system-architecture.md) — what the process actually runs
- [02 — Application Workflows](02-application-workflows.md) — feature-by-feature behaviour
- [03 — Database Schema](03-database-schema.md) — collections, the org field, the update-validator trap
- [05 — Environment Setup](05-environment-setup.md) — getting it running on your machine
- [06 — API Reference](06-api-reference.md) — every endpoint, including the health probes used above
- [07 — Roles & Permissions](07-roles-and-permissions.md) — `protect`, `authorize`, `orgGate`
- [08 — Dependencies & Integrations](08-dependencies-and-integrations.md) — OpenAI, Groq, AWS, Atlas
- [09 — Operations, Backup & Recovery](09-operations-backup-recovery.md) — day-to-day operations
- [10 — Known Issues & Roadmap](10-known-issues-and-roadmap.md) — the wider backlog
- [11 — Credentials & Access Handover](11-credentials-and-access-handover.md) — **start the rotations here**
