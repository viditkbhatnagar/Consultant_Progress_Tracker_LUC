# Credentials & Access Handover

This document is the **complete inventory** of every credential, account and access grant required to
run, deploy and maintain the Sales Tracker platform.

> ## ⚠️ Read this before anything else
>
> **This document deliberately contains no secret values.** No API keys, no passwords, no database
> connection strings, no tokens.
>
> That is not an oversight and it is not withholding. It is the correct handover procedure, for two
> reasons:
>
> 1. **A document like this gets emailed, forwarded and committed to git.** Any secret written here
>    is permanently exposed to everyone who ever touches the file, including in git history where it
>    is very hard to remove.
> 2. **The outgoing developer is leaving the organisation.** Every secret they had access to must be
>    treated as compromised on their last day and **rotated** — not transferred. Handing over the
>    existing keys means the departing person retains live production access indefinitely.
>
> The correct process is therefore: **rotate → hand over the new value through a secure channel →
> the outgoing developer never sees the new value.** Section 4 is the runbook for exactly that.
>
> The requesting email already anticipated this: *"Sensitive credentials may be shared through a
> secure channel if appropriate."* This document is the map; the secure channel carries the values.

---

## 1. Account ownership transfer

These are the **accounts** that own the infrastructure. Transferring these matters more than any
individual key — whoever controls the account can regenerate every key beneath it.

Work through this table first. Until ownership moves to a company-controlled identity, the platform
depends on a personal account belonging to someone who has left.

| # | Service | What it holds | Current owner | Action required | Priority |
|---|---|---|---|---|---|
| 1 | **GitHub** | The source code | Personal account `viditkbhatnagar` | Transfer repo to a company org, or add new maintainer as **Owner** | 🔴 Critical |
| 2 | **Render** | Production hosting, all env vars | Account tied to outgoing dev | Add new dev as team member, then transfer ownership + billing | 🔴 Critical |
| 3 | **MongoDB Atlas** | **All production data** | Atlas project owner | Add new dev to the Atlas project as Owner; move billing | 🔴 Critical |
| 4 | **AWS** | S3 bucket (DB backups + poster images) | AWS account `635394566074` | Grant IAM access; transfer account or migrate bucket | 🟠 High |
| 5 | **OpenAI** | Billed API usage | Personal/org OpenAI account | Move to company billing; issue new key | 🟠 High |
| 6 | **Groq** | Billed API usage (Docs RAG) | Groq account | Move to company billing; issue new key | 🟡 Medium |
| 7 | **Domain / DNS** | Public URL | — | Confirm who controls DNS for the production hostname | 🟡 Medium |

> **The single largest risk on this list is #3.** The production database lives in an Atlas project
> owned by an individual. If that account is closed, disabled or its payment method lapses, the
> business loses its data. Resolve this first, before any code handover.

---

## 2. The repository

| | |
|---|---|
| **URL** | `https://github.com/viditkbhatnagar/Consultant_Progress_Tracker_LUC` |
| **Visibility** | Private |
| **Default branch** | `main` |
| **History** | 394 commits, first commit 2025-11-28 |
| **CI/CD** | None configured. Render deploys automatically on push to `main` |
| **Branch protection** | None. `main` is directly pushable — consider enabling protection + PR review |

There is **one** repository. There are no sibling repos, submodules or private package registries —
the entire platform (server, client, docs, scripts) is in this single repo.

### Files in the repo that contain secrets

These must **never** be committed. Verify `.gitignore` still covers them after any change.

| Path | Contains | Committed? |
|---|---|---|
| `server/.env` | All server secrets | No — gitignored ✅ (`.gitignore:56`) |
| `client/.env` | API base URL only (not secret) | No — gitignored ✅ |
| `LOGIN_CREDENTIALS.md` | **Plaintext passwords for all 12 app accounts** | 🔴 **YES — see the warning below** |

> ## 🔴 CONFIRMED EXPOSURE: application passwords are in git history
>
> **Verified 2026-09-05.** `LOGIN_CREDENTIALS.md` is **currently tracked in `HEAD`**, is **not**
> gitignored, and appears in **6 commits** going back to the initial commit (2025-11-28):
>
> | Commit | Date | Passwords recoverable |
> |---|---|---|
> | `6fc56e9` | 2026-04-14 | 12 |
> | `9a48434` | 2025-12-02 | 10 |
> | `e35a85e` | 2025-12-02 | 10 |
> | `f357290`, `6103f34`, `8af0f87` | 2025-11-28/29 | (earlier sets) |
>
> **What this means:** anyone who has ever cloned this repository — now or in the future — can
> recover every application password with a single `git show`. Deleting the file today does **not**
> remove it from history.
>
> **Required actions, in order:**
> 1. **Reset all 12 application passwords** (§5). This is mandatory, not discretionary — treat the
>    current passwords as public.
> 2. `git rm --cached LOGIN_CREDENTIALS.md` and add it to `.gitignore`, so no new versions are
>    committed.
> 3. Decide on history: purging it (`git filter-repo`, or BFG) rewrites every commit hash and
>    requires a force-push plus a re-clone by everyone. Given the repository is private and the
>    passwords will have been rotated in step 1, **rotation is usually sufficient** and history
>    rewriting is optional. Rewrite only if policy demands it.
> 4. Confirm the seed script's future output is gitignored — `npm run seed` regenerates this file.

---

## 3. Secret inventory

Every secret the platform needs. **Values are redacted by design** — see the warning at the top.

Each of these must be present as an environment variable on the Render service, and in a local
`server/.env` for development.

### 3.1 Secrets — must be rotated on departure

| Env var | What it is | Protects | Blast radius if leaked |
|---|---|---|---|
| `MONGODB_URI` | Atlas connection string, **contains DB user + password** | All production data | 🔴 Total — full read/write of every record |
| `JWT_SECRET` | Signing key for auth tokens (46 chars) | Every user session | 🔴 Total — an attacker can forge a token for any user, including admin |
| `OPENAI_API_KEY` | OpenAI API key (164 chars) | Billed AI usage | 🟠 Financial — unbounded spend on your account |
| `GROQ_API_KEY` | Groq API key (56 chars) | Billed AI usage (Docs RAG) | 🟠 Financial |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key (20 chars) | S3 bucket | 🟠 Backups + poster images |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret | S3 bucket | 🟠 Same as above |

### 3.2 Configuration — not secret, safe to record here

These are settings, not credentials. Recorded in full so the service can be rebuilt from scratch.

| Env var | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` on Render (`development` locally) | Gates the cron jobs — they do **not** run when `test` |
| `PORT` | `5001` | ⚠️ If `server/.env` is missing, `server.js` falls back to **5000**, not 5001 |
| `JWT_EXPIRE` | `1h` | Access token lifetime |
| `JWT_REFRESH_EXPIRE` | `7d` | Refresh token lifetime |
| `S3_BUCKET` | `team-progress-tracker-635394566074` | Bucket name (identifier, not a secret) |
| `AWS_REGION` | `me-central-1` | UAE region |
| `LLM_PRIMARY` | `groq` | Docs RAG primary provider |
| `LLM_FALLBACK` | `openai` | Used when Groq fails |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` | |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | ⚠️ Changing this **invalidates every stored embedding** — a full re-ingest is required |
| `GROQ_CHAT_MODEL` | `llama-3.3-70b-versatile` | |
| `DOCS_RAG_ENABLED` | `true` | Feature flag — set `false` to disable the docs chatbot |
| `DOCS_RAG_TOPK` | `5` | Chunks retrieved per query |
| `DOCS_RAG_MIN_SCORE` | `0.35` | Relevance floor; below this the bot refuses to answer |
| `DOCS_RAG_EXACT_MATCH_THRESHOLD` | see `server/.env` | QNA question-match threshold |
| `DOCS_RAG_CACHE_TTL_SECONDS` | see `server/.env` | Query cache TTL (24h) |

**Client** (`client/.env`) — one variable only:

| Env var | Local | Production |
|---|---|---|
| `REACT_APP_API_URL` | `http://localhost:5001/api` | Unset — production uses a relative `/api` path |

> ⚠️ CRA inlines `REACT_APP_*` variables into the built JavaScript **at build time**. Never put a
> secret in a `REACT_APP_*` variable — it ships to every browser in plain text.

### 3.3 Production database identifiers

| | |
|---|---|
| Cluster host | `dev.gdddmth.mongodb.net` |
| Database name | `team_progress_tracker` |
| Connection | `mongodb+srv`, credentials embedded in `MONGODB_URI` |

> ## ⚠️ The cluster is named "dev" but it **is production**
>
> There is no separate staging or development database. Local development, the local test scripts and
> the live Render service **all point at this same cluster**. A careless local script will modify
> live business data.
>
> This is the most dangerous piece of tribal knowledge in the entire handover. Treat every local run
> against `MONGODB_URI` as a production operation. Creating a genuine separate dev cluster should be
> an early priority for the incoming developer.

---

## 4. Rotation runbook — do this on the last working day

Rotate in this order. Each step is independent; the platform stays up throughout except where noted.

### 4.1 `JWT_SECRET`
1. Generate a new value: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
2. Update it in the Render dashboard → Environment.
3. Render restarts the service automatically.

> **Effect:** every existing session is invalidated and all users must log in again. This is expected
> and is exactly what you want when someone leaves. Do it at a quiet time and warn users.

### 4.2 `MONGODB_URI` (Atlas database user)
1. Atlas → Database Access → create a **new** database user with a new password.
2. Update `MONGODB_URI` on Render with the new user.
3. Confirm the app reconnects (check `GET /api/health`, then load a data page).
4. **Delete the old database user.** Rotation is not complete until the old one is gone.
5. Atlas → Network Access: review the IP allowlist and remove any personal/home IPs.

### 4.3 `OPENAI_API_KEY` and `GROQ_API_KEY`
1. Create a new key in each provider's dashboard.
2. Update on Render.
3. Revoke the old keys.
4. Set a monthly spend limit while you are in there — these are billed per-token and an
   unbounded key is a financial risk.

### 4.4 AWS keys
1. IAM → create a new access key for the service user (ideally a dedicated user scoped to **only**
   this S3 bucket, not a broad-permission key).
2. Update `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` on Render.
3. Verify the nightly snapshot still writes (see §6).
4. Deactivate, then delete, the old key.

### 4.5 Application user accounts
See §5 — all 12 application logins should have their passwords reset.

### 4.6 Account access
1. Remove the outgoing developer from GitHub, Render, Atlas, AWS, OpenAI and Groq.
2. Confirm removal by checking each service's member/collaborator list.

### 4.7 Rotation checklist

- [ ] `JWT_SECRET` rotated
- [ ] New Atlas DB user created, `MONGODB_URI` updated, **old user deleted**
- [ ] Atlas IP allowlist reviewed, personal IPs removed
- [ ] `OPENAI_API_KEY` rotated + old key revoked + spend limit set
- [ ] `GROQ_API_KEY` rotated + old key revoked
- [ ] AWS keys rotated + old key deleted
- [ ] All 12 application passwords reset
- [ ] Outgoing developer removed from all 6 services
- [ ] Deploy verified working after every rotation
- [ ] `LOGIN_CREDENTIALS.md` regenerated and confirmed gitignored

---

## 5. Application user accounts

The platform has **12 login accounts**, listed (with plaintext passwords) in `LOGIN_CREDENTIALS.md`
at the repo root. That file is generated by the seed script — it is **not** the live source of truth,
and its passwords may be stale if anyone has changed theirs.

| Account type | Count | Notes |
|---|---|---|
| LUC Admin | 1 | Full cross-organisation access |
| LUC Team Leads | 9 | Arfath, Bahrain, Manoj, Jamshad, Anousha, Shakil, Shasin, Shaik, Tony |
| Skillhub branch logins | 2 | `training@skillhub.com`, `institute@skillhub.com` |

**Actions on handover:**

1. 🔴 **Reset every password — mandatory.** Not merely because the outgoing developer has seen them,
   but because **all 12 are recoverable from git history** (confirmed — see §2). Anyone who has ever
   cloned the repo has them.
2. **Stop tracking the file:** `git rm --cached LOGIN_CREDENTIALS.md`, then add it to `.gitignore`.
   It is currently tracked in `HEAD` and is **not** ignored, so `npm run seed` will keep committing
   fresh passwords into history.
3. Passwords are stored hashed with bcrypt (`bcryptjs`), and the `password` field is `select: false`,
   so they are not exposed through the API. The risk is the plaintext file, not the database.

> ⚠️ **`npm run seed` WIPES DATA.** It deletes and recreates users and consultants, then rewrites
> `LOGIN_CREDENTIALS.md`. **Never run it against production.** Because the "dev" cluster is
> production (§3.3), this is a genuinely dangerous command in this repo.

---

## 6. Verifying access after handover

The new developer should confirm each access grant actually works, rather than assuming. Suggested
smoke test, in order:

| # | Check | How | Expected |
|---|---|---|---|
| 1 | GitHub | `git clone` the repo, then push a trivial branch | Succeeds |
| 2 | Render | Log in, view the service, view Environment vars | All vars visible |
| 3 | Atlas | Log in, browse `team_progress_tracker` collections | Data visible |
| 4 | Local run | `npm run install:all` then `npm run dev` | Server 5001 + client 3001 both start |
| 5 | Login | Sign in to the running app as admin | Dashboard loads |
| 6 | AWS/S3 | List the bucket; confirm a recent `db-snapshots/YYYY-MM-DD/` folder | Folder for last night exists |
| 7 | Deploy | Push a trivial change to `main`, watch Render | New build deploys and serves |
| 8 | AI | Use the "Ask me" chat in the app | Returns an answer (proves OpenAI/Groq keys work) |

> **Tip for #7:** to confirm a deploy actually reached production, fetch the site root and read the
> hashed bundle filename (`static/js/main.<hash>.js`) from the HTML. The hash is content-derived, so
> it changes when — and only when — new code is live. This is the most reliable deploy check
> available, since there is no version endpoint.

---

## 7. What is *not* covered by any credential

Worth stating plainly, because their absence is easy to mistake for a missing handover item:

- **No CI/CD system** — no GitHub Actions, no pipeline secrets. Deployment is Render's git auto-deploy.
- **No error tracking or APM** — no Sentry, Datadog or equivalent. No account to transfer, and no
  alerting exists. This is a gap, not an omission.
- **No email/SMS provider** — the app sends no outbound mail. Notifications are in-app only.
- **No payment gateway** — fee amounts are recorded as data; no money moves through the platform.
- **No `render.yaml` / Dockerfile** — infrastructure configuration exists **only** in the Render
  dashboard. If that service is deleted, the configuration is lost. Capturing it as
  Infrastructure-as-Code is a recommended early task.

---

## Related documents

| Doc | Purpose |
|---|---|
| [00-START-HERE](00-START-HERE.md) | Index and reading order |
| [01 System Architecture](01-system-architecture.md) | How the system fits together |
| [04 Deployment & Infrastructure](04-deployment-and-infrastructure.md) | Render, S3, Atlas, cron jobs |
| [05 Environment Setup](05-environment-setup.md) | Getting it running locally |
| [09 Operations, Backup & Recovery](09-operations-backup-recovery.md) | Snapshots and restore |
| [10 Known Issues & Roadmap](10-known-issues-and-roadmap.md) | Outstanding problems |
