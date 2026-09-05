# 05 — Environment Setup & Installation

This document takes a brand-new laptop to a running local copy of the Sales Tracker (internally
*Team Progress Tracker*). It assumes zero prior context: it lists the exact prerequisites, the
literal commands in the order you run them, every environment variable the code actually reads
(with the file and line that reads it), how to seed and test, and the specific ways this setup
fails — including several traps that are not obvious and that the older `docs/engineering/` set
gets wrong. Everything here was verified against the code in this repository; where something could
not be verified it says so explicitly. **No secret values appear in this document** — for values,
see [11 — Credentials & Access Handover](11-credentials-and-access-handover.md).

---

## 0. Read this before you run anything

Three facts change how you should approach setup. They are not hypothetical.

### 0.1 There is no development database

The Atlas cluster host is literally named `dev` (`dev.gdddmth.mongodb.net`), but **it is production**.
There is no staging environment and no second cluster. If you copy the production `MONGODB_URI` into
your local `server/.env` — which is the path of least resistance and what the outgoing developer did
— then every local `npm run dev`, every one-off script in `server/scripts/`, and every accidental
`npm run seed` operates on live business data.

**Recommendation for a new developer: do not point your local machine at production on day one.**
[§5](#5-step-4--choose-your-database) gives you two safe alternatives.

### 0.2 `npm run seed` is destructive and unguarded

`server/scripts/seedDatabase.js:35-37` runs three unconditional deletes:

```js
await User.deleteMany({});
await Consultant.deleteMany({});
await Commitment.deleteMany({});
```

There is no confirmation prompt, no `--yes` flag, no environment check, and no dry-run. Run it
against production and you destroy every login account, every consultant record, and every
commitment. See [§6](#6-step-5--seed-the-database).

### 0.3 Ports are 3001 and 5001, not 3000 and 5000

- Client: `client/package.json:37` → `"start": "PORT=3001 react-scripts start"`
- Server: `server/server.js:119` → `const PORT = process.env.PORT || 5000;`

Note the asymmetry. The client **forces** 3001. The server only reaches 5001 because `PORT=5001` is
in `server/.env`; if that file is missing or the variable is unset, the server silently binds **5000**
and the client — which hardcodes `http://localhost:5001/api` (`client/src/utils/constants.js:157-159`)
— cannot reach it. You get "Network Error" on login with a perfectly healthy server running.

---

## 1. What you are setting up

A three-package npm monorepo. There is no workspace configuration — each package installs
independently.

| Path | What it is | Runtime | Port (dev) |
|---|---|---|---|
| `package.json` (root) | Orchestration scripts only. One dev dependency: `concurrently`. | — | — |
| `server/` | Express 5 + Mongoose 9, CommonJS. ~168 files. | Node | 5001 |
| `client/` | React 19 + MUI 7 via Create React App (`react-scripts` 5.0.1). ~200 files. | Browser | 3001 |

In development the two run as **separate servers** and the browser talks cross-origin to
`localhost:5001` (the API sets a fully-permissive `cors()` at `server/server.js:28`). In production
they are **one** process: Express serves `client/build` as static files with an SPA fallback
(`server/server.js:107-114`), which is why the production API base URL is the relative `/api`.

Root scripts (`package.json:6-15`):

| Script | Expands to |
|---|---|
| `npm run dev` | `concurrently "npm run dev:server" "npm run dev:client"` |
| `npm run dev:server` | `cd server && npm run dev` → `nodemon server.js` |
| `npm run dev:client` | `cd client && npm start` → `PORT=3001 react-scripts start` |
| `npm run install:all` | root install → server install → client install → `pip install -r server/requirements.txt` |
| `npm run build` | `cd client && npm install && npm run build` |
| `npm start` | `cd server && npm start` → `node server.js` |
| `npm run seed` | `cd server && node scripts/seedDatabase.js` — **destructive**, see §6 |
| `npm run ingest:docs` | Docs RAG ingest, then `highlight:docs` |
| `npm run ingest:docs:force` | Same with `--force` (deletes all LUC chunks first) |
| `npm run highlight:docs` | `python3 server/scripts/generateHighlightedPdfs.py` |

---

## 2. Prerequisites

### 2.1 Required

| Tool | Version | How to check | Notes |
|---|---|---|---|
| **Node.js** | 20 LTS or newer; **24.x is what was actually used** | `node -v` | See the warning below. |
| **npm** | 10 or newer (ships with Node 20+) | `npm -v` | Verified working on 11.6.0. |
| **git** | any recent | `git --version` | |
| **MongoDB access** | Atlas connection string **or** a local `mongod` | — | See [§5](#5-step-4--choose-your-database). |

> ### ⚠️ The repository declares no Node version
>
> There is **no `engines` field** in any of the three `package.json` files, **no `.nvmrc`**, and
> **no `.node-version`**. Verified: `grep '"engines"' package.json server/package.json client/package.json`
> returns nothing.
>
> This means nothing stops you from using a Node version the code was never tested on, and nothing
> tells Render which version to use in production (Render picks its own default —
> **UNVERIFIED: the exact Node version running on Render is only visible in the Render dashboard**;
> see [04 — Deployment & Infrastructure](04-deployment-and-infrastructure.md)).
>
> **What was actually used for local development: Node v24.10.0 with npm 11.6.0.** The full install
> and both test suites were re-verified on that combination while writing this document, with no
> peer-dependency errors and no `--legacy-peer-deps` needed.
>
> **First thing you should do after taking ownership:** add an `engines` field and an `.nvmrc` so
> the version stops being tribal knowledge.

### 2.2 Required only for the Docs RAG highlight script

| Tool | Version | Notes |
|---|---|---|
| **Python 3** | 3.9+ | Verified working on the system Python 3.9.6 shipped with macOS. |
| **pip** | any | `pip3 -V` |

`server/requirements.txt` is three lines:

```
PyMuPDF>=1.24.0
pymongo>=4.6.0
python-dotenv>=1.0.0
```

These are used by exactly one file — `server/scripts/generateHighlightedPdfs.py` — which
pre-renders single-page highlighted PDFs and PNG snippets for the Docs RAG chat drawer. **The
application runs fine without Python.** You only need it if you re-ingest the program PDFs
(`npm run ingest:docs`, which chains into `npm run highlight:docs`). The `install:all` script
already treats the pip step as best-effort and prints a warning rather than failing.

### 2.3 Optional — only for specific features

| Account / key | Unlocks | Without it |
|---|---|---|
| OpenAI API key | `/api/ai/analysis`, `/api/chat/*`, Docs RAG embeddings + fallback generation | Those endpoints throw `OPENAI_API_KEY is not configured on the server` (`server/services/aiService.js:9`). Everything else works. |
| Groq API key | Primary Docs RAG generation | Falls back to OpenAI (`server/config/docsRagConfig.js:30-31`). |
| AWS credentials + S3 bucket | Nightly DB snapshots, Tier-Fight poster images | `s3.isEnabled()` returns false (`server/services/s3.js:19`); boot logs `[db-snapshot] S3 not configured — nightly backup disabled` and moves on. |

**None of these are needed to get the app running and logging in.**

---

## 3. Step 1 — Get the code

```bash
git clone https://github.com/viditkbhatnagar/Consultant_Progress_Tracker_LUC.git
cd Consultant_Progress_Tracker_LUC
```

Notes:

- The repo is **private**. You need a GitHub account with access — see
  [11 — Credentials & Access](11-credentials-and-access-handover.md) §1 row 1.
- **The clone directory is `Consultant_Progress_Tracker_LUC`, not `teamProgressTracker`.** The
  outgoing developer's local checkout was named `teamProgressTracker`, and several files hardcode
  that path — most notably `HOW_TO_RUN.md`, which contains absolute paths like
  `/Users/viditkbhatnagar/codes/teamProgressTracker/server`. Those paths will not exist on your
  machine. See [§13](#13-corrections-to-the-older-documentation).
- Default branch is `main`; 394 commits, first commit 2025-11-28.
- If you see a `.git` **file** rather than a `.git` directory, you are inside a git *worktree*, not
  a clone. That is a local development convenience of the outgoing developer, not something you need
  to reproduce.

Confirm the remote:

```bash
git remote -v
# origin  https://github.com/viditkbhatnagar/Consultant_Progress_Tracker_LUC.git (fetch)
# origin  https://github.com/viditkbhatnagar/Consultant_Progress_Tracker_LUC.git (push)
```

---

## 4. Step 2 — Install dependencies

```bash
npm run install:all
```

### 4.1 Exactly what that does

From `package.json:9`, it is a single shell chain:

```
npm install
  && cd server  && npm install
  && cd ../client && npm install
  && cd ..
  && ( pip3 install -r server/requirements.txt
       || python3 -m pip install -r server/requirements.txt
       || echo 'pip install failed — Python highlight script will not run; see DEPLOYMENT.md' )
```

| Step | Installs | Approx. size | Failure = fatal? |
|---|---|---|---|
| 1. root `npm install` | `concurrently` only | tiny | Yes — `npm run dev` won't work |
| 2. `server/ npm install` | Express, Mongoose, jsonwebtoken, bcryptjs, openai, groq-sdk, socket.io, xlsx, helmet, multer, node-cron, pdf-parse, tiktoken, AWS SDK v3, plus Jest/supertest/mongodb-memory-server as devDeps | ~400 packages | Yes |
| 3. `client/ npm install` | React 19, MUI 7, react-scripts 5, recharts/echarts, react-data-grid (pinned beta), axios, xlsx, framer-motion, socket.io-client | ~1000 packages | Yes |
| 4. pip | PyMuPDF, pymongo, python-dotenv | ~50 MB | **No** — wrapped in `|| echo` |

Because steps 1–3 are joined with `&&`, **a failure in the server install silently skips the client
install**. Always read the tail of the output; do not assume success.

### 4.2 If the pip step fails

The most common cause on a modern Mac or Linux box is PEP 668 — "externally-managed-environment".
The `|| echo` fallback means `install:all` still reports success, so this is easy to miss. Fix it
with a virtualenv (only needed if you will regenerate Docs RAG highlights):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt
```

Then run `npm run highlight:docs` from inside the activated venv. Verify:

```bash
python3 -c "import fitz, pymongo, dotenv; print('ok', pymongo.version)"
```

### 4.3 Notes on the JS installs

- Both `server/package-lock.json` and `client/package-lock.json` are `lockfileVersion: 3` and are
  committed. Use `npm ci` instead of `npm install` if you want reproducible installs.
- There is **no `.npmrc`** anywhere in the repo. No registry overrides, no `legacy-peer-deps`.
- `react-data-grid` is pinned to the exact version `7.0.0-beta.59` (no caret) deliberately —
  beta releases iterate fast and have broken this CRA setup before. Do not "helpfully" bump it.
- `react-scripts` 5.0.1 with React 19 installs cleanly on npm 11 — verified.

---

## 5. Step 3 — Create `server/.env`

`server/server.js:1` calls `require('dotenv').config()` with no path, so it reads `.env` **relative
to the process working directory**. `npm run dev:server` does `cd server` first, so the file must be
at `server/.env`.

`.gitignore` excludes `.env`, `server/.env` and `client/.env`, so this file is never committed —
you must create it by hand.

```bash
touch server/.env
```

### 5.1 Complete variable reference

Every variable below was found by grepping `process.env.*` across `server/server.js`, `config/`,
`controllers/`, `middleware/`, `models/`, `routes/`, `services/`, `scripts/` and `utils/`
(node_modules excluded). **Values are redacted everywhere — get them from
[11 — Credentials & Access](11-credentials-and-access-handover.md), and prefer rotating over
inheriting.**

#### Core — the app will not work without these

| Variable | Purpose | Read at | If missing |
|---|---|---|---|
| `MONGODB_URI` | Mongo connection string | `server/config/db.js:5` (+ 44 more in scripts) | Boot fails: `The 'uri' parameter to openUri() must be a string, got "undefined"` then `process.exit(1)` (`db.js:8-11`) |
| `JWT_SECRET` | HS256 signing key for auth tokens | `server/models/User.js:86` (sign), `server/middleware/auth.js:25` (verify) | Server boots fine; **first login 500s** with `secretOrPrivateKey must have a value` |
| `JWT_EXPIRE` | Access-token lifetime, e.g. `1h` | `server/models/User.js:87` | Server boots fine; **first login 500s** with `"expiresIn" should be a number of seconds or string representing a timespan` (verified by running `jwt.sign` with `expiresIn: undefined`) |
| `PORT` | HTTP port | `server/server.js:119` | Falls back to **5000** — client cannot reach it. Set `5001`. |
| `NODE_ENV` | `development` / `production` / `test` | `server/server.js:107,122,149,157` | Static SPA serving is skipped (correct for dev); cron jobs still start; boot log prints `undefined mode` |

Both JWT failures are runtime, not boot-time. There is **no startup validation** of any environment
variable other than the Mongo connection. A server with a missing `JWT_SECRET` looks perfectly
healthy on `/api/health` and fails only when someone tries to log in.

#### AI features — optional, lazily initialised

| Variable | Default | Read at |
|---|---|---|
| `OPENAI_API_KEY` | none (throws when used) | `server/services/aiService.js:9-12`, `chatService.js:35`, `docsRagService.js:35`, `classifierService.js:34`, `controllers/{chat,hourly,commitment,meeting,tier}Controller.js` |
| `GROQ_API_KEY` | none | `server/services/docsRagService.js:49`, `classifierService.js:46` |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` | `server/config/docsRagConfig.js:28` |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | `server/config/docsRagConfig.js:27` |
| `GROQ_CHAT_MODEL` | `llama-3.3-70b-versatile` | `server/config/docsRagConfig.js:29` |
| `LLM_PRIMARY` | `groq` | `server/config/docsRagConfig.js:30` |
| `LLM_FALLBACK` | `openai` | `server/config/docsRagConfig.js:31` |

Every OpenAI/Groq client is constructed **lazily inside a function**, never at module load. A
missing key therefore never breaks boot — it surfaces as a 500 on the specific AI endpoint.

> ⚠️ Changing `OPENAI_EMBEDDING_MODEL` invalidates every embedding already stored in `DocChunk`.
> A full `npm run ingest:docs:force` is mandatory after such a change.

#### Docs RAG tuning — all optional, all have defaults

Parsed once at require-time in `server/config/docsRagConfig.js:17-32`; **changing them requires a
process restart**.

| Variable | Default | Line |
|---|---|---|
| `DOCS_RAG_ENABLED` | `true` | `:18` |
| `DOCS_RAG_TOPK` | `5` | `:19` |
| `DOCS_RAG_MIN_SCORE` | `0.35` | `:20` |
| `DOCS_RAG_EXACT_MATCH_THRESHOLD` | `0.82` | `:21-24` |
| `DOCS_RAG_CACHE_TTL_SECONDS` | `86400` (24h) | `:25` |

#### AWS S3 — optional; enables nightly backups and Tier posters

| Variable | Default | Read at |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | none | `server/services/s3.js:19,26` |
| `AWS_SECRET_ACCESS_KEY` | none | `server/services/s3.js:19,27` |
| `AWS_REGION` | `me-central-1` | `server/services/s3.js:13` |
| `S3_BUCKET` | `''` | `server/services/s3.js:14` |

`s3.isEnabled()` requires both credentials **and** a bucket name. All three of `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY` and `S3_BUCKET` must be present or the whole S3 feature set is off.
Leave these unset locally — you do not want your laptop writing nightly snapshots into the
production bucket.

#### Declared but unused

| Variable | Status |
|---|---|
| `JWT_REFRESH_EXPIRE` | Present in `server/.env.example` and in the live `.env`, but **not referenced anywhere in the server source**. There is no refresh-token flow. Harmless; do not build on it assuming it works. |

#### Script-only variables

A handful of one-off scripts in `server/scripts/` read their own variables: `YEAR`, `WIPE_YEAR`,
`EXCEL_PATH`, `ENV_PATH`, `DRY_RUN`. They are passed inline when invoking a specific script and do
not belong in `.env`.

### 5.2 A minimal working `server/.env`

Keys only — fill in real values from the credential handover:

```dotenv
NODE_ENV=development
PORT=5001

MONGODB_URI=
JWT_SECRET=
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# Optional — AI features
OPENAI_API_KEY=
GROQ_API_KEY=

# Optional — leave unset locally; enabling these points your laptop at the
# production S3 bucket.
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=me-central-1
# S3_BUCKET=
```

Generate a local `JWT_SECRET`:

```bash
openssl rand -base64 48
```

Using a *different* `JWT_SECRET` locally from production is good practice and costs you nothing —
tokens are only ever verified by the same server that issued them.

### 5.3 ⚠️ Do not copy `server/.env.example` blindly

`server/.env.example` **is committed to the repository** (verified with
`git ls-files --error-unmatch server/.env.example`) and it contains what appears to be a **real
MongoDB Atlas connection string including username and password**, plus a placeholder
`JWT_SECRET`.

Treat that credential as **compromised** — it is in git history, in a repo that has had multiple
collaborators, and it matches the production cluster host. It should be rotated as part of the
handover, and the file should be sanitised to `<USER>` / `<PASSWORD>` / `<HOST>` placeholders.
This is already logged as a P0 in
[`docs/security/14-security-gap-analysis-and-remediation-roadmap.md`](../security/14-security-gap-analysis-and-remediation-roadmap.md)
and in [11 — Credentials & Access](11-credentials-and-access-handover.md) §4.2.

Use `.env.example` for the **shape** of the file. Never for the values.

---

## 6. Step 4 — Choose your database

This is the decision that matters most, and the existing docs skip it.

### Option A — your own free Atlas cluster (recommended for a new developer)

1. Create a free M0 cluster at <https://cloud.mongodb.com>.
2. Create a database user, and under **Network Access** add your current IP (or `0.0.0.0/0` for a
   throwaway dev cluster).
3. Put that connection string in `server/.env` as `MONGODB_URI`, with a database name at the end,
   e.g. `.../team_progress_tracker?retryWrites=true&w=majority`.
4. Run `npm run seed` (§7) to populate accounts. You will have an empty but working system.

You get a real Atlas environment — including `$` aggregation behaviour the export pivots depend on —
with zero risk to production.

### Option B — local MongoDB

```bash
brew install mongodb-community        # macOS
brew services start mongodb-community
```

Then `MONGODB_URI=mongodb://127.0.0.1:27017/team_progress_tracker`.

Fastest and fully offline. Caveat: the code is written against Atlas and uses Mongoose 9 /
MongoDB 6+ aggregation features. Local MongoDB **must be 6.0 or newer**.
**UNVERIFIED — the app has not been exercised end-to-end against a local `mongod`; the entire
development history used Atlas.** The Jest suite does run against a local in-memory MongoDB
(6.0.14 / 7.0.24 binaries, §9), which is strong evidence the data layer is portable.

### Option C — the production cluster (what the outgoing developer did)

Only do this when you genuinely need production data, and understand that:

- Every write from your laptop is a production write.
- `npm run seed` would destroy production accounts.
- Any script in `server/scripts/` that is not explicitly idempotent will act on live records.

If you must, at least set `NODE_ENV=development` and **never** run `npm run seed`.

### Getting real data into a safe database

There is a nightly S3 snapshot job (`server/services/dbSnapshot.js`) that writes every collection as
gzipped JSON to `s3://<S3_BUCKET>/db-snapshots/YYYY-MM-DD/<collection>.json.gz` plus a
`_manifest.json` (`dbSnapshot.js:20-21,37,45`). You can run it manually:

```bash
cd server && node scripts/runDbSnapshot.js
```

> **There is no restore script.** Verified — nothing in `server/scripts/` or `server/services/`
> restores a snapshot. Restoring means downloading the `.json.gz` files and `mongoimport`-ing them
> yourself. Writing a restore script (and testing it) is a genuine day-one gap. See
> [09 — Operations, Backup & Recovery](09-operations-backup-recovery.md).

### Atlas IP allowlist

Atlas rejects connections from IPs that are not on the project's Network Access list. The symptom is
a boot failure that does **not** say "your IP is blocked" in an obvious way:

```
Error: Could not connect to any servers in your MongoDB Atlas cluster.
One common reason is that you're trying to access the database from an IP
that isn't whitelisted.
```

followed by `process.exit(1)` from `server/config/db.js:10`.

Fix: Atlas → **Network Access** → **Add IP Address** → **Add Current IP Address**. Remember that
home/office IPs are usually dynamic, and that switching to a VPN or a café network breaks it again.
This is the single most frequent "it worked yesterday" failure.

---

## 7. Step 5 — Create `client/.env`

```bash
touch client/.env
```

### The honest version: this file currently does nothing

The `client/.env` on the outgoing developer's machine contains exactly one key,
`REACT_APP_API_URL`. **No code reads it.** Verified:

```bash
grep -rn "REACT_APP" client --include='*.js' --include='*.json' --include='*.html' \
  | grep -v node_modules | grep -v '/build/'
# (no output)
```

The API base URL is derived purely from `NODE_ENV` at `client/src/utils/constants.js:157-159`:

```js
export const API_BASE_URL = process.env.NODE_ENV === 'production'
    ? '/api'                        // Relative path — same server serves API and frontend
    : 'http://localhost:5001/api';  // Development — separate servers
```

Consequences you need to internalise:

- **You cannot point the dev client at a different backend by setting an env var.** To do that you
  must edit `constants.js`.
- `http://localhost:5001` is hardcoded in the dev branch. If your server ends up on port 5000
  (see §0.3) the client cannot reach it, no matter what `client/.env` says.
- The Socket.IO client derives its URL from the same constant —
  `client/src/services/socket.js:6` does `API_BASE_URL.replace(/\/api\/?$/, '')` — so realtime
  follows the same rule.
- `client/src/services/userService.js:6-10` carries an explicit warning comment: do **not** set
  `axios.defaults.baseURL`, because in production `API_BASE_URL === '/api'` and every service
  already builds full URLs from it, so a baseURL would produce `/api/api/...`. Respect that comment.

**So: creating `client/.env` is optional and harmless.** Create it as an empty file (or don't create
it at all) and move on. `docs/engineering/05-environment-and-secrets.md` and
`docs/engineering/09-developer-onboarding.md` both claim `REACT_APP_API_URL` overrides the backend
URL. **That is wrong.** See [§13](#13-corrections-to-the-older-documentation).

---

## 8. Step 6 — Seed the database

```bash
npm run seed
```

### 8.1 What it deletes

`server/scripts/seedDatabase.js:35-37` — unconditionally, with no prompt:

- **all** `User` documents
- **all** `Consultant` documents
- **all** `Commitment` documents

It does **not** touch `Student`, `Meeting`, `HourlyActivity`, `Attendance`, `TestRecord`,
`Teacher`, `TimetableEntry`, `DocChunk`, or the other 18 collections. That is arguably worse than a
full wipe: you end up with orphaned students and commitments referencing `teamLead` ObjectIds that
no longer exist.

### 8.2 What it creates

| Group | Count | Detail |
|---|---|---|
| LUC admin | 1 | `admin@learnerseducation.com`, role `admin`, org `luc` (`:44-50`) |
| LUC team leads | 9 | Arfath, Bahrain, Manoj, Jamshad, Anousha, Shakil, Shasin, Shaik, Tony — each `@learnerseducation.com`, role `team_lead` (`:59-69`) |
| LUC consultants | 26 | Mapped to their team lead (`:95-105`) |
| Skillhub branch logins | 2 | `training@skillhub.com` (org `skillhub_training`), `institute@skillhub.com` (org `skillhub_institute`), role `skillhub` (`:129-144`) |
| Skillhub counselors | 4 | Shiju, Divyanji (Training); Umme, Ayisha (Institute) |

Passwords are randomly generated per run — 12 characters from a fixed alphabet
(`seedDatabase.js:13-20`). **They are different every time you seed.** There are no fixed default
credentials anywhere in this system.

### 8.3 It rewrites `LOGIN_CREDENTIALS.md` — and that file is committed

`seedDatabase.js:224-226` writes the freshly generated plaintext passwords to
`<repo-root>/LOGIN_CREDENTIALS.md` and also prints them to stdout.

> ### ⚠️ `LOGIN_CREDENTIALS.md` is tracked by git
>
> Verified: `git ls-files --error-unmatch LOGIN_CREDENTIALS.md` succeeds. It is **not** in
> `.gitignore`.
>
> `docs/engineering/09-developer-onboarding.md` states it is gitignored. **That is wrong.** After
> running `npm run seed`, `git status` will show a modified `LOGIN_CREDENTIALS.md` containing live
> plaintext passwords, and it is easy to commit it by reflex.
>
> Immediate mitigations: add it to `.gitignore`, `git rm --cached LOGIN_CREDENTIALS.md`, and treat
> every password currently in git history as compromised. Tracked in
> [11 — Credentials & Access](11-credentials-and-access-handover.md).

### 8.4 Safer alternatives

| Script | Destructive? | Use when |
|---|---|---|
| `cd server && node scripts/seedSkillhub.js` | **No** — creates only the 2 Skillhub logins + 4 counselors; never touches LUC data. Explicitly documented as production-safe at `seedSkillhub.js:12-14`. | You only need Skillhub accounts. |
| `cd server && node scripts/createManager.js` | Upserts one `manager` user. ⚠️ **Contains a hard-coded email and password at `createManager.js:5-6`.** Change them before running; treat the committed value as an exposed credential. | You need a manager login. |
| `cd server && node scripts/resetBahrainPassword.js` | Resets one specific user's password. | Targeted password reset. |

Legacy seeds also exist in `server/utils/` (`seedUsers.js`, `seed2025.js`, `seedTeamBased2025.js`).
**They are not wired into any npm script and are stale** — `seedUsers.js` creates users with a
`consultant` role that the current `User` model no longer accepts. `HOW_TO_RUN.md` tells you to run
`node utils/seedUsers.js`; ignore it.

---

## 9. Step 7 — Run it

```bash
npm run dev
```

From the repo root. This starts both processes under `concurrently`, interleaving their output with
`[0]` (server) and `[1]` (client) prefixes.

### 9.1 Expected output

Server side (`[0]`), roughly in this order:

```
Server running in development mode on port 5001
MongoDB Connected: <cluster-host>
[db-snapshot] S3 not configured — nightly backup disabled
[birthdays] student birthday reminders scheduled — 08:00 Asia/Dubai
Docs RAG: loaded 215 chunks (N questions in exact-match index) in NNNms
```

Notes on each:

- `port 5001` — if this says **5000**, your `.env` is not being read. Stop and fix it.
- The `[db-snapshot]` warning is **correct and expected** locally (`server/server.js:168-170`).
- The birthday cron is scheduled unconditionally outside test mode (`server/server.js:176-186`).
  It runs at 08:00 Asia/Dubai and writes `Notification` documents — **another reason not to point
  a long-running local server at production**.
- The Docs RAG line depends on `DocChunk` rows existing in your database. On a fresh empty database
  you will see `loaded 0 chunks`, which is fine — `/api/docs-chat` returns 503 until an admin
  triggers an ingest. Boot is never blocked on it (`server/server.js:134-144`).

Client side (`[1]`):

```
Compiled successfully!
You can now view client in the browser.
  Local:            http://localhost:3001
```

CRA usually opens the browser for you.

### 9.2 Verify, concretely

```bash
# 1. API is alive
curl -s http://localhost:5001/api/health
# {"success":true,"message":"Server is running"}

# 2. Docs RAG readiness (this route is public — no auth)
curl -s http://localhost:5001/api/docs-chat/health

# 3. Login end-to-end. Use an email + password from the run of `npm run seed`.
curl -s -X POST http://localhost:5001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@learnerseducation.com","password":"<from LOGIN_CREDENTIALS.md>"}'
# Expect: {"success":true,"token":"eyJ...","user":{...}}

# 4. Front end
open http://localhost:3001
```

Route surface for step 3: `server/routes/auth.js` exposes `POST /login`, `GET /logout`, `GET /me`,
`PUT /updatepassword`, and an admin-only `POST /register`. Health is defined inline at
`server/server.js:99-104`.

After logging in through the UI, `HomeRedirect` in `client/src/App.js` sends you to
`/admin/dashboard`, `/team-lead/dashboard`, `/skillhub/dashboard`, or `/student-database` depending
on your role. See [07 — Roles & Permissions](07-roles-and-permissions.md).

### 9.3 Running the halves separately

Two terminals, which gives you cleaner logs and lets you restart one side independently:

```bash
# Terminal 1
npm run dev:server     # nodemon; restarts on any file change under server/

# Terminal 2
npm run dev:client     # CRA dev server with hot reload on 3001
```

Or drop to the raw commands:

```bash
cd server && npm run dev     # nodemon server.js
cd client && npm start       # PORT=3001 react-scripts start
```

> **Windows note:** `client/package.json:37` uses the POSIX inline-env form
> `PORT=3001 react-scripts start`, which **does not work in cmd.exe or PowerShell**. On Windows use
> WSL, or `set PORT=3001 && npx react-scripts start`. There is no `cross-env` in the dependency
> tree. UNVERIFIED — the project has never been run on Windows.

### 9.4 The working-directory trap for scripts

`server/server.js:1` and 33 of the 42 scripts in `server/scripts/` call
`require('dotenv').config()` **with no path**, so they read `.env` from the current working
directory. Only 9 scripts use the explicit form
`require('dotenv').config({ path: path.join(__dirname, '../.env') })` —
among them `seedDatabase.js:1`, `seedSkillhub.js:1`, `migrateOrganization.js:1`,
`createManager.js:1` and `ingestProgramDocs.js:13`.

**Practical rule: always `cd server` before running anything in `server/scripts/`.** Running
`node server/scripts/backfillCommitmentDate.js` from the repo root loads no environment at all, and
that script correctly aborts with `MONGODB_URI is not set. Aborting.` — but others will not be so
polite.

The same trap applies to the server itself: `node server/server.js` from the repo root finds no
`.env`, binds port 5000, and dies on the Mongo connect.

---

## 10. Step 8 — Run the tests

### 10.1 Server

```bash
cd server
npm test
```

Verified result on Node 24.10.0 at the time of writing:

```
Test Suites: 14 passed, 14 total
Tests:       140 passed, 140 total
Time:        ~8 s
```

The 14 suites:

| Directory | Suites | Covers |
|---|---|---|
| `tests/exports/` | 6 | Export Center raw + pivot queries, dataset access matrix, templates, rate limiting. Includes a 66-row anonymized fixture at `tests/exports/fixtures/students_2026-04-22.json` that codifies four reference-workbook pivots. |
| `tests/institute/` | 4 | Attendance, tests/marks upsert, schedule import parsing, birthdays. |
| `tests/commitments/` | 3 | Admission-close irreversibility, grade/year handling, demo normalisation. |
| `tests/meetings/` | 1 | Meeting CRUD + the conditional-`required`-on-update trap. |

Infrastructure: Jest 29.7.0 + supertest + `mongodb-memory-server`, which downloads and caches a real
`mongod` binary under `~/.cache/mongodb-binaries` (observed: `mongod-arm64-darwin-6.0.14` and
`7.0.24`). **The first run needs internet access** to fetch that binary and will be slow; subsequent
runs are fast and fully offline. `testTimeout` is 60 s (`server/package.json:13`) partly for this
reason. Tests never touch your `MONGODB_URI` — `tests/exports/_setup.js:12-17` spins its own
in-memory instance.

> ### ⚠️ `npm test` does not run all the tests
>
> `server/package.json:9`:
>
> ```
> "test": "jest --testPathPattern=\"tests/(exports|meetings|institute|commitments)\""
> ```
>
> But `testMatch` is `<rootDir>/tests/**/*.test.js`. There are **20** test files on disk; the
> pattern runs **14**. The six excluded files live in `tests/execOverview/` (3) and `tests/hourly/` (1)
> — plus two of the exports/institute files are already counted, so concretely the excluded suites
> are:
>
> - `tests/execOverview/aggregate.test.js`
> - `tests/execOverview/bucketing.test.js`
> - `tests/execOverview/teamEntryController.test.js`
> - `tests/hourly/selfConsultantGuard.test.js`
>
> Running them explicitly (verified):
>
> ```bash
> cd server && npx jest tests/execOverview tests/hourly
> # Test Suites: 1 failed, 3 passed, 4 total
> # Tests:       1 failed, 52 passed, 53 total
> ```
>
> The single failure is **real and long-standing**:
> `tests/execOverview/aggregate.test.js:166` — `getExecutiveOverview › rolls up KPI totals across
> all teams` expects `ytdTarget` of `350000` and receives `510000`.
>
> So: three of the four excluded suites pass and are being hidden for no reason, and the fourth
> encodes a genuine discrepancy between the Executive Overview aggregation and its spec. Either the
> aggregation double-counts targets or the fixture is stale — **UNVERIFIED which**; see
> [10 — Known Issues & Roadmap](10-known-issues-and-roadmap.md).
>
> **Do not "fix" this by deleting the test.** And be aware that a green `npm test` is not a green
> test suite.

Useful variations:

```bash
cd server
npx jest                                   # every suite, including the excluded ones
npx jest tests/institute/tests.test.js     # one file
npx jest -t "rolls up KPI totals"          # one test by name
npx jest --watch                           # watch mode
npx jest --coverage                        # coverage report (no threshold is configured)
```

Note `--testPathPattern` is Jest 29 syntax. Jest 30 renamed it to `--testPathPatterns`; if you ever
bump Jest, `npm test` breaks silently-ish with an unrecognised-option error.

### 10.2 Client

```bash
cd client
npm test
```

The script is `react-scripts test --watchAll=false` (`client/package.json:39`), so it runs once and
exits — no watcher, CI-friendly by default. Verified result:

```
Test Suites: 6 passed, 6 total
Tests:       39 passed, 39 total
Time:        ~3 s
```

| File | Covers |
|---|---|
| `src/components/exports/__tests__/DataGrid.test.js` | react-data-grid wrapper |
| `src/components/exports/__tests__/ExportCenterPage.test.js` | Page-level state sync |
| `src/components/exports/__tests__/HeaderDownloadButtons.test.js` | Mode-aware download |
| `src/components/exports/__tests__/PreviewTab.test.js` | Raw ↔ pivot mode flip |
| `src/services/__tests__/xlsxBuilder.test.js` | `pivotResultToSheet` pure function |
| `src/utils/__tests__/timetableStudents.test.js` | Timetable student extraction |

Expect a repeated warning — `[baseline-browser-mapping] The data in this module is over two months
old` — from a transitive browserslist dependency. It is noise, not a failure.

For watch mode: `npx react-scripts test` (without `--watchAll=false`).

### 10.3 What is *not* tested

There is no E2E layer (no Playwright/Cypress), no lint script in any package, no type checking (the
codebase is plain JavaScript), and no CI configuration. Coverage is concentrated on Export Center,
Institute, meetings and commitments; auth, students, hourly, chat, docs-RAG, exec-overview, tiers,
announcements and payment plans have little or none.

---

## 11. Optional setup for specific features

### 11.1 Docs RAG (LUC program-docs chatbot)

Only needed if you are working on the chat drawer. Requires `OPENAI_API_KEY` (embeddings) and
ideally `GROQ_API_KEY` (generation).

```bash
# Parse + chunk only. No OpenAI calls, no DB writes, no Mongo connection needed —
# do this first to confirm the PDFs parse.
cd server && node scripts/ingestProgramDocs.js --dry-run

# Full ingest (idempotent by contentHash), then regenerate highlight PDFs
npm run ingest:docs

# Nuke all LUC chunks and rebuild from scratch (~$0.02, 2-3 min per DEPLOYMENT.md)
npm run ingest:docs:force
```

Source PDFs live in `client/public/program-docs/<slug>/` — currently 8 program slugs
(`ioscm-l7`, `knights-bsc`, `knights-mba`, `malaysia-mba`, `othm-l5`, `ssm-bba`, `ssm-dba`,
`ssm-mba`), two PDFs each. `npm run ingest:docs` chains into `npm run highlight:docs`, which is
where Python is required; without it the ingest still succeeds but the in-drawer PDF preview has no
highlighted pages to show.

Generated artefacts (`client/public/program-docs-highlighted/`,
`client/public/program-docs-snippets/`) and `server/program-docs-manifest.json` are build outputs —
the manifest is gitignored.

All three `/program-docs*` static mounts sit behind `docsRagEnabled` → `protect` → `orgGate('luc')`
(`server/server.js:59-96`), so they 401/403/503 rather than 404 when you hit them unauthenticated.

### 11.2 Realtime (Socket.IO)

Nothing to configure. `server/services/realtime.js:16-18` skips init entirely when
`NODE_ENV === 'test'`, and CORS reflects the request origin so dev 3001 → 5001 works out of the box.

### 11.3 Building the production bundle locally

Useful for reproducing a production-only bug (the SPA fallback and the `/api` relative base URL only
exist in production mode):

```bash
npm run build                        # cd client && npm install && npm run build
cd server && NODE_ENV=production npm start
open http://localhost:5001           # one origin serves both SPA and API
```

`client/build/` is gitignored and not tracked. Render runs the equivalent — see
[04 — Deployment & Infrastructure](04-deployment-and-infrastructure.md). Note there is **no
`render.yaml` and no `Procfile`**: the build and start commands exist only in the Render dashboard.

---

## 12. Common setup failures

Ordered roughly by how often they bite.

| Symptom | Cause | Fix |
|---|---|---|
| Browser at `http://localhost:3000` shows nothing / a different app | The client runs on **3001**, not CRA's default 3000 (`client/package.json:37`). `HOW_TO_RUN.md` says 3000 — it is stale. | Go to `http://localhost:3001`. |
| Login shows "Network Error"; server log says `running ... on port 5000` | `server/.env` missing or has no `PORT`. `server/server.js:119` falls back to 5000. The client hardcodes 5001 (`constants.js:158`). | Create `server/.env` with `PORT=5001`. Confirm you are running via `npm run dev` (which `cd`s into `server/`) and not `node server/server.js` from the root. |
| `Error: The 'uri' parameter to openUri() must be a string, got "undefined"` then exit | `MONGODB_URI` not loaded — usually wrong working directory, not a wrong value. | `cd server` first, or check `server/.env` exists and is named exactly `.env`. |
| `Could not connect to any servers in your MongoDB Atlas cluster ... IP that isn't whitelisted` | Atlas Network Access does not include your current IP. Recurs whenever your IP changes (VPN, new network). | Atlas → Network Access → Add Current IP Address. |
| Server boots fine, `/api/health` OK, but login returns 500 | Missing `JWT_SECRET` (`secretOrPrivateKey must have a value`) or missing `JWT_EXPIRE` (`"expiresIn" should be a number of seconds or string representing a timespan`). Nothing validates these at boot. | Set both in `server/.env`. |
| `Error: listen EADDRINUSE :::5001` (or 3001) | A previous run is still bound. | `lsof -ti:5001 \| xargs kill -9` and `lsof -ti:3001 \| xargs kill -9`. |
| `npm run install:all` "succeeds" but `client/node_modules` is missing | The `&&` chain aborted at the server install; you only saw the tail. | Read the whole output, or run the three installs by hand. |
| `error: externally-managed-environment` during install | PEP 668 blocks system-wide pip. The `\|\| echo` fallback hides it. | Use a venv (§4.2). Only affects `npm run highlight:docs`. |
| First `cd server && npm test` hangs or fails downloading | `mongodb-memory-server` is fetching a `mongod` binary. | Ensure internet access on the first run; it caches to `~/.cache/mongodb-binaries`. |
| `npm test` green but you know a feature is broken | The test script filters to 4 directories and hides 4 suites, one of which genuinely fails (§10.1). | Run `npx jest` with no arguments. |
| AI endpoints 500 with `OPENAI_API_KEY is not configured on the server` | Key absent. Clients are lazily constructed, so boot succeeded. | Set `OPENAI_API_KEY`, restart. |
| `/api/docs-chat` returns 503 | Zero `DocChunk` rows loaded at boot — normal on a fresh database. | Run `npm run ingest:docs`, or ignore if you are not working on the chatbot. |
| Boot warns `[db-snapshot] S3 not configured` | Expected locally. Not an error. | Leave AWS vars unset on your laptop. |
| Changed a `DOCS_RAG_*` variable, nothing happened | `server/config/docsRagConfig.js` parses env once at require-time. | Restart the server. |
| Following `HOW_TO_RUN.md` and nothing matches | That file is badly out of date (port 3000, absolute paths under `/Users/viditkbhatnagar/`, `utils/seedUsers.js`, obsolete `consultant` role, fixed test passwords). | Use this document. §13. |
| Ran a `server/scripts/*.js` from the repo root and it did nothing / used no config | 33 of 42 scripts call bare `dotenv.config()` and read `.env` from the cwd. | Always `cd server` first. |

---

## 13. Corrections to the older documentation

The `docs/engineering/` set was last updated 2026-04-26 and is roughly 207 commits behind. It is
still useful for orientation, but the following statements relevant to setup are **wrong**. Where
they conflict, trust this document and the code.

| Source | Claim | Reality |
|---|---|---|
| `docs/engineering/09-developer-onboarding.md` | "Credentials are written to `LOGIN_CREDENTIALS.md` (gitignored)." | **It is tracked by git.** Verified with `git ls-files --error-unmatch LOGIN_CREDENTIALS.md`. Not in `.gitignore`. |
| `docs/engineering/09-developer-onboarding.md` | "There are **no** backend tests outside `server/tests/exports/`." | There are now 20 test files across 6 directories: `exports`, `meetings`, `institute`, `commitments`, `execOverview`, `hourly`. |
| `docs/engineering/09-developer-onboarding.md` | `cd teamProgressTracker` after cloning. | `git clone` creates `Consultant_Progress_Tracker_LUC`. |
| `docs/engineering/09-developer-onboarding.md`, `docs/engineering/05-environment-and-secrets.md` | `REACT_APP_API_URL` overrides the backend URL. | **Nothing reads it.** `client/src/utils/constants.js:157-159` derives the URL from `NODE_ENV` alone. |
| `docs/engineering/05-environment-and-secrets.md` | Lists 10 server env vars. | Misses `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_CHAT_MODEL`, `LLM_PRIMARY`, `LLM_FALLBACK`, and the five `DOCS_RAG_*` knobs. Full list in §5.1. |
| `docs/engineering/05-environment-and-secrets.md` | `JWT_REFRESH_EXPIRE` — "Required: Yes". | **Not referenced anywhere in the server source.** There is no refresh flow. |
| `docs/engineering/05-environment-and-secrets.md`, `09` | Atlas is the "Ireland cluster". | The connection string in `server/.env.example` points at a cluster hosted as `dev.gdddmth.mongodb.net`. **UNVERIFIED which region it is actually in** — check the Atlas dashboard. This matters: `DEPLOYMENT.md` notes that a Render/Atlas region mismatch adds ~25 s to every cold boot because the Docs RAG index ships ~5 MB of embeddings at startup. |
| `HOW_TO_RUN.md` (repo root) | Frontend on port 3000; seed with `node utils/seedUsers.js`; fixed passwords like `Admin@123`; absolute paths under `/Users/viditkbhatnagar/`; a `consultant` user role. | All stale. Ports are 3001/5001, the seed is `npm run seed`, passwords are randomly generated per run, and `consultant` is not a valid `User` role. **Treat this file as historical.** |
| `DEPLOYMENT.md`, `DEPLOYMENT_GUIDE.md` | "Node.js (v14 or higher)"; Heroku/Ubuntu deployment sections. | Node 14 will not run this code. The Heroku and bare-Ubuntu sections describe deployments that do not exist — production is a single Render web service. The **Docs RAG cutover** section (from line 407) is current and useful. |
| `CLAUDE.md` | `backfillCommitmentDate.js` sets `commitmentDate = weekStartDate`. | The script actually uses `createdAt` — see its header comment at `server/scripts/backfillCommitmentDate.js:1-10`. |

---

## 14. Maintenance and one-off scripts

Not part of setup, but you will need them. All live in `server/scripts/`; **run them from
`server/`**.

| Script | Destructive? | Purpose |
|---|---|---|
| `seedDatabase.js` (`npm run seed`) | 🔴 **Yes** | Wipes Users/Consultants/Commitments, recreates baseline accounts, rewrites `LOGIN_CREDENTIALS.md`. |
| `seedSkillhub.js` | 🟢 No | Skillhub-only accounts; explicitly production-safe. |
| `createManager.js` | 🟡 Upsert | Creates/updates one manager. Has a hard-coded password at `:6` — change it. |
| `migrateOrganization.js` | 🟢 Idempotent | Backfills `organization: 'luc'` across 7 collections for pre-multi-tenant documents. |
| `backfillCommitmentDate.js` | 🟢 Idempotent | Fills missing `commitmentDate` from `createdAt`. Aborts cleanly if `MONGODB_URI` is unset. |
| `runDbSnapshot.js` | 🟢 Read-only | Manual S3 snapshot; same routine as the 00:30 Asia/Dubai cron. |
| `ingestProgramDocs.js` | 🟡 `--force` deletes chunks | Docs RAG ingest. Supports `--dry-run`. |
| `importInstituteFromExcel.js`, `importStudents.js`, `clearAndImportStudents.js` | 🔴 `clearAnd…` wipes | Excel/CSV imports. |
| ~35 others (`fix*`, `audit*`, `verify*`, `profile*`, `backfill*`) | Varies | Point-in-time data repairs. Read the header comment before running any of them; several were written for a single incident and are not generally safe. |

---

## 15. Setup checklist

```
[ ] Node 20+ installed (24.x matches what was used); node -v
[ ] Repo cloned from github.com/viditkbhatnagar/Consultant_Progress_Tracker_LUC
[ ] npm run install:all completed — check the TAIL of the output
[ ] Python deps installed, or accepted as skipped (only affects highlight PDFs)
[ ] Decided which database to use — NOT production for day-to-day work
[ ] Own Atlas cluster created, or local mongod 6.0+ running
[ ] Your IP added to Atlas Network Access (if using Atlas)
[ ] server/.env created with PORT=5001, NODE_ENV, MONGODB_URI, JWT_SECRET, JWT_EXPIRE
[ ] Did NOT copy the credentials out of server/.env.example
[ ] client/.env is empty or absent (it is inert)
[ ] npm run seed run ONLY against a database you own
[ ] LOGIN_CREDENTIALS.md is NOT staged for commit
[ ] npm run dev boots; server log says "port 5001"
[ ] curl http://localhost:5001/api/health returns success
[ ] Logged in at http://localhost:3001 with a seeded account
[ ] cd server && npm test → 14 suites / 140 tests pass
[ ] cd client && npm test → 6 suites / 39 tests pass
[ ] Ran npx jest (server) once, and know that execOverview/aggregate has 1 real failure
```

---

## Related documents

Handover pack (this folder):

- [00 — START HERE](00-START-HERE.md) — the map, reading order, and the five traps
- [01 — System Architecture](01-system-architecture.md) — how the pieces fit together
- [02 — Application Workflows](02-application-workflows.md) — feature-by-feature tour
- [03 — Database Schema](03-database-schema.md) — the 27 models and the Atlas configuration
- [04 — Deployment & Infrastructure](04-deployment-and-infrastructure.md) — Render, build and start commands, production env vars
- [06 — API Reference](06-api-reference.md) — every endpoint
- [07 — Roles & Permissions](07-roles-and-permissions.md) — the 4 roles, 3 organisations, and how scoping is enforced
- [08 — Dependencies & Integrations](08-dependencies-and-integrations.md) — OpenAI, Groq, AWS S3, MongoDB Atlas, Render
- [09 — Operations, Backup & Recovery](09-operations-backup-recovery.md) — snapshots, and the missing restore path
- [10 — Known Issues & Roadmap](10-known-issues-and-roadmap.md) — including the failing `execOverview` spec
- [11 — Credentials & Access Handover](11-credentials-and-access-handover.md) — **where the env values come from, and the rotation runbook**

Older documentation — useful for context, stale where it conflicts with the above:

- [`docs/engineering/09-developer-onboarding.md`](../engineering/09-developer-onboarding.md)
- [`docs/engineering/05-environment-and-secrets.md`](../engineering/05-environment-and-secrets.md)
- [`docs/engineering/04-deployment-runbook.md`](../engineering/04-deployment-runbook.md)
- [`docs/engineering/08-database-and-migrations.md`](../engineering/08-database-and-migrations.md)

Repository-root files:

- `README.md` — broadly accurate, includes an env-var name list
- `DEPLOYMENT.md` — the "Docs RAG Feature — Render Deploy Cutover" section (from line 407) is current
- `CLAUDE.md` — the most detailed and most current narrative of the codebase's traps
- `HOW_TO_RUN.md` — **stale, do not follow**
