# Application Workflows & Key Functionalities

This is the feature-by-feature tour of the Sales Tracker platform. Every feature listed here was
read out of the actual code at handover time — the route file, the controller, the model and the
React page are cited by path and line so you can jump straight to the source. Read it after
[01 — System Architecture](01-system-architecture.md) and
[07 — Roles & Permissions](07-roles-and-permissions.md): this document assumes you already know
that there are four roles (`admin`, `team_lead`, `manager`, `skillhub`), three organisations
(`luc`, `skillhub_training`, `skillhub_institute`), and that scoping is enforced server-side by
`buildScopeFilter` / `canAccessDoc` in `server/middleware/auth.js`. Where the older
`docs/engineering` and `docs/user-guides` sets (last touched 2026-04-26, ~207 commits ago) disagree
with the code, the code wins and the disagreement is called out explicitly.

---

## Contents

1. [How to read this document](#1-how-to-read-this-document)
2. [The feature map](#2-the-feature-map)
3. [Login & routing](#3-login--routing)
4. [Commitment Tracker / Demo Tracker](#4-commitment-tracker--demo-tracker)
5. [Student Database — LUC](#5-student-database--luc)
6. [Student Database — Skillhub](#6-student-database--skillhub)
7. [Meeting Tracker](#7-meeting-tracker)
8. [Hourly Tracker](#8-hourly-tracker)
9. [Skillhub Institute](#9-skillhub-institute)
10. [Leadership / Executive Overview suite](#10-leadership--executive-overview-suite)
11. [Tier Fight](#11-tier-fight)
12. [Payment Plans](#12-payment-plans)
13. [Export Center](#13-export-center)
14. [Chat copilot ("Ask me")](#14-chat-copilot-ask-me)
15. [Docs RAG (program-docs chatbot)](#15-docs-rag-program-docs-chatbot)
16. [AI Analysis & usage accounting](#16-ai-analysis--usage-accounting)
17. [Announcements](#17-announcements)
18. [Notifications](#18-notifications)
19. [Reconciliation](#19-reconciliation)
20. [Users & Consultants administration](#20-users--consultants-administration)
21. [Background jobs](#21-background-jobs)
22. [Core business rules](#22-core-business-rules)
23. [Cross-cutting mechanics you must understand](#23-cross-cutting-mechanics-you-must-understand)
24. [Where the old docs are wrong](#24-where-the-old-docs-are-wrong)
25. [Related documents](#25-related-documents)

---

## 1. How to read this document

Each feature section follows the same shape:

| Field | Meaning |
|---|---|
| **What it does** | The business purpose, in one paragraph |
| **Who uses it** | Roles + organisations that can reach it |
| **Front-end** | React route + page component + notable child components |
| **Back-end** | Route file, controller, models |
| **Endpoints** | Verb + path + role gate |
| **Business rules** | The non-obvious server-side logic, with line references |
| **Traps** | Things that will bite you |

All server paths are relative to the repo root. All API paths are relative to `/api` unless the
path already starts with `/api`.

**Two words appear constantly and mean different things:**

- **Consultant** — a `Consultant` document (`server/models/Consultant.js`). A salesperson or
  counselor. **They have no login.** Their work is entered by their team lead / branch login.
- **Team lead** — a `User` document with `role: 'team_lead'`. Has a login. Owns a team of
  consultants via the `teamLead` foreign key that appears on almost every tenant-scoped model.

The `skillhub` role is a *shared branch login* — one account per Skillhub branch
(`training@skillhub.com`, `institute@skillhub.com`). Server-side it behaves exactly like a team
lead: `buildScopeFilter` adds `{ teamLead: user._id }` for both roles
(`server/middleware/auth.js:81-83`). That is why every Skillhub record's `teamLead` field points at
the branch login user.

---

## 2. The feature map

### Routes (client) → page component

Source: `client/src/App.js:61-292`.

| Route | Page component | Roles (`PrivateRoute`) | Notes |
|---|---|---|---|
| `/login` | `pages/Login.js` | public | |
| `/` | `HomeRedirect` (inline, `App.js:33`) | authenticated | Redirects by role |
| `/admin/dashboard` | `pages/AdminDashboard.js` | admin | LUC ↔ Skillhub switch at the top |
| `/team-lead/dashboard` | `pages/TeamLeadDashboard.js` | team_lead | |
| `/skillhub/dashboard` | `pages/SkillhubDashboard.js` | skillhub | |
| `/commitments` | `pages/CommitmentsPage.js` | admin, team_lead, skillhub | Renamed "Demo Tracker" for Institute |
| `/student-database` | `pages/StudentDatabasePage.js` (dispatcher) | admin, team_lead, manager, skillhub | → LUC or Skillhub variant |
| `/meetings` | `pages/MeetingTrackerPage.js` (dispatcher) | admin, team_lead, skillhub | → LUC or Skillhub variant |
| `/hourly-tracker` | `pages/HourlyTrackerPage.js` (dispatcher) | admin, team_lead, skillhub | → LUC or Skillhub variant |
| `/institute` | `pages/InstitutePage.js` | admin, skillhub | Backend further restricts to Institute branch |
| `/leadership-dashboard` | `pages/ExecutiveOverviewPage.js` | admin, team_lead | |
| `/executive-overview` | *redirect* → `/leadership-dashboard` | — | Back-compat |
| `/team-dashboard/:teamLeadId` | `pages/TeamDetailPage.js` | admin, team_lead | "All Teams" sheet |
| `/team-dashboard` | `pages/TeamDetailPage.js` | team_lead | Own team |
| `/consultant-performance` | `pages/ConsultantPerformancePage.js` | admin, team_lead | Category A/B rankings |
| `/monthly-targets` | `pages/MonthlyTargetsPage.js` | admin, team_lead | Reachable from the sidebar: "Monthly Targets" inside the collapsible Leadership group (`components/AdminSidebar.js:326-335`, `components/Sidebar.js:277`) |
| `/tiers` | `pages/TierPage.js` | admin, team_lead | Tier Fight |
| `/payment-plans` | `pages/PaymentPlanTrackerPage.js` | admin, team_lead | |
| `/exports` | `pages/ExportCenterPage.js` | admin, team_lead, manager, skillhub | |
| `/admin/reconciliation` | `pages/AdminReconciliationPage.js` | admin | |
| `/pdf-viewer` | `pages/PdfViewer.js` | admin, team_lead | Auth-blob PDF for Docs RAG sources |
| `/admin/docs-rag` | *redirect* → `/admin/dashboard?section=ai-usage&tab=docs-rag` | — | Legacy bookmark |
| `/admin/api-costs` | *redirect* → `/admin/dashboard?section=ai-usage` | — | Legacy bookmark |
| `*` | *redirect* → `/` | — | |

`pages/ConsultantDashboard.js` (430 lines) is **dead code** — imported by nothing, routed nowhere.
It still calls `commitmentService.closeAdmission`, which is itself broken (see
[§4 Traps](#traps)).

### Route groups (server)

Source: `server/server.js:35-53`. Every group is mounted under `/api`.

| Mount | Route file | Controller | Org gate |
|---|---|---|---|
| `/api/auth` | `routes/auth.js` | `authController` | — |
| `/api/users` | `routes/users.js` | `userController` | — |
| `/api/commitments` | `routes/commitments.js` | `commitmentController` | inline |
| `/api/notifications` | `routes/notifications.js` | `notificationController` | per-user |
| `/api/consultants` | `routes/consultants.js` | `consultantController` | inline |
| `/api/students` | `routes/students.js` | `studentController` | inline |
| `/api/ai` | `routes/ai.js` | `aiController` | inline |
| `/api/hourly` | `routes/hourly.js` | `hourlyController` | inline |
| `/api/meetings` | `routes/meetings.js` | `meetingController` | inline |
| `/api/reconciliation` | `routes/reconciliation.js` | `reconciliationController` | hard-coded `luc` |
| `/api/exports` | `routes/exports.js` | `exportController` | `assertDatasetAccess` |
| `/api/chat` | `routes/chat.js` | `chatController` | — |
| `/api/docs-chat` | `routes/docsChat.js` | inline + `docsRagService` | `orgGate('luc')` |
| `/api/exec-overview` | `routes/execOverview.js` | `execOverviewController` | `orgGate('luc')` |
| `/api/team-entries` | `routes/teamEntries.js` | `teamEntryController` | `orgGate('luc')` |
| `/api/announcements` | `routes/announcements.js` | `announcementController` | inline |
| `/api/tiers` | `routes/tiers.js` | `tierController` | `orgGate('luc')` |
| `/api/payment-plans` | `routes/paymentPlans.js` | `paymentPlanController` | `orgGate('luc')` |
| `/api/institute` | `routes/institute.js` | `instituteController` | `assertInstitute()` |

Plus three auth-gated static mounts for the Docs RAG PDFs (`server/server.js:59-96`) and
`GET /api/health` (`server/server.js:99`).

---

## 3. Login & routing

**What it does.** Email + password → JWT. The token is sent on every subsequent request as
`Authorization: Bearer <jwt>`.

**Front-end.** `client/src/pages/Login.js`, `client/src/context/AuthContext.js`,
`client/src/components/PrivateRoute.js`.

**Back-end.** `server/routes/auth.js`, `server/controllers/authController.js`,
`server/models/User.js`.

| Verb | Path | Gate |
|---|---|---|
| POST | `/api/auth/register` | `protect` + `authorize('admin')` |
| POST | `/api/auth/login` | public |
| GET | `/api/auth/logout` | `protect` |
| GET | `/api/auth/me` | `protect` |
| PUT | `/api/auth/updatepassword` | `protect` |

**Business rules.**

- Passwords are bcrypt-hashed in a `pre('save')` hook (`server/models/User.js:75-82`) and the
  field is `select: false`, so it never comes back on a normal read.
- The JWT payload is only `{ id, role }` (`server/models/User.js:86`). **`organization` is
  deliberately not in the token** — `protect` re-loads the full `User` document from Mongo on
  every request (`server/middleware/auth.js:27`), so changing a user's organisation takes effect
  immediately without re-issuing tokens.
- `protect` also rejects deactivated accounts (`isActive === false`,
  `server/middleware/auth.js:36-41`). That is what makes the soft delete effective.
- After login, `HomeRedirect` (`client/src/App.js:33-52`) sends admin → `/admin/dashboard`,
  team_lead → `/team-lead/dashboard`, manager → `/student-database`, skillhub →
  `/skillhub/dashboard`.

**Traps.**

- **`POST /api/auth/register` cannot create a Skillhub user.** It builds the document from a
  fixed field list that omits `organization` (`server/controllers/authController.js:34-42`), so the
  schema default `'luc'` always wins. New Skillhub logins are created by
  `server/scripts/seedSkillhub.js` or by editing the document directly. If you add a
  Skillhub login through the admin UI it will land in the wrong tenant.
- Logout is client-side only (the token stays valid until expiry). This is flagged in the older
  security docs and is still true.
- `authController.register` still has a `role === 'consultant'` branch
  (`server/controllers/authController.js:21`). `consultant` is not in the `User.role` enum
  (`server/models/User.js:32`), so that path can only ever produce a validation error. Dead code.

---

## 4. Commitment Tracker / Demo Tracker

**What it does.** The core sales-activity log. A team lead (LUC) or branch login (Skillhub)
records, per consultant per week, what they committed to do for a specific lead, what actually
happened, where the lead sits in the funnel, and — when the deal lands — closes the admission.
For **Skillhub Institute** the same page is relabelled **"Demo Tracker"** because the branch uses
it to schedule and track up to four demo classes per prospective student.

**Who uses it.** `admin`, `team_lead`, `skillhub`. Not `manager`.

**Front-end.**

- Route `/commitments`, page `client/src/pages/CommitmentsPage.js` (692 lines).
- The page resolves `viewOrg` once (`CommitmentsPage.js:62-70`) — admin's selected org tab, or the
  user's own `organization` — and from that derives `isSkillhub` and `isInstitute`. The Institute
  label swap is `CommitmentsPage.js:69-70`.
- Three views: Table / Board (kanban by lead stage) / Cards —
  `components/commitments/CommitmentsTableView.js`, `…BoardView.js`, `…CardsView.js`, plus
  `CommitmentDetailDrawer.js`, `CommitmentsKPIStrip.js`, `CommitmentsToolbar.js`.
- Form dialogs: `components/commitments/CommitmentFormDialog.js` (LUC) and
  `components/skillhub/SkillhubCommitmentDialog.js` (Skillhub, with the demo slots).
- View + density preferences persist in `localStorage` under `commitments-ui-prefs`
  (`CommitmentsPage.js:35`).

**Back-end.** `server/routes/commitments.js`, `server/controllers/commitmentController.js`
(853 lines), `server/models/Commitment.js`.

**Endpoints.**

| Verb | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/commitments` | any authenticated | List, scoped; optional `weekNumber`+`year`, `status` |
| POST | `/api/commitments` | team_lead, skillhub, admin | Create |
| GET | `/api/commitments/date-range` | team_lead, admin, skillhub | Range query |
| GET | `/api/commitments/linkable` | admin, team_lead | Unlinked LUC commitments for the Student form picker |
| GET | `/api/commitments/ai-analysis` | admin, team_lead | OpenAI analysis of the tracker |
| GET | `/api/commitments/week/:weekNumber/:year` | any authenticated | Week slice |
| GET | `/api/commitments/consultant/:consultantName/performance` | team_lead, admin, skillhub | Per-consultant detail |
| PUT | `/api/commitments/:id/close-admission` | team_lead, admin, skillhub | Close an admission |
| PUT | `/api/commitments/:id/meetings` | team_lead, admin, skillhub | Update `meetingsDone` |
| GET | `/api/commitments/:id` | any authenticated | Read one |
| PUT | `/api/commitments/:id` | team_lead, admin, skillhub | Update |
| DELETE | `/api/commitments/:id` | admin | Hard delete |

Route ordering matters and is deliberate: every specific path is declared before the `/:id`
catch-all (`server/routes/commitments.js:30-62`). If you add a route, add it above `/:id`.

**Key model fields** (`server/models/Commitment.js`):

| Field | Notes |
|---|---|
| `weekNumber`, `year`, `weekStartDate`, `weekEndDate` | The committed week — Monday to Sunday |
| `commitmentDate` | **Required.** The actual calendar day being logged for. Distinct from `weekStartDate` |
| `leadStage` | 12-value enum, exported as `Commitment.LEAD_STAGES` (`Commitment.js:7-20`) |
| `status` | `pending` / `in_progress` / `achieved` / `missed` |
| `admissionClosed`, `admissionClosedDate`, `closedDate`, `closedAmount` | Deal closure |
| `demos[]` | Skillhub only — up to 4 slots (`DemoSlotSchema`, `Commitment.js:25-42`) |
| `gradeOrYear` | Skillhub Institute only — the demo student's grade |
| `studentId` | Reverse FK to the `Student` row created from this admission |
| `consultantName`, `teamName` | Denormalised so history survives a deleted consultant |

**Business rules.**

1. **`commitmentDate` must fall inside the committed week — for LUC team leads only.**
   `validateCommitmentDateInWeek` (`commitmentController.js:151-165`) compares `yyyy-mm-dd`
   strings so time-of-day is ignored. It is applied on create for `team_lead` but explicitly
   **skipped for `skillhub`** (`commitmentController.js:183-193`) because branch logins are the
   admins of their own branch and need to backfill history that predates the rollout. Admins
   bypass it too. Same asymmetry on update (`commitmentController.js:331-347`).

2. **Defensive `commitmentDate` backfill.** If a client posts without `commitmentDate` but with
   `weekStartDate`, the server copies one to the other (`ensureCommitmentDate`,
   `commitmentController.js:141-146`; the update path repeats it inline at
   `commitmentController.js:323-329`). This exists because `commitmentDate` was added after
   launch and a cached client bundle would otherwise 400 — or, worse, blank the stored value on
   a `runValidators` update.

3. **Auto-close.** A row that lands at `leadStage: 'Admission'` **and** `status: 'achieved'` gets
   `admissionClosed: true` even if the client didn't ask for it — on create
   (`commitmentController.js:210-217`) and on update, where the incoming patch is merged with the
   stored doc first so a partial update still triggers it (`commitmentController.js:269-284`).
   `closedAmount` is *not* auto-filled: revenue does not move until someone edits the row and
   enters it.

4. **Closing sets four fields at once**: `admissionClosedDate = now`, `status = 'achieved'`,
   `achievementPercentage = 100`, and (via the dedicated endpoint) `leadStage = 'Admission'`
   (`commitmentController.js:219-224` and `closeAdmission`, `commitmentController.js:412-450`).

5. **Closure is irreversible, twice over.** Sending `admissionClosed: false` on a closed row is a
   400 (`commitmentController.js:294-300`). Sending any `status` other than `'achieved'` on a
   closed row is also a 400 (`commitmentController.js:307-316`) — that second guard was added
   because inline status popovers could otherwise leave `admissionClosed: true` next to
   `status: 'missed'`, and every "achieved OR closed" aggregate then counted the row
   inconsistently.

6. **Demo slots (Skillhub only).** `normalizeDemos`
   (`commitmentController.js:26-69`, exported for tests) enforces: at most the four labels
   `Demo 1..4`, no duplicates, `done: true` requires a `scheduledAt`, `doneAt` is server-stamped
   (never trusted from the client, never in the future), clearing `done` clears `doneAt`. Demos
   are **stripped entirely** from LUC commitments on both create and update
   (`commitmentController.js:233-236`, `356-359`) — a LUC row can never carry them.

7. **`demoDoneBy`** on a demo slot is a plain name string, not a `Teacher` ref
   (`Commitment.js:39`), deliberately: renaming or removing a teacher must not rewrite history.
   The Institute UI populates the dropdown from `instituteService.getTeachers()`.

8. **Delete is admin-only and hard.** `deleteCommitment` re-checks the role even though the route
   already gates it (`commitmentController.js:380-386`) and then calls `deleteOne()` (`:397`).
   There is no soft delete on `Commitment`, despite an unused `isActive` field on the schema
   (`Commitment.js:235-238`).

**Traps.**

- <a name="traps"></a>**The "Close admission" button is wired to a route that does not exist.**
  `client/src/services/commitmentService.js:59` issues `PATCH /api/commitments/:id/close`; the
  server only exposes `PUT /api/commitments/:id/close-admission`
  (`server/routes/commitments.js:54`). A `PATCH` to a two-segment path matches nothing and 404s.
  Callers: `client/src/pages/CommitmentsPage.js:443` (the drawer's "Close admission" action) and
  the dead `ConsultantDashboard.js:130`. The working path to closure is the ordinary edit dialog —
  set `leadStage: 'Admission'` + `status: 'achieved'` and auto-close fires. Fix by changing the
  client to `axios.put(.../close-admission)`. *(Code-verified; not reproduced against production.)*
- `commitmentService.updateMeetings` has the same shape of mismatch: client `PATCH /:id/meetings`
  (`commitmentService.js:68`) vs server `PUT /:id/meetings`. Nothing in the current UI calls it.
- `Commitment` has both a `commitmentMade` field and a virtual-ish `description` getter/setter
  aliasing it (`Commitment.js:133-143`). Write to either; they are the same column.

---

## 5. Student Database — LUC

**What it does.** The admissions register: one row per admitted LUC student, with programme,
university, fees, lead source, dates, and the consultant/team who closed it.

**Who uses it.** `admin` (all teams), `team_lead` (own team), `manager` (read-oriented; this is
the *only* dashboard a manager has — `HomeRedirect` sends them straight here).

**Front-end.** `/student-database` → `pages/StudentDatabasePage.js` (a 23-line dispatcher) →
`pages/LucStudentDatabasePage.js` (792 lines). Table paginates at 50 rows
(`LucStudentDatabasePage.js:49`). KPI strip is `components/students/StudentsKPIStrip.js` and is
driven by a *separate* server aggregation (`GET /api/students/stats`) so the numbers reflect the
whole filtered window, not the current page. Form: `components/StudentFormDialog.js`.

**Back-end.** `server/routes/students.js`, `server/controllers/studentController.js` (945 lines),
`server/models/Student.js`.

**Endpoints.**

| Verb | Path | Roles |
|---|---|---|
| GET | `/api/students` | admin, team_lead, manager, skillhub |
| POST | `/api/students` | admin, team_lead, skillhub |
| GET | `/api/students/stats` | admin, team_lead, manager, skillhub |
| GET | `/api/students/programs` | admin, team_lead |
| GET | `/api/students/:id` | admin, team_lead, manager, skillhub |
| PUT | `/api/students/:id` | admin, team_lead, skillhub |
| DELETE | `/api/students/:id` | admin, team_lead, skillhub |
| PATCH | `/api/students/:id/activate` | admin, skillhub — Skillhub only |
| PATCH | `/api/students/:id/status` | admin, skillhub — Skillhub only |

**Business rules.**

1. **Every new LUC student must be linked to a Commitment.** `createStudent` refuses the write
   unless the payload carries a valid `commitmentId` *or* `manualEntry: true` with a non-empty
   `manualEntryReason` (`studentController.js:363-388`). A commitment that is already linked
   returns 409. This is the "FK spine" that removed name-matching drift between the two trackers.
   Skillhub bypasses it entirely — Skillhub admissions do not go through the Commitment lifecycle.
2. **Linking is bidirectional and closes the commitment.** After the student is created the
   controller writes `Commitment.studentId` and, if the commitment wasn't already closed, flips
   `admissionClosed`/`admissionClosedDate`/`status`/`achievementPercentage`
   (`studentController.js:437-450`).
3. **`sno` auto-increments.** `Student.getNextSno(teamLeadId, organization)`
   (`Student.js:339-346`) reads the highest existing `sno` **within the team** for LUC and
   **within the organisation** for Skillhub, and adds one. It is a read-then-write with no lock —
   two simultaneous creates on the same team can collide. There is no unique index on `sno`, so
   the failure mode is a duplicate serial, not an error.
4. **`month` and `conversionTime` are derived, not entered.** A `pre('validate')` hook
   (`Student.js:298-338`; the LUC branch is `:300-317`) sets `conversionTime` =
   ceil(|closingDate − enquiryDate|) in days, and
   `month` = the English month name of `closingDate` read via `getUTCMonth()` (deliberately UTC —
   the form posts UTC midnight, and a local-time read would shift the label by one month for
   part of the year).
5. **Payload validation happens server-side too.** `validateStudentPayload`
   (`studentController.js:16-50`) rejects future enquiry/closing/enrollment dates, a closing date
   before the enquiry date, and any total-paid (admission fee + registration fee + EMI paid) that
   exceeds `courseFee`. These were the top data-entry bugs found by
   `server/scripts/auditLucStudentsDeep.js`.
6. **626 LUC rows are hidden platform-wide.** `applyHideLucZeroFeeFilter`
   (`studentController.js:57-74`) appends `{ $or: [ {organization: {$ne:'luc'}}, {admissionFeePaid: {$gt: 0}} ] }`
   to the filter. LUC rows with `admissionFeePaid` of 0/null/unset are excluded from lists,
   from `/stats`, from reconciliation and from the Export Center. They are still in the database
   (a backup dump lives under `server/dumps/luc_zero_admission_fee_*.json`); the root cause was an
   importer bug. **There is no UI toggle.** Call sites: `studentController.js:218`, `:830`,
   `reconciliationController.js:46,68,97,106`, `services/exports/pivots/students.js:172`.
7. **Delete is a hard delete**, gated only by `canAccessDoc` (`studentController.js:608-634`).
   A team lead can permanently destroy a student row on their own team. There is no soft-delete
   flag and no confirmation on the server side.

**Traps.**

- The LUC `required` fields (`program`, `university`, `source`, `companyName`, `residence`, …) use
  the conditional validator `lucOnly` (`Student.js:50-52`). **Conditional `required` silently
  passes on `findByIdAndUpdate`** because Mongoose runs update validators in *query* context, so
  `this.organization` is `undefined`. If you add a field like this you must also re-check it in
  JavaScript inside the controller — see how `meetingController.updateMeeting` does it for
  `program` (`meetingController.js:298-313`).
- `createStudent` swallows errors into a bare 500 (`studentController.js:456-462`) instead of
  calling `next(error)` like every other handler, so Mongoose validation messages surface as
  500s rather than 400s.

---

## 6. Student Database — Skillhub

**What it does.** Same route, different world. A Skillhub student is a school pupil enrolled in
a curriculum with subjects, a course fee, and an EMI schedule — not a LUC programme admission.

**Who uses it.** `admin` (via the org switch) and the two `skillhub` branch logins, each scoped to
their own branch.

**Front-end.** `/student-database` → dispatcher → `pages/SkillhubStudentDatabasePage.js`
(819 lines). Two axes of tabs:

- **Curriculum tabs** — driven by `curriculumSlug`: `CBSE`, `IGCSE`, `IELTS`, `GRE`, `SAT`.
- **Status tabs** — `new_admission` (default) / `active` / `inactive`
  (`SkillhubStudentDatabasePage.js:65`).

KPI cards: student count for the current status, Course Fees, Outstanding, Counselors
(`SkillhubStudentDatabasePage.js:249-270`).

**Skillhub-specific model fields** (`server/models/Student.js:131-197`):

| Field | Rule |
|---|---|
| `enrollmentNumber` | **Required + unique. Entered by hand** by the counselor. The UI hints at `SH/IGCSE/26/11/042` but does not enforce it |
| `curriculum` | Enum: `CBSE`, `IGCSE-Cambridge`, `IGCSE-Edexcel`, `IGCSE-AQA`, `IELTS`, `GRE`, `SAT` |
| `curriculumSlug` | Derived board — `"IGCSE-Edexcel"` → `"IGCSE"`; everything else stored verbatim, falling back to `'CBSE'` for an unrecognised board (`Student.js:321-329`) |
| `yearOrGrade`, `academicYear`, `mode`, `courseDuration` | All required for Skillhub |
| `academicYear` | Enum `2024-25` / `2025-26` / `2026-27` |
| `subjects[]` | Enum of 11 values (`Student.js:9-21`) |
| `emis[]` | `{ dueDate, amount, paidOn, paidAmount }` |
| `phones` / `emails` | Three contacts each: `student`, `mother`, `father` |
| `studentStatus` | `new_admission` → `active` → `inactive` |
| `outstandingAmount` | **Virtual**: `courseFee − admissionFeePaid − registrationFee − Σ emis.paidAmount`, floored at 0 (`Student.js:349-362`) |

**Business rules.**

1. **Enrollment numbers are manual.** They used to be auto-generated from the `Counter`
   collection; that pre-validate hook was removed in commit `8464e77` (2026-04-17,
   *"feat(skillhub): manager feedback — enrollment, board/variant, academic year, Meeting
   activity"*). The root `CLAUDE.md` cites this as `c5effc2` — **that hash does not exist in this
   repository** (`git cat-file -t c5effc2` fails); `8464e77` is the commit that actually deleted
   the `Counter` require and the `SH/${curriculumSlug}/…` generator from `server/models/Student.js`.
   `Counter` (`server/models/Counter.js`) is still in the repo but **unused** — nothing outside the
   model file references it. Do not reuse the collection key
   `enroll:{organization}:{IGCSE|CBSE}:{year}` without checking.
2. **Activation collects extra data.** `PATCH /:id/activate`
   (`studentController.js:641-693`) is the specific `new_admission → active` transition: it
   accepts `addressEmirate`, `registrationFee`, `dateOfEnrollment` and `emis[]` alongside the
   status flip, and refuses non-Skillhub students and already-active students.
   `PATCH /:id/status` (`studentController.js:706-756`) is the generic version for every other
   transition and takes only `studentStatus`.
3. **Date filters use a different field.** For Skillhub scopes the `startDate`/`endDate` filter
   applies to `createdAt`, not `closingDate` — Skillhub admissions do not reliably carry a closing
   date (`studentController.js:788-802`, mirrored in `getStudents`).
4. **The `outstandingAmount` virtual does not survive `.lean()` or `$group`.** Any aggregation
   that needs it must run `withSkillhubFinancials(pipeline)`
   (`server/services/exports/pivots/_shared.js`) or reproduce the `$addFields` maths, as
   `getStudentStats` does (`studentController.js:832-862`).

**Traps.**

- `client/src/utils/constants.js:60-65` exports `SKILLHUB_CURRICULA` with only the four
  CBSE/IGCSE values, while the server enum (`Student.js:24-32`) also has `IELTS`, `GRE`, `SAT`.
  The forms compose the value from the `SKILLHUB_BOARDS` + `SKILLHUB_IGCSE_VARIANTS` cascade
  (`constants.js:92-112`), which *does* include all of them, so the stale constant is currently
  harmless — but do not reuse it.
- The Training branch has **zero students** and has never had any. Institute is the live branch.
  A "Skillhub is broken" report is far more likely to be "you were looking at Training".

---

## 7. Meeting Tracker

**What it does.** A log of every meeting held with a lead: date, mode, who took it, what stage the
lead moved to. Separate from the Commitment Tracker's `meetingsDone` counter.

**Who uses it.** `admin`, `team_lead`, `skillhub`. Delete is admin-only.

**Front-end.** `/meetings` → `pages/MeetingTrackerPage.js`. This file is a **dispatcher plus the
LUC page in one module**: `LucMeetingTrackerPage` is defined at `MeetingTrackerPage.js:57`, and
the default export at `:553-554` resolves the org and returns `SkillhubMeetingTrackerPage`
instead when it is a Skillhub scope. Add org-specific behaviour by branching *there*, not by
sprinkling org checks through the LUC page.

- Skillhub view: `pages/SkillhubMeetingTrackerPage.js` (303 lines) +
  `components/skillhub/SkillhubMeetingDialog.js`. Institute-shaped: no Program field, plus
  **Demo done by** — a teacher-name dropdown fed by `instituteService.getTeachers()`. That
  dropdown and its filter render only when `viewOrg === 'skillhub_institute'`
  (`SkillhubMeetingTrackerPage.js:45`), because the teachers endpoint 403s for a Training login.

**Back-end.** `server/routes/meetings.js`, `server/controllers/meetingController.js` (554 lines),
`server/models/Meeting.js`.

| Verb | Path | Roles |
|---|---|---|
| GET | `/api/meetings` | admin, team_lead, skillhub |
| POST | `/api/meetings` | admin, team_lead, skillhub |
| GET | `/api/meetings/stats` | admin, team_lead, skillhub |
| GET | `/api/meetings/ai-analysis` | admin, team_lead |
| GET | `/api/meetings/:id` | admin, team_lead, skillhub |
| PUT | `/api/meetings/:id` | admin, team_lead, skillhub |
| DELETE | `/api/meetings/:id` | admin |

**Business rules.**

1. **`status` reuses the Commitment lead-stage enum.** `Meeting.js:3` imports `LEAD_STAGES` from
   `Commitment.js` so the two never drift.
2. **Meeting modes**: `Zoom`, `Out Meeting`, `Office Meeting`, `Student Meeting`
   (`Meeting.js:5`).
3. **`consultant` is optional; `consultantName` is not.** When a team lead conducts the meeting
   themselves there is no `Consultant` document to point at (team leads live in `User`), so the
   ref stays null and `denormalizeNames` (`meetingController.js:29-48`) defaults
   `consultantName` to the team lead's name.
4. **`meetingTakenBy[]`** is a separate multi-select array of name strings for co-led meetings,
   independent of the single `consultant` ref that drives scoping and reporting
   (`Meeting.js:106-109`).
5. **A LUC meeting with `status: 'Admission'` must link to a Commitment** — same escape hatch as
   the Student form (`manualEntry` + reason), same 400s
   (`meetingController.js:230-260`). Skillhub bypasses it.
6. **`program` is `required: [lucOnly, …]` and that rule cannot fire on update.** The controller
   therefore re-checks it in JavaScript against the *stored* document's organisation
   (`meetingController.js:298-313`). This is the canonical example of the conditional-required
   trap; the spec is locked by `server/tests/meetings/meetings.test.js`.
7. **Admin-created Skillhub meetings derive ownership from the counselor.** Admin has no branch
   token, so the client picks a counselor and the meeting's `teamLead` comes from that
   counselor's populated `teamLead._id`. `team_lead` / `skillhub` callers always get org +
   ownership from their own token (`meetingController.js:205-216`).
8. **Non-admins cannot reassign ownership** — `teamLead` and `organization` are deleted from the
   update body for anyone who isn't admin (`meetingController.js:288-292`).
9. **Listing defaults to "show all"** with a hard cap of 20,000 rows
   (`meetingController.js:72`). `GET /stats` returns a lean projection over the *whole* filter
   window so the KPI strip is not limited to the current page
   (`meetingController.js:128-168`).
10. **Search is regex-escaped** before it hits Mongo (`meetingController.js:97`) — a raw `(`
    from the search box would otherwise throw.

**Trap.** `GET /api/meetings/ai-analysis` is deliberately still `admin, team_lead` only
(`server/routes/meetings.js:30`). It is LUC-shaped and OpenAI-billed. Do not widen it until a
Skillhub UI actually calls it.

---

## 8. Hourly Tracker

**What it does.** A per-consultant, per-day grid of hourly slots. Each slot records what the
consultant was doing — calls, follow-ups, meetings, demos, admin work — so the team lead can see
how the day was actually spent. Also carries per-day admission and reference counters, and an
AI-generated daily leaderboard.

**Who uses it.** `admin`, `team_lead`, `skillhub`. **The routes have no role gate at all** —
`server/routes/hourly.js:24` only applies `protect`; all scoping is inline in the controller.

**Front-end.** `/hourly-tracker` → `pages/HourlyTrackerPage.js` (2,068 lines — the LUC grid) which
dispatches to `pages/SkillhubHourlyTrackerPage.js` (1,267 lines) for Skillhub scopes
(`HourlyTrackerPage.js:124-127`). Slot/activity metadata that must match the server lives in
`client/src/utils/hourlyConfig.js`.

**Back-end.** `server/routes/hourly.js`, `server/controllers/hourlyController.js` (1,795 lines —
the largest controller in the codebase), `server/models/HourlyActivity.js`,
`server/models/DailyAdmission.js`, `server/models/DailyReference.js`,
`server/utils/hourlyConstants.js`.

**Endpoints** (all `protect`, no role gate):

| Verb | Path | Purpose |
|---|---|---|
| GET | `/api/hourly/day` | One day's slots |
| PUT | `/api/hourly/slot` | Upsert one slot |
| DELETE | `/api/hourly/slot` | Clear one slot |
| DELETE | `/api/hourly/day` | Clear a whole day |
| GET | `/api/hourly/month` | Month view |
| GET | `/api/hourly/consultants` | Consultants for the grid |
| GET | `/api/hourly/admissions` · PUT · GET `/admissions/month` | Per-day admission counts |
| GET | `/api/hourly/references` · PUT · GET `/references/month` | Per-day reference counts |
| GET | `/api/hourly/leaderboard` | AI daily leaderboard (`?groupBy=team` for team-level) |
| GET | `/api/hourly/leaderboard/weekly` | AI weekly leaderboard |
| GET | `/api/hourly/ai-analysis` | AI day analysis |

**Slots.** Fixed IDs, org-dependent (`server/utils/hourlyConstants.js:2-31`):

| | LUC | Skillhub |
|---|---|---|
| Slots | `s0930 s1030 s1130 s1230 s1400 s1500 s1600 s1700 s1800 s1900` | the same plus `s1300` |
| Lunch | 1:00–2:00 is a **UI-only gap**, no DB slot | 2:00–3:00 (`s1400`) is a real slot flagged `isLunch` — counselors sometimes work through it |

**Activity types** (`hourlyConstants.js:38-62`):

- LUC (10): `call`, `followup`, `call_followup`, `noshow`, `drip`, `meeting`, `zoom`, `outmeet`,
  `teammeet`, `tlmeet`.
- Skillhub (8): `sh_call`, `sh_followup_admission`, `sh_schedule`, `sh_break`, `sh_demo_meeting`,
  `sh_meeting`, `sh_payment_followup`, `sh_operations`.

**Business rules.**

1. **Two record shapes coexist.** The legacy/LUC shape is flat (`activityType`, `count`,
   `duration`); the Skillhub shape puts a list in `activities[]`
   (`HourlyActivity.js:52-67`). The flat fields still mirror the first item for old readers.
   **`getActivityItems(doc)` (`hourlyController.js:113-130`) is the one place that normalises
   both** — every aggregator must go through it. Its aggregation-pipeline twin is
   `normalizeHourlyActivities()` in `server/services/exports/pivots/_shared.js`. Do not write a
   third normaliser.
2. **A multi-activity slot requires a note** (`hourlyController.js:337-343`).
3. **Three LUC activity types are immutable once saved**: `call`, `followup`, `call_followup`
   (`LOCKED_TYPES`, `hourlyController.js:103`). Skillhub has no locked types.
4. **Long meetings occupy continuation slots.** `getContinuationSlots(startSlotId, mins, org)`
   (`hourlyConstants.js:76-92`) walks the org's slot list and returns the following slot IDs to
   mark `isContinuation: true`. Continuation rows are excluded from leaderboards
   (`hourlyController.js:1329`) so a two-hour meeting is not double-counted.
5. **Uniqueness.** `{ consultant, date, slotId }` is a unique index
   (`HourlyActivity.js:89-92`). `DailyAdmission` and `DailyReference` are unique on
   `{ consultant, date }`.
6. **Team-lead "self-consultant" rows are hidden.** Some team leads have a `Consultant` document
   named after themselves, where their personal sales land.
   `isTeamLeadSelfConsultant` / `excludeSelfConsultants`
   (`hourlyController.js:42-55`, exported for tests) drop those rows from the grid, the AI
   analysis and every leaderboard. Detection is name equality (case-insensitive, trimmed) between
   the consultant and its populated team lead.
7. **A consultant can be hidden from the tracker without being deactivated** —
   `Consultant.excludeFromHourly` (`Consultant.js:43-46`) keeps historical-only counselors
   assignable on student forms while removing them from the grid.
8. **Scoping quirk**: `hourlyScopeFilter` (`hourlyController.js:18-21`) deliberately *strips*
   the `teamLead` clause that `buildScopeFilter` adds, so the tracker is org-scoped rather than
   team-scoped. `leaderboardConsultantScope` (`hourlyController.js:28-34`) additionally lets a
   **LUC** team lead see the entire LUC tenant so they can benchmark against other teams.
9. **Leaderboards are LLM-generated, not computed.** `getLeaderboard`
   (`hourlyController.js:1315+`) aggregates real counters, formats them into a prompt with
   explicit weighting guidance, and asks `gpt-4o-mini` to rank and score
   (`hourlyController.js:1461-1468`). Every call writes an `AIUsage` row with a hand-computed cost
   (`$0.00000015`/prompt token, `$0.0000006`/completion token — `hourlyController.js:1476` for
   the consultant leaderboard, `:1402` for the `?groupBy=team` variant; the same two constants are
   repeated at `:949` and `:1068` in the Skillhub paths). The Skillhub path
   (`runSkillhubAnalysis` at `hourlyController.js:797`, `runSkillhubLeaderboard` at
   `:966`) uses a coaching-institute prompt and a
   deterministic pre-sort weight: `admissions×15 + demoMeetings×6 + followupAdmissions×4 +
   meetings×3 + paymentFollowups×3 + calls×1 + schedules×0.5`; break and operations score zero
   (`hourlyController.js:888-896`).

---

## 9. Skillhub Institute

The largest single feature. Five tabs on one page, backed by one controller and five collections.

**What it does.** Runs the day-to-day teaching operation of the Skillhub Institute branch:
faculty, the weekly timetable, daily attendance, weekly test marks, and a per-student attendance
report you can send to a parent.

**Who uses it.** Route-gated to `admin` and `skillhub` (`server/routes/institute.js:59`). The
controller then calls `assertInstitute(req, res)` (`instituteController.js:22-28`) at the top of
**every** handler: admin always passes; a `skillhub` login passes only if its organisation *is*
`skillhub_institute`. A **Training login gets a 403**. Every query and every write is pinned to
`skillhub_institute` regardless of what the caller sends.

**Front-end.** `/institute` → `pages/InstitutePage.js` (64 lines), rendered inside the standard
`DashboardShell` with the role-appropriate sidebar. Tab order is
**Timetable · Attendance · Tests · Report · Teachers** (`InstitutePage.js:48-59`) — the guards are
plain `{tab === n}` checks, so if you reorder the `<Tab>` elements you must renumber the guards.

| Tab | Component |
|---|---|
| Timetable | `components/institute/TimetableTab.js` (+ `ImportScheduleDialog.js`) |
| Attendance | `components/institute/AttendanceTab.js` |
| Tests | `components/institute/TestsTab.js` |
| Report | `components/institute/AttendanceReportTab.js` |
| Teachers | `components/institute/TeachersTab.js` |
| (dashboard panel) | `components/institute/BirthdaysCard.js` |

**Back-end.** `server/routes/institute.js`, `server/controllers/instituteController.js`
(950 lines), `server/services/institute/scheduleParser.js`,
`server/config/instituteSubjects.js`. Models: `Teacher`, `TimetableEntry`, `Attendance`,
`TestRecord`, `InstituteEnrollment`.

**Endpoints.**

| Verb | Path | Purpose |
|---|---|---|
| GET / POST | `/api/institute/teachers` | List / create |
| PUT / DELETE | `/api/institute/teachers/:id` | Update / **soft** delete |
| GET / POST | `/api/institute/timetable` | List / create session |
| PUT / DELETE | `/api/institute/timetable/:id` | Edit / delete session |
| POST | `/api/institute/timetable/import` | Excel schedule upload (rate-limited) |
| GET | `/api/institute/students` | Institute students, for the "add to class" picker |
| GET | `/api/institute/birthdays` | Upcoming birthdays (`?days=`, 1–365, default 45) |
| GET | `/api/institute/attendance/meta` | Grades (data-derived) + subjects (canonical list) |
| GET / POST / DELETE | `/api/institute/attendance/roster` | Class list membership |
| DELETE | `/api/institute/attendance/entry` | Cancel one student's mark on one date |
| DELETE | `/api/institute/attendance/student` | Remove a student from a whole grade |
| GET / POST | `/api/institute/attendance` | Read / bulk-mark |
| GET | `/api/institute/tests/meta` | Grades + subjects for the test pickers |
| GET / POST | `/api/institute/tests` | Filtered list / bulk save a session |
| PUT / DELETE | `/api/institute/tests/:id` | Edit / delete one result |

### 9.1 Teachers

Records only — **teachers have no login** (`Teacher.js` header comment). Delete is a **soft**
delete (`isActive = false`, `instituteController.js:82-95`) precisely because
`TimetableEntry.teacherName` is denormalised: history must keep rendering.

### 9.2 Timetable

A `TimetableEntry` is one recurring weekly session: teacher, day, raw time text, grade/year,
curriculum, subject, `studentLabel` (the raw "Grade / Student" cell) and resolved `students[]`
refs. Times are stored as **free text** because the source sheets are wildly inconsistent
(`"12.30 pm - 1.30 pm"`, `"5 pm to 6 pm"`); `startMinutes` is a best-effort parse used only for
ordering (`parseStartMinutes`, `instituteController.js:115-126`). The tab also offers a
**"By Student"** view built from `client/src/utils/timetableStudents.js`.

### 9.3 Schedule Excel import — read this before touching it

`POST /api/institute/timetable/import` (`instituteController.js:205-402`). Upload shape: **one
sheet per teacher, sheet name = teacher name**. Row 1 is a header; each later row is a session
(`Day | Time | Grade / Student | Year | Subject | Curriculum`). Column lookup is by header name
with fallbacks because sheets vary.

- **Two-phase.** `dryRun=true` parses and reports, writing nothing. `dryRun=false` applies.
  The multipart field arrives as a string, so the check is `String(req.body?.dryRun) === 'true'`
  (`instituteController.js:212`).
- **Parsing is pure.** `parseScheduleWorkbook(buffer)`
  (`server/services/institute/scheduleParser.js`) takes a Buffer and returns
  `{ teachers, timetable, warnings }`. No DB, no filesystem — shared by the endpoint, by
  `scripts/importInstituteFromExcel.js`, and by the tests.
- **Applying REPLACES only the teachers present in the file.** One teacher's upload can never
  wipe another's schedule. Within a teacher the order is deliberate: capture old ids →
  `insertMany(new)` → `deleteMany(old)` (`instituteController.js:365-386`). A mid-way failure
  therefore leaves **duplicates** (visible, fixable) rather than an emptied schedule.
- **There is no transaction.** Instead, *every* row is validated with `probe.validateSync()`
  before the first write (`instituteController.js:311-334`); a bad row anywhere rejects the whole
  upload with a 400 and zero writes. If a write still fails partway, the error message names
  exactly whose schedule already changed (`instituteController.js:388-400`).
- **Merged Day cells are the norm and must keep working.** Excel merges the Day column down each
  day's block, so continuation rows arrive blank and the parser forward-fills the last day.
  Without that it silently dropped most of a normal schedule — and the replace then deleted those
  real sessions. A **non-blank** day cell that cannot be parsed is reported in `warnings` with its
  Excel row number, never dropped quietly. Abbreviations (`Mon`, `Thurs`) and date-formatted day
  cells are handled (`scheduleParser.js:45-57`).
- **Teachers are matched case-insensitively**, created if new, **re-activated** if previously
  soft-deleted, and their `subjects` are **unioned** so manual additions survive a re-import
  (`instituteController.js:355-364`). Two sheets whose names normalise alike collapse to one
  teacher — grouping by the normalised key is what stops the second pass deleting what the first
  inserted (`instituteController.js:289-298`).
- **Student names are resolved** to `Student` refs by exact normalised full name, else a *unique*
  first-name hit; ambiguous or unknown names import as plain text and are reported in
  `unmatchedStudents` (`instituteController.js:224-254`).
- **Guard rails.** Multer: memory storage, 8 MB, 1 file, extension must be
  `.xlsx/.xlsm/.xls/.csv`, with multer's own errors translated into the app's response shape
  (`routes/institute.js:13-53`). Rate limit: 10 uploads/min per user
  (`routes/institute.js:29-36`). Parser: max 100 sheets, 5,000 rows/sheet, 5,000 sessions
  (`scheduleParser.js:25-27`).
- Subjects from the sheet run through `canonicalizeSubject()` so an import cannot reintroduce the
  duplicate spellings the canonical-subject work removed.

Specs: `server/tests/institute/scheduleImport.test.js`.

### 9.4 Roster & enrollment

The **roster** for a class is the union of three sources (`getRoster`,
`instituteController.js:445-483`): `InstituteEnrollment` (the durable class list), plus every
student who appears in `Attendance` or `TestRecord` history for that scope. The union exists so
classes that predate the enrollment collection still have a roster.

- **A roster is per (grade/year, subject), not per grade.** Passing `subject` scopes it.
  Without that scoping a student added under (Year 13, Biology) appeared under every other Year 13
  subject.
- `POST /attendance/roster` is **idempotent** — a `findOneAndUpdate` with `$setOnInsert` + upsert
  against a unique index (`instituteController.js:520-543`, `InstituteEnrollment.js:37-40`), so a
  double-click cannot duplicate a row. `subject` is **required** here.
- `DELETE /attendance/roster` **with** `subject` removes just that subject; **without** `subject`
  it removes the student from the entire grade. It deletes enrollments **and** attendance **and**
  test records for the scope (`instituteController.js:554-577`) — because the roster is a union
  of all three, leaving any one behind puts the student straight back on the list. That is
  exactly why a student who landed in the wrong grade via a stray test result was previously
  undeletable.

### 9.5 Attendance

- `POST /api/institute/attendance` is a **bulk replace** for one `(date, gradeOrYear, subject)`
  key: delete the key, insert the submitted set, one row per student
  (`instituteController.js:614-686`). Idempotent per key.
- The delete-first step matches legacy spellings via `subjectMatchCondition(subject)`, so a day
  stored as `"Maths"` is properly replaced when re-marked as `"Math"`; the insert always writes
  the canonical spelling.
- Dates are normalised to **UTC midnight** — `dayStart` / `dayEnd` via `Date.UTC(...)`
  (`instituteController.js:625-627`) — so single-day reads bucket correctly.
- **Marking also enrolls.** Every marked student is upserted into `InstituteEnrollment`
  (a `bulkWrite` of `$setOnInsert` upserts, `ordered: false`, errors swallowed by a bare
  `.catch()` — the marks are already saved, `instituteController.js:660-674`), so a roster built
  purely by marking self-heals.
- Two different deletes: `DELETE /attendance/entry` cancels **one** mark (the student keeps every
  other record and stays on the roster, `instituteController.js:688`+);
  `DELETE /attendance/student` wipes the student from the whole grade.
- Status enum is only `Present` / `Absent` (`Attendance.js:29`). Anything else in the payload is
  filtered out silently by the `.filter()` at `instituteController.js:641`.

### 9.6 Tests

Weekly test marks per grade: `studentName`, `testTopic`, `subject`, `marksObtained`, optional
`maxMarks` (renders as `X / Y (Z%)`), `curriculum`, `teacher`, `date`. Bulk marks-entry per grade
from the roster, plus per-row edit/delete and xlsx/csv export. Filters: subject, teacher, grade,
date range, student search.

- **`createTests` upserts one row per student**, keyed on
  `(organization, date@UTC-midnight, gradeOrYear, subject, testTopic, studentName)` —
  **not** delete-then-insert (`instituteController.js:833-899`). Re-recording a session only
  touches the students in the payload; remove a stray result with the per-row `DELETE`. Different
  topics on the same day are separate keys and coexist.
- A **unique compound index** on exactly that key backs the upsert
  (`TestRecord.js:45-48`) so a double-click cannot race two inserts. `bulkWrite` runs
  `ordered: false`, and an all-`E11000` failure is swallowed as benign
  (`isAllDuplicateKeyError`, `instituteController.js:756-761`).
- **`bulkWrite` upserts do not run Mongoose validators** — not even with `runValidators`. The
  schema's `min: 0` on marks is therefore enforced by the JS guard `toNonNegativeNumber()`
  (`instituteController.js:746-754`): it trims whitespace (`'  '` → skipped, **not** 0) and drops
  negatives. `updateTest` uses `row.save()`, which *does* validate. **Keep the two paths in step.**
  Specs: `server/tests/institute/tests.test.js`.
- **The client never wipes typed input.** `RecordTestDialog` — not its own file; it is a component
  defined inside `client/src/components/institute/TestsTab.js:35` — keeps a `touchedRef`
  (`TestsTab.js:53`) set of student
  names the user has typed a mark for; the marks-rebuild effect (fired on subject/topic change)
  re-pulls pre-filled marks for *untouched* students but carries touched values over verbatim.
  Without this, filling in Subject *after* typing marks silently blanked them.

### 9.7 Report

`AttendanceReportTab.js` — per-student (or whole-grade) attendance over an optional date range,
with a summary and an Excel/CSV export, built for sending a student's record to their parents.
It reads `GET /api/institute/attendance` with `studentName` + `startDate`/`endDate`.

### 9.8 Canonical subjects

`server/config/instituteSubjects.js` is the **single source of truth**. Subjects used to be free
text sourced from `distinct('subject')` across attendance/timetable/test rows, which drifted into
`Math`/`Maths`, `Accountancy`/`Accounting`, `Business Studies`/`Business studies`, `biology`, plus
a retired subject and blank strings.

| Export | Purpose |
|---|---|
| `INSTITUTE_SUBJECTS` | The 11 canonical subjects: Accountancy, Biology, Business Studies, Chemistry, Economics, English, IELTS, Math, Mechanics, Physics, Science |
| `RETIRED_INSTITUTE_SUBJECTS` | `['CHRM']` — kept so pickers can actively filter it out while historical rows still reference it |
| `SUBJECT_ALIASES` | Genuinely different words only (`maths`→`Math`, `accounting`→`Accountancy`, `bio`→`Biology`, …). Case/spacing differences are handled generically |
| `canonicalizeSubject(v)` | `''` for blanks, `null` for unrecognised/retired |
| `subjectMatchCondition(v)` | A case-insensitive regex over every spelling that means `v`, so a filter still matches un-normalised rows |
| `subjectOptions()` | What the pickers show: canonical only, retired removed, sorted |

The meta endpoints serve `subjectOptions()`, never raw DB values
(`instituteController.js:430`, `:776`). Grades stay data-derived because they grow organically.
`server/scripts/normalizeInstituteSubjects.js` rewrites historical rows onto the canonical list.

**Adding a subject** = add it to `INSTITUTE_SUBJECTS` and redeploy. That is the whole change (see
commit `7b0cafa`, which added Mechanics).

---

## 10. Leadership / Executive Overview suite

**What it does.** Four LUC-only dashboards that replicate a set of Excel workbooks leadership was
maintaining by hand. Numbers come from **manually entered monthly rows**, not from the Commitment
or Student trackers.

**Who uses it.** `admin` and `team_lead`. Reads are open across teams for both; **writes are
admin-only.**

**The data model.** `TeamMonthlyEntry` — one document per `(consultant, year, month)`, unique
index on exactly that (`TeamMonthlyEntry.js:53-56`). Fields: `monthlyTarget`, `achievedRevenue`,
`notes`, plus **one numeric field per programme bucket** flattened onto the document
(`TeamMonthlyEntry.js:49`).

**Buckets** (`server/services/execOverview/bucketing.js:10-37`) — the column order matches the
source workbook:

- **14 counted buckets**: SSM MBA, SSM BBA, OTHM+MBA, IOSCM+MBA, KNIGHTS MBA, KNIGHTS BBA, MUST,
  OTHM-7, IOSCM-7, OTHM-3, DBA, OTHM Ext L5, OTHM-4,5, OTHM-6.
- **3 excluded buckets** — tracked in their own columns but **never added to Total Admissions**:
  KHDA, AGI, AGI Standalone. KHDA is manual-entry only; nothing auto-classifies into it.

Each display name maps to a stable slug (`BUCKET_SLUGS`, `bucketing.js:42-60`) because the names
contain spaces, `+` and commas that make poor object keys.

**Pages and endpoints.**

| Page | Route | Endpoint |
|---|---|---|
| Leadership Dashboard | `/leadership-dashboard` → `pages/ExecutiveOverviewPage.js` | `GET /api/exec-overview` |
| All Teams | `/team-dashboard[/:teamLeadId]` → `pages/TeamDetailPage.js` | `GET /api/exec-overview/team/:teamLeadId` |
| Consultant Performance | `/consultant-performance` → `pages/ConsultantPerformancePage.js` | `GET /api/exec-overview/consultant-performance` |
| Monthly Targets | `/monthly-targets` → `pages/MonthlyTargetsPage.js` | `/api/team-entries` |
| (team picker) | — | `GET /api/exec-overview/teams` |

Writes go through `/api/team-entries` (`server/routes/teamEntries.js`):
`GET /meta` and `GET /` are `admin, team_lead`; `POST /bulk`, `PUT /`, `DELETE /:id` are
**admin only**.

**Business rules.**

1. **The whole group is `orgGate('luc')`** (`routes/execOverview.js:14`,
   `routes/teamEntries.js:15`). A user whose `organization` is not exactly `'luc'` gets a 403 —
   *including an admin whose own `organization` field is not `'luc'`*, because `orgGate`
   compares `req.user.organization` with no role exemption (`server/middleware/orgGate.js:5`).
2. **"Current month" is data-derived, not calendar-derived.** `effectiveCurrentMonth`
   (`aggregate.js:94-105`) is the latest month with `achievedRevenue > 0`, falling back to the
   real calendar month. `orgWideEffectiveMonth` (`aggregate.js:109-124`) computes it once
   org-wide so every team shares the same YTD cutoff — otherwise a smaller team with fewer active
   months got its YTD truncated below the Excel's.
3. **Total Admissions excludes KHDA and AGI.** `rowTotalAdmissions`
   (`aggregate.js:47-51`) sums only `PROGRAM_SLUGS`, matching the Excel formula.
4. **"On Track" is ≥ 50 % of MTD target** (`ON_TRACK_THRESHOLD = 0.5`, `aggregate.js:33`). It was
   0.8, which left every team between 50 % and 79 % stuck on "Behind"; leadership asked for the
   halfway flip (commit `4edf561`).
5. **Consultant Performance splits on target size.** Category A = `monthlyTarget ≥ 100,000`,
   Category B = below (`CATEGORY_A_THRESHOLD`, `aggregate.js:499`). Raised from 90,000 in
   2026-07. The representative target is the max non-zero monthly target. Each category is ranked
   by YTD %, and the page also shows top-5 by MTD % and by YTD %.
6. **YTD extends to the current calendar month for the current year** even before revenue is
   logged, so entering this month's target does not leave YTD showing last month's total
   (`aggregate.js:517-528`).
7. **Writes are whitelisted.** `pickEditableFields` (`teamEntryController.js:44-55`) lets through
   only the editable numeric fields and `notes`; `organization`, `teamLead` etc. are set
   server-side. `assertWriteAccess` (`teamEntryController.js:31-40`) additionally restricts a
   non-admin to their own consultants — currently unreachable because the write routes are
   admin-only, but it is the guard that will matter when team-lead writes are unlocked.
8. **Editing admissions fires an announcement.** `upsertEntry` snapshots the prior bucket counts
   and calls `announceTeamAdmission` with only the buckets that *increased*
   (`teamEntryController.js:118+`, `services/announcer.js:26-47`), so a re-save or a target edit
   announces nothing.
9. **Team ordering is deliberate.** `getTeams` sorts `"Team …"`-prefixed names first so the
   default "All Teams" landing is always a real active team, never a departed lead
   (`execOverviewController.js:86-95`).

**Trap.** `client/src/App.js:180-191` still claims team leads see a "Coming Soon lock" on these
pages. That is **stale** — `ComingSoonLock` (`client/src/components/ComingSoonLock.js`) is
imported by nothing. Team leads currently get the real, read-only view; `TeamDetailPage.js:398`
sets `canEdit = user?.role === 'admin'` and `MonthlyTargetsPage.js:117,130` return early for
non-admins.

---

## 11. Tier Fight

**What it does.** A gamified month-end race. Consultants are grouped into three tiers; each tier's
live month-to-date achieved revenue is summed, and the admin can generate an AI poster of the
standings and broadcast it to everyone in the org.

**Who uses it.** Reads: `admin` + `team_lead`. Mutations (generate image, edit tier membership):
`admin` only. LUC-only (`orgGate('luc')`, `routes/tiers.js:18`).

**Front-end.** `/tiers` → `pages/TierPage.js` → `components/tiers/TierBoard.js`. The broadcast
modal is `components/tiers/TierAnnounceModal.js`, mounted app-wide in `App.js:298`.

**Back-end.** `server/routes/tiers.js`, `server/controllers/tierController.js` (370 lines),
models `Tier` and `TierImage`, `server/services/s3.js`, `server/services/announcer.js`.

| Verb | Path | Roles |
|---|---|---|
| GET | `/api/tiers` | admin, team_lead |
| GET | `/api/tiers/latest-image` | admin, team_lead |
| GET | `/api/tiers/images` | admin, team_lead |
| POST | `/api/tiers/generate-image` | admin (multipart, optional base image ≤ 12 MB) |
| PUT | `/api/tiers/:tier` | admin |

**Business rules.**

1. **Tiers are three documents**, unique on `(organization, tier)` with `tier ∈ 1..3`
   (`Tier.js:11,18`). Members are `Consultant` **refs**, not names — so a rename never breaks the
   calculation. Seeded once by `server/scripts/seedTiers.js`.
2. **MTD is computed live**, never stored: `buildTiers(year)`
   (`tierController.js:132-156`) resolves the current month, pulls every member's
   `TeamMonthlyEntry` for that month, and sums `achievedRevenue` per member and per tier.
   `buildTierTrend` (`tierController.js:159-174`) produces the Jan→current three-line chart.
3. **"Current month" mirrors the Leadership Dashboard**: the latest month with achieved revenue
   (`currentMonth`, `tierController.js:121-129`).
4. **The poster is generated by `gpt-image-2`** at `1536x1024`, quality `medium`, costed at a
   hard-coded **$0.041/image** (`IMAGE_COST_USD`, `tierController.js:48`) and logged to `AIUsage`.
   A theme is picked at **random** from 21 scenes (`THEMES`, `tierController.js:19-42`) unless the
   admin chooses one. If the admin uploads a base photo, `images.edit` reimagines the people in it
   as the scene's characters (`tierController.js:98-104`).
5. **The poster is not only for tiers.** `includeTiers=false` plus a custom `title` and `message`
   turns it into a general motivational/announcement poster
   (`tierController.js:64-89`, `:200-206`).
6. **Images are archived to S3** under `tier-images/YYYY/MM/DD/<ts>-<theme>.png`. The base64 data
   URL is stored inline in Mongo **only** as a fallback when S3 is unconfigured or the upload
   fails, to keep the database lean (`tierController.js:220-238`).
7. **Generating broadcasts an announcement** to the whole org via `announceTierImage`
   (`services/announcer.js:52-81`) — every LUC user gets the dismissable banner wherever they are
   in the app, not just on the Tier Fight tab.

---

## 12. Payment Plans

**What it does.** Tracks a LUC admission's payment plan through its approval chain.

**Who uses it.** `admin` (every team, grouped by team) and `team_lead` (own team). LUC-only
(`orgGate('luc')`, `routes/paymentPlans.js:17`).

**Front-end.** `/payment-plans` → `pages/PaymentPlanTrackerPage.js` (35 lines) →
`components/paymentPlans/PaymentPlanPanel.js`. Search + filters, 100 rows/page, xlsx/csv download.

**Back-end.** `server/routes/paymentPlans.js`, `server/controllers/paymentPlanController.js`
(128 lines), `server/models/PaymentPlan.js`.

| Verb | Path | Roles |
|---|---|---|
| GET / POST | `/api/payment-plans` | admin, team_lead |
| PUT / DELETE | `/api/payment-plans/:id` | admin, team_lead (own team) |

**Business rules.**

1. **Status enum, in workflow order** (`PaymentPlan.js:10-17`):
   `Pending from TL` → `Pending from SM` → `Pending from FD` → `Approved and Submitted`, plus the
   two off-ramps `Pending from Student` and `Drop Out`. Default is `Pending from TL`.
2. **One plan per admission.** `student` is `unique: true` (`PaymentPlan.js:36`); the controller
   pre-checks and returns a friendly **409** rather than letting the raw duplicate-key error
   surface (`paymentPlanController.js:49-57`).
3. **Student identity is snapshotted at link time** — `studentName`, `program`, `month`,
   `consultantName`, `teamLeadName`, `teamName` are copied onto the plan
   (`paymentPlanController.js:60-74`) so the row stays readable if the student is later edited or
   deleted.
4. Ownership comes from the linked student's `teamLead`, which is what makes
   `buildScopeFilter`/`canAccessDoc` work for team leads.
5. Update uses `plan.save()` deliberately (`paymentPlanController.js:100`) so the status enum
   validator actually runs.
6. Every mutation emits a Socket.IO event to the `luc` room
   (`paymentPlanController.js:76,102,123`).

---

## 13. Export Center

**What it does.** One page where a user previews and downloads tracker data — raw rows, pivots,
saved pivot configurations, and pre-built multi-sheet templates. It replaced four scattered
"Export" buttons that used to live inside the individual dataset pages.

**Who uses it.** All four roles, with a per-dataset matrix.

**Front-end.** `/exports` → `pages/ExportCenterPage.js` (421 lines) with
`components/exports/{DatasetSelector,ExportOrgTabs,PreviewTab,TemplatesTab,HeaderDownloadButtons}.js`.
Column configs live in `client/src/config/exportColumns/`. Workbook writing is
`client/src/services/xlsxBuilder.js`. The API client is `client/src/services/exportsApi.js`.

**Back-end.** `server/routes/exports.js`, `server/controllers/exportController.js` (349 lines),
`server/services/exports/pivots/{students,commitments,meetings,hourly}.js` + `_shared.js`,
`server/services/exports/templates.js`, `server/models/SavedExportTemplate.js`,
`server/middleware/exportRateLimit.js`.

| Verb | Path | Rate-limited |
|---|---|---|
| POST | `/api/exports/raw` | no |
| POST | `/api/exports/pivot` | **yes** |
| GET | `/api/exports/dimensions/:dataset` | no |
| GET | `/api/exports/templates` | no |
| POST | `/api/exports/template/:templateId` | **yes** |
| GET / POST | `/api/exports/saved-templates` | no |
| DELETE | `/api/exports/saved-templates/:id` | no |

**Datasets and the permission matrix** (`exportController.js:13-51`):

| Dataset | Allowed roles | Date field used by filters |
|---|---|---|
| `students` | admin, team_lead (LUC own team), manager, skillhub (own branch) | `closingDate` (LUC) / `createdAt` (Skillhub + All) |
| `commitments` | admin, team_lead, skillhub | `commitmentDate` |
| `meetings` | admin, team_lead | `meetingDate` |
| `hourly` | admin, team_lead, skillhub | `date` |

Plus four cross-cutting rules in the same function: `team_lead` is locked to `luc`; `manager` is
locked to `students` (this is the **manager Export Center exception** — the only place a manager
sees anything other than LUC); `skillhub` is locked to its own branch; and `organization: 'all'`
is admin/manager only.

**Builder contract.** Every dataset module exports the same surface: `runRawQuery`,
`runPivotQuery`, `dimensionCatalog(orgScope)`, `measureCatalog(orgScope)`,
`resolveOrgScope(user, bodyOrg)`, `distinctValues(...)`. Register it in
`exportController.getBuilder()` (`exportController.js:53-59`).

**Limits.** `/raw` is cursor-paginated; the server caps each page at 5,000 rows and the client's
`fetchAllRawRows` loops to a 100k hard cap. `PreviewTab` renders at most 10,000 rows and shows a
"download to see all" banner. Pivot and template runs are limited to **5 requests/minute/user**,
keyed on `req.user._id` with an IP fallback (`server/middleware/exportRateLimit.js`).

**Templates.** 26 pre-built templates in `server/services/exports/templates.js`, each gated by a
`roles` array — 8 LUC students, 7 Skillhub students, 4 commitments, 2 meetings, 2 hourly, 3
cross-org. A template returns a JSON envelope of N raw + pivot sheets, which the client serialises
to a multi-sheet xlsx via `xlsxBuilder.buildWorkbook`.

**Saved templates.** `SavedExportTemplate` — user-owned pivot configs, `(user, name)` unique
(409 on duplicate), 200-template cap per user (429 beyond it), owner-only delete.

**Business rules you must not break.**

1. **The LUC zero-fee hide applies here too**, including inside the `'all'` scope (LUC docs in the
   union are filtered; Skillhub docs are not).
2. **VAT disclaimer.** Any LUC sheet that surfaces `admissionFeePaid` — as a raw column or as a
   pivot measure — gets a row-1 note: *"Admission Fee Paid in LUC mixes net-of-VAT and
   gross-of-VAT entries (UAE VAT 5%). Treat sums as approximate."* Sheets without it, and all
   Skillhub sheets, get no disclaimer. Roughly 348 LUC rows split about 50/50 between net and
   gross as of the 2026-04-23 profile.
3. **Skillhub financials must go through `withSkillhubFinancials(pipeline)`** (`_shared.js`)
   before any `$group`, because the `outstandingAmount` virtual does not survive `.lean()` or
   aggregation.
4. **Hourly flat-vs-array normalisation** must go through `normalizeHourlyActivities(pipeline)`
   (`_shared.js`) — the aggregation twin of `getActivityItems`.
5. **Subjects pivot double-counting.** Skillhub `subjects` is an array, so `agg=count` after
   `$unwind` counts *subject-enrollments*, not students. The UI shows a disclaimer on
   count/sum aggregations; switching to `agg=distinct` runs `$addToSet: '$_id'` then `$size` for
   true student counts.
6. **`xlsxBuilder.pivotResultToSheet` is the single source of truth** for flattening a pivot
   envelope into `{ name, rows, columns }`. It is used by `PreviewTab` (grid render),
   `HeaderDownloadButtons` (download) and `TemplatesTab` (multi-sheet). Money columns auto-flag
   when `agg=sum` and the measure is one of `admissionFeePaid`, `courseFee`, `closedAmount`,
   `registrationFee`, `emiPaid`, `outstandingPerStudent`.

**Adding a dataset** (7 steps): build the builder module → register in `getBuilder()` → add to the
`assertDatasetAccess` matrix → add to `DatasetSelector.js`'s `ALL_DATASETS` + `ROLE_DATASETS` →
add a column config under `client/src/config/exportColumns/` → update
`PreviewTab.rawColumnsForDataset` → add a Jest spec under `server/tests/exports/` (target 6+
specs covering scope enforcement and pivot correctness).

**Pinned dependency.** `react-data-grid` is pinned at `7.0.0-beta.59` with **no caret**. Beta
releases iterate fast and have surprised this CRA setup before. Bump deliberately.

---

## 14. Chat copilot ("Ask me")

**What it does.** A floating chat drawer available on every authenticated page. It answers
questions about the *tracker data* by calling real MongoDB queries through OpenAI tool-calling,
and (for LUC users) routes document questions to the Docs RAG pipeline instead.

**Who uses it.** Every authenticated role. `server/routes/chat.js:17` applies `protect` and
deliberately **no role gate** — the product decision was that anyone who can log in can ask
anything the chat can reach; scoping happens inside the tools.

**Front-end.** `components/chat/FloatingChatLauncher.js` (mounted app-wide, `App.js:301`),
`components/chat/ChatPanel.js`, `components/chat/SuggestedChips.js`,
`client/src/utils/classifyQuery.js`.

**Back-end.** `server/routes/chat.js`, `server/controllers/chatController.js`,
`server/services/chatService.js` (644 lines), `server/services/chatTools.js` (1,276 lines),
`server/services/classifierService.js`, `server/models/ChatConversation.js`.

| Verb | Path | Purpose |
|---|---|---|
| POST | `/api/chat/stream` | SSE chat turn |
| POST | `/api/chat/transcribe` | Whisper voice input (multer memory, 25 MB cap) |
| GET | `/api/chat/conversations` | List (50 most recent) |
| GET / DELETE | `/api/chat/conversations/:id` | Read / delete one |
| POST | `/api/chat/classify` | LLM tie-breaker for the client router |

**The 13 tools** the model can call (`chatTools.js:1014-1237`): `search_people`,
`list_team_leads`, `get_team_roster`, `get_commitments`, `commitment_stats`, `leaderboard`,
`get_meetings`, `get_students`, `get_revenue`, `get_hourly_attendance`,
`get_absent_consultants`, `get_daily_admissions`, `today_snapshot`.

**Routing.** `ChatPanel` classifies every turn client-side before choosing an endpoint
(`ChatPanel.js:276`): LUC users go through `routeFor()` in `client/src/utils/classifyQuery.js`,
everyone else is hard-locked to `'tracker'`. The classifier normalises a curated misspelling map
first (`paas`→`pass`, `knihgts`→`knights`, `creidts`→`credits`, …), then treats a **programme-name
match as an immediate docs signal** (this was a production fix — "SSM MBA credits" was going to
the tracker because "how many" outweighed "SSM"), then falls back to fuzzy matching
(Levenshtein ≤ 1), and only if still ambiguous calls `POST /api/chat/classify`, which is LLM-based
with a 1-hour in-memory cache and never throws (worst case it returns `'tracker'`).

**Trap.** `get_revenue`'s `teamName` parameter is documented in the tool schema as *"REQUIRED
whenever the user names a team. OMIT for org-wide questions — do NOT pass 'all' or 'all teams'
here"* (`chatTools.js:1174`). That wording exists because the model kept passing `"all teams"` as a
literal team name and getting zero rows. If you edit these descriptions, re-test the org-wide
revenue question.

---

## 15. Docs RAG (program-docs chatbot)

**What it does.** Grounded answers from 16 LUC programme PDFs (8 programmes × overview + Q&A), so
a consultant can ask "does the Knights MBA need a dissertation?" and get a cited answer with a
link to the exact page.

**Who uses it.** LUC only — `orgGate('luc')` on the query endpoint (`routes/docsChat.js:320`) and
on all three static PDF mounts (`server/server.js:59-96`). `manager` and `skillhub` never see it.

**Endpoints** (`server/routes/docsChat.js`):

| Verb | Path | Gate |
|---|---|---|
| POST | `/api/docs-chat` | `protect` + `orgGate('luc')`, SSE stream |
| POST | `/api/docs-chat/feedback` | `protect` — thumbs up/down on an answer |
| POST | `/api/docs-chat/admin/reingest?force=true` | admin — spawns `scripts/ingestProgramDocs.js` |
| GET | `/api/docs-chat/stats` | admin — chunk counts, tier distribution, cache hit rate, top/refusal/low-confidence queries |
| GET | `/api/docs-chat/health` | **public, no auth** — Render readiness probe; 503 when `chunksLoaded === 0` |

Plus a kill switch: `DOCS_RAG_ENABLED=false` makes every route except `/health` and `/stats`
return 503 (`routes/docsChat.js:20-23`, `server/middleware/docsRagEnabled.js`).

**The eight programmes** (`server/models/DocChunk.js:4-13`): `ssm-dba`, `ioscm-l7`,
`knights-bsc`, `knights-mba`, `malaysia-mba`, `othm-l5`, `ssm-bba`, `ssm-mba`.

**How retrieval works** (`server/services/docsRagService.js`). Everything is in memory — about
215 chunks — loaded once at boot by `loadChunks()` (`server/server.js:135`). Three tiers:

| Tier | Method | Trigger |
|---|---|---|
| 1 | Exact match on Q&A **question** embeddings | cosine ≥ `exactMatchThreshold` (default **0.82**) |
| 2 | Hybrid dense + wink-BM25, fused with **RRF (k = 60)**, top-K (default 5) | otherwise |
| 3 | **Refuse** | max dense cosine in the top slice < `minScore` (default **0.35**) |

A tier-3 refusal returns a fixed sentence and is logged. Those rows surface in the admin
dashboard's "Refusals (last 24h)" table as corpus-gap signals.

**Generation.** Groq `llama-3.3-70b-versatile` primary, OpenAI `gpt-4o-mini` fallback, both
sharing one keep-alive HTTPS agent (`docsRagService.js:27`). Every knob is env-overridable via
`server/config/docsRagConfig.js` — but it is parsed at require-time, so **env changes need a
process restart**.

**Models.** `DocChunk` (both a content `embedding` and a `questionEmbedding`; always
`organization: 'luc'`), `QueryCache` (24 h TTL, keyed `sha1(normalize(query) + '|' + programFilter)`),
`DocsChatLog` (one row per request, cache hits included; no TTL; carries a `feedback` subdoc).

**Lead context.** The request body may carry `studentId` / `leadId` / `programHint`.
`resolveLeadContext` (`routes/docsChat.js:27-54`) looks the student up, checks the caller owns it
(or is admin), and maps its `program` free text to a programme slug so retrieval can be filtered
to that programme.

**PDF delivery.** Three auth-gated static mounts, all behind
`docsRagEnabled → protect → orgGate('luc')` and all placed **before** the SPA catch-all so they
never fall through to `index.html`:

| Mount | Content |
|---|---|
| `/program-docs/*` | The full PDFs |
| `/program-docs-highlighted/*` | Single-page, pre-highlighted PDFs for the in-drawer preview |
| `/program-docs-snippets/*` | PNG crops (~40–80 KB at 150 DPI) for the split-pane preview |

Files live under `client/public/program-docs*/`. The client fetches them as an authenticated blob
and renders them at `/pdf-viewer` (`client/src/pages/PdfViewer.js`) — a plain `<a href>` would not
carry the JWT.

**Adding a programme.** Drop two PDFs in `client/public/program-docs/<new-slug>/` → extend
`PROGRAMS` in `server/models/DocChunk.js` → extend `DOC_TYPE_MAP` in
`server/scripts/ingestProgramDocs.js` → run `npm run ingest:docs:force` (defined in the **root**
`package.json`, not `server/`) → deploy → have an admin click "Force re-ingest". The full spec is
`DOCS_RAG_FEATURE_SPEC.md` — **19 numbered sections plus "Appendix A — Reference: content
inventory per program"** (the root `CLAUDE.md` says 16; it is out of date).

---

## 16. AI Analysis & usage accounting

**What it does.** On-demand OpenAI narrative analysis of a date range, plus an admin cost
dashboard.

**Endpoints** (`server/routes/ai.js`):

| Verb | Path | Roles |
|---|---|---|
| POST | `/api/ai/analysis` | admin, team_lead, skillhub |
| POST | `/api/ai/student-analysis` | admin, team_lead, skillhub |
| GET | `/api/ai/analysis-targets` | admin |
| POST | `/api/ai/team-analysis` | admin |
| POST | `/api/ai/consultant-analysis` | admin |
| GET | `/api/ai/usage` | admin |

**Business rules.**

1. **Scope depends on role *and* org.** Admin gets the org-wide aggregation. A **LUC team lead
   also gets the org-wide LUC aggregation** — deliberately, so they can benchmark their team
   against the rest of LUC (`aiController.js:42-53`). A `skillhub` login (and any non-LUC team
   lead) gets the ownership-scoped `aggregateTeamLeadData` instead.
2. **Every call writes an `AIUsage` row** — user, role, type, team, organisation, model, prompt/
   completion/total tokens, cost, and the date range queried (`aiController.js:74-87`). Logging is
   fire-and-forget so it never blocks the response.
3. **Error mapping**: a missing `OPENAI_API_KEY` becomes a 503 with a human message; an upstream
   429 becomes a 502 (`aiController.js:92-105`).
4. `AIUsage` rows come from **six** places, not one — `grep -rl "AIUsage.create" server/` returns
   `controllers/aiController.js`, `controllers/commitmentController.js`,
   `controllers/meetingController.js`, `controllers/hourlyController.js` (leaderboards + day
   analysis), `controllers/tierController.js` (image generation) and
   `services/chatService.js` (the "Ask me" copilot). The admin dashboard buckets them by `type`
   — the model's enum is exactly `['analysis', 'chat', 'image']` (`AIUsage.js:23`) — and reports
   per-day, per-user and per-team totals (`getUsageStats`, `aiController.js:313`+).

Other AI entry points that bill the same key: `GET /api/commitments/ai-analysis`,
`GET /api/meetings/ai-analysis`, `GET /api/hourly/ai-analysis`,
`GET /api/hourly/leaderboard[/weekly]`, `POST /api/tiers/generate-image`,
`POST /api/chat/stream`, `POST /api/chat/transcribe`, `POST /api/docs-chat`.

---

## 17. Announcements

**What it does.** An org-wide broadcast banner. Unlike a notification (one row per user, passive,
only seen if you open the bell), an announcement is a **single document that everyone in the org
sees as a prominent banner until they personally dismiss it**.

**Front-end.** `components/AnnouncementBanner.js`, mounted app-wide (`App.js:296`).

**Back-end.** `server/routes/announcements.js`, `server/controllers/announcementController.js`
(39 lines), `server/models/Announcement.js`, `server/services/announcer.js`.

| Verb | Path | Gate |
|---|---|---|
| GET | `/api/announcements/active` | `protect` |
| POST | `/api/announcements/:id/ack` | `protect` |

**Business rules.**

1. **Visibility is guaranteed by persistence, not by the socket.** `getActive` returns every
   non-expired announcement for the caller's org that the caller has not acknowledged
   (`announcementController.js:10-19`), on every page load. Someone who was offline when it fired
   still sees it next time they open the tracker.
2. **Acknowledgement is per user and idempotent** — `acknowledgedBy[]` holds `{user, at}` and the
   update is guarded by `'acknowledgedBy.user': { $ne: req.user.id }`
   (`announcementController.js:31-34`).
3. **Announcements auto-expire after 7 days** (`ANNOUNCEMENT_TTL_MS`, `announcer.js:5`).
4. **There is no create endpoint.** Announcements are only produced by the two system helpers in
   `services/announcer.js`: `announceTeamAdmission` (fired from `teamEntryController.upsertEntry`
   when a programme bucket count *increases*) and `announceTierImage` (fired from
   `tierController.generateImage`). The schema has a `type: 'manual'` value
   (`Announcement.js:20`) but nothing writes it. Both helpers are hard-gated to LUC
   (`announcer.js:27`, `:53`).
5. Creation also emits a Socket.IO `announcement` event to `org:<organization>` for a live toast.
6. `toPayload()` (`announcer.js:9-19`) strips `acknowledgedBy` before anything goes over the wire.

---

## 18. Notifications

**What it does.** A per-user bell.

**Front-end.** `components/NotificationBell.js`, `client/src/services/notificationService.js`.

**Back-end.** `server/routes/notifications.js`, `server/controllers/notificationController.js`
(179 lines), `server/models/Notification.js`.

| Verb | Path |
|---|---|
| GET | `/api/notifications` — own, newest first, capped at 50 |
| PATCH | `/api/notifications/read-all` |
| PATCH | `/api/notifications/:id/read` |
| DELETE | `/api/notifications/:id` |
| POST | `/api/notifications/generate-reminders` — admin, team_lead |

**Types** (`Notification.js:12-18`): `follow_up_reminder`, `weekly_summary`, `commitment_due`,
`team_update`, `student_birthday`. Priority: `low` / `medium` / `high`.

**Business rules.**

- **Delete is a hard delete** (`notificationController.js:170`); there is no soft-delete flag on
  this model.
- Read and delete both verify `notification.user === req.user.id` and 403 otherwise
  (`notificationController.js:37`, `:163`).
- `generateFollowUpReminders` scans open commitments whose `followUpDate` is today or overdue and
  creates one `follow_up_reminder` per team lead per commitment per day — the dedupe is a
  `findOne` on `(user, relatedCommitment, type, createdAt ≥ today)`
  (`notificationController.js:118-124`). **It is only ever triggered manually** — nothing
  schedules it.
- Three producers write notifications outside this controller: the drift monitor
  (`type: 'team_update'`), the birthday job (`type: 'student_birthday'`), and
  `exports.createNotification` used as an internal helper.

**Note.** The older CLAUDE.md mentions a controller/model mismatch (the controller once used
`recipient`/`isActive`, which do not exist on the schema). That is **fixed** — the current
controller uses `user` and `isRead` throughout.

---

## 19. Reconciliation

**What it does.** Keeps the Commitment Tracker and the Student Database in lockstep. Every LUC
admission should exist in both, joined by `Commitment.studentId` ↔ `Student.commitmentId`. This
page surfaces the rows where that link is missing and lets an admin pair them.

**Who uses it.** `admin` only (`routes/reconciliation.js:14`). LUC only — every query hard-codes
`organization: 'luc'`, because the drift problem does not exist on Skillhub (there is no
Commitment lifecycle there).

**Front-end.** `/admin/reconciliation` → `pages/AdminReconciliationPage.js` (427 lines).

**Back-end.** `server/controllers/reconciliationController.js` (176 lines).

| Verb | Path | Returns |
|---|---|---|
| GET | `/api/reconciliation/counts` | The three tab counters |
| GET | `/api/reconciliation/orphan-commitments` | Closed commitments with no linked student |
| GET | `/api/reconciliation/orphan-students` | LUC students with no linked commitment, excluding manual-entry rows |
| GET | `/api/reconciliation/manual-students` | Students an admin explicitly flagged `manualEntry` |
| POST | `/api/reconciliation/pair` | `{ studentId, commitmentId }` → writes both FKs |

**Business rules.**

1. **Everything is scoped to `commitmentDate`/`closingDate` ≥ 2026-01-01** (`SCOPE_FROM`,
   `reconciliationController.js:9`). Older rows predate the FK spine and are intentionally out of
   scope.
2. `orphan-students` excludes `manualEntry: true` rows — those are *intentionally* unlinked and
   get their own bucket.
3. The LUC zero-fee hide applies to all three student queries.
4. **Pairing validates then writes both sides atomically-ish** (`pair`,
   `reconciliationController.js:119-175`): both must be LUC, both must currently be unlinked
   (409 otherwise). It sets `Student.commitmentId`, clears `manualEntry`/`manualEntryReason`, sets
   `Commitment.studentId`, and — if the commitment wasn't closed — closes it with the same
   four-field pattern used everywhere else. The two `updateOne`s run inside `Promise.all` with
   **no transaction**.
5. Result limits are clamped to 1–500, default 200.

---

## 20. Users & Consultants administration

**Users** (`server/routes/users.js`, `server/controllers/userController.js`):

| Verb | Path | Roles |
|---|---|---|
| GET | `/api/users` | admin, team_lead, skillhub |
| GET | `/api/users/team/:teamLeadId` | admin, team_lead, skillhub |
| GET / PUT | `/api/users/:id` | any authenticated (self/admin checks inside) |
| DELETE | `/api/users/:id` | admin — **soft** delete |
| DELETE | `/api/users/:id/permanent` | admin — hard delete, refuses admin accounts |

- A team lead can only update their own profile (`userController.js:106-111`).
- Only admins may change `role`, `teamLead`, `teamName`, `isActive`
  (`userController.js:120-125`). Everyone else can change `name` and `phone`.
- **`GET /api/users/team/:teamLeadId` always returns an empty list.** It queries
  `User.find({ teamLead, role: 'consultant' })` (`userController.js:216-219`), and `consultant`
  is not in the `User.role` enum (`User.js:32`). Consultants live in the `Consultant`
  collection. Use `GET /api/consultants` instead. *(Code-verified.)*

**Consultants** (`server/routes/consultants.js`, `server/controllers/consultantController.js`):

| Verb | Path | Roles |
|---|---|---|
| GET | `/api/consultants` | admin, team_lead, manager, skillhub |
| POST | `/api/consultants` | admin, team_lead, skillhub |
| PUT / DELETE | `/api/consultants/:id` | admin, team_lead, skillhub (own) |
| DELETE | `/api/consultants/:id/permanent` | admin |

- `DELETE /:id` is a **soft** delete (`isActive = false`,
  `consultantController.js:186-187`); `DELETE /:id/permanent` is a hard delete with **no
  reference check** — historical rows survive only because `consultantName`, `teamLeadName` and
  `teamName` are denormalised onto commitments, students and meetings.
- `team_lead` and `skillhub` never see deactivated consultants; the filter is forced
  (`consultantController.js:18-21`).
- `?scope=all` lets an admin or team lead list every consultant in their org so the read-only
  cross-team Executive Overview works (`consultantController.js:13-17`).
- Non-admin creates take `teamLead`, `teamName` and `organization` from the token, never the body
  (`consultantController.js:56-61`).
- Every mutation emits a Socket.IO consultant event.

---

## 21. Background jobs

All are registered in `server/server.js`. The **three scheduled** jobs are skipped under test —
they sit inside two `if (process.env.NODE_ENV !== 'test')` blocks (`server.js:149` for the drift
monitor, `server.js:157` for the two cron jobs). The **Docs RAG index load is not** — it runs
unconditionally at `server.js:134-136`, outside any `NODE_ENV` guard. There is no external
scheduler — these run inside the single Render web process, so they stop when it sleeps or
restarts.

| Job | Schedule | Source | What it does |
|---|---|---|---|
| Docs RAG index load | once, at boot (**not** test-guarded) | `server/server.js:134-136` | Loads ~215 chunks into memory. Failure does **not** block boot; `/api/docs-chat` returns 503 until an admin re-ingests |
| Drift monitor | 30 s after boot, then every 24 h | `server/services/driftMonitor.js:59` | Counts LUC closed commitments **older than 7 days** with no linked student; if any, drops a `team_update` notification on every active admin. Idempotent per admin per 24 h. Priority becomes `high` at ≥ 10 orphans |
| Nightly DB snapshot | cron `30 0 * * *`, **Asia/Dubai** | `server/server.js:157-170`, `services/dbSnapshot.js` | Dumps every collection as gzipped JSON to S3 under `db-snapshots/YYYY-MM-DD/`. **Silently disabled when S3 is unconfigured** — it logs a warning and moves on |
| Birthday reminders | cron `0 8 * * *`, **Asia/Dubai** | `server/server.js:172-186`, `services/birthdayNotifier.js` | See below |

### The birthday reminder job

`server/services/birthdayNotifier.js`. Counselors were entering each Institute student's date of
birth but had no way to be reminded of it, so birthdays were being missed.

- Runs at **08:00 Asia/Dubai** so the branch sees it at the start of the working day.
- Posts **two** batches: a heads-up the **day before** (priority `low`) and one on the **morning
  itself** (priority `high`) — `runBirthdayNotifications`, `birthdayNotifier.js:143-160`.
- Matching is on **month + day only**, evaluated against the **Asia/Dubai** calendar date via
  `Intl.DateTimeFormat` `formatToParts` (`localDateParts`, `birthdayNotifier.js:21-27`) — comparing
  a UTC-midnight `Date` against local time gives an off-by-one.
- Scoped to `skillhub_institute`. Recipients are the branch's own logins **plus every admin**
  (`recipients`, `birthdayNotifier.js:122-127`).
- **Idempotent**: before inserting it loads every `student_birthday` notification created since
  local midnight and skips any `user|title` pair it has already posted
  (`birthdayNotifier.js:167-188`). A retry or a double-scheduled run posts nothing extra.
- **Implausible ages are hidden, not shown wrong.** A handful of records were entered with the
  current year as the birth year (a Grade 11 student "born" in 2025), which would render as
  "turns 0". `MIN_PLAUSIBLE_STUDENT_AGE = 3` (`birthdayNotifier.js:101`) — below that the age is
  simply omitted and the birthday still shows.
- `upcomingBirthdays({ days })` (`birthdayNotifier.js:61-94`) backs the visible **"Upcoming
  birthdays"** panel (`GET /api/institute/birthdays`, `components/institute/BirthdaysCard.js`) —
  one query plus JS rather than a query per day. A 29 February birthday lands on 1 March in a
  non-leap year, which is how `Date.UTC` rolls it.

---

## 22. Core business rules

These cut across features. Get them wrong and the numbers stop matching the business's own
spreadsheets.

### 22.1 Weeks are Monday–Sunday

All week maths lives in `client/src/utils/weekUtils.js` and uses `date-fns` with
`{ weekStartsOn: 1 }`. `getWeekStartDate` → Monday, `getWeekEndDate` → Sunday.

`Commitment` stores four week fields (`weekNumber`, `year`, `weekStartDate`, `weekEndDate`) plus
the separate `commitmentDate`. `weekNumber` is validated 1–53.

**Precision note.** The code uses `getWeek(date, { weekStartsOn: 1 })`
(`weekUtils.js:7`), **not** `getISOWeek`. Without also passing `firstWeekContainsDate: 4`,
`date-fns` defaults to `1`, so the week numbering is Monday-start but **not strictly ISO-8601**.
The two disagree on the first and last days of some years. Nothing in the app currently depends on
exact ISO week numbers — they are a display and grouping key — but if you ever reconcile week
numbers against an external ISO source, this is why they differ. *(Behaviour verified from the
call sites; no ISO cross-check was run against production data.)*

### 22.2 Admission closure is irreversible

Once `Commitment.admissionClosed === true`:

- Sending `admissionClosed: false` → **400** "Cannot reopen a closed admission - this action is
  irreversible" (`commitmentController.js:294-300`).
- Sending any `status` other than `'achieved'` → **400** "This admission is closed - its status
  stays Achieved" (`commitmentController.js:307-316`).

Closure sets four fields together — `admissionClosedDate`, `status: 'achieved'`,
`achievementPercentage: 100`, and via the dedicated endpoint `leadStage: 'Admission'`. It can be
triggered four ways: explicitly (`admissionClosed: true`), by auto-close on
`Admission` + `achieved`, by creating a linked `Student`, or by pairing on the reconciliation page.
There is **no admin override** — the only way to undo it is a direct database edit.
Spec: `server/tests/commitments/admissionLock.test.js`.

### 22.3 Soft delete vs permanent delete

| Entity | `DELETE /:id` | `DELETE /:id/permanent` |
|---|---|---|
| `User` | soft (`isActive: false`) — admin | hard — admin, **refuses admin accounts** |
| `Consultant` | soft (`isActive: false`) — admin, team_lead, skillhub | hard — admin |
| `Teacher` | soft (`isActive: false`) — admin, skillhub Institute | none |
| `Student` | **hard** — admin, team_lead, skillhub | — |
| `Commitment` | **hard** — admin only | — |
| `Meeting` | **hard** — admin only | — |
| `PaymentPlan` | **hard** — admin, team_lead | — |
| `Notification` | **hard** — owner | — |
| `TestRecord`, `Attendance`, `TimetableEntry`, `InstituteEnrollment` | **hard** | — |

A soft-deleted `User` is locked out immediately because `protect` checks `isActive`
(`server/middleware/auth.js:36`). A soft-deleted `Consultant` disappears from team-lead and
Skillhub views but stays visible to admin.

**Why permanent delete is survivable:** historical rows denormalise `consultantName`,
`teamLeadName` and `teamName` as plain strings, so deleting the referenced entity leaves the
history readable. That denormalisation is a deliberate, repeated pattern — preserve it.

### 22.4 `sno` auto-increment

`Student.getNextSno(teamLeadId, organization)` (`Student.js:339-346`):

- **LUC** → scoped **per team** (`{ teamLead: teamLeadId }`).
- **Skillhub** → scoped **per organisation** (`{ organization }`).

It is `findOne().sort({ sno: -1 })` then `+1`. Read-then-write, no lock, no unique index — two
concurrent creates on the same scope produce a duplicate serial rather than an error. Given the
usage pattern (a handful of admissions a day, entered by hand) this has not been a problem, but
it is a real race.

### 22.5 The lead-stage funnel

Canonical order (`server/models/Commitment.js:7-20`, exported as `Commitment.LEAD_STAGES`;
mirrored with colours in `client/src/utils/constants.js:2-15`):

> Dead → Cold → Warm → Hot → Offer Sent → Awaiting Confirmation → Meeting Scheduled → Admission →
> CIF → Unresponsive → No Answer → Lost

Twelve values. `No Answer` and `Lost` were added for the Meeting Tracker and flow into both
schemas because `Meeting.js:3` imports the enum from `Commitment.js`. `server/tests/exports/commitments.test.js`
asserts `enumValues.length === 12` so a regression that re-introduces the old duplicate
`leadStage` definition fails loudly.

**The client hides one and trims for one org** (`client/src/utils/commitmentDesign.js`):

| Context | Choices offered |
|---|---|
| LUC + Skillhub Training | `ALL_LEAD_STAGES` — the 12 minus `Meeting Scheduled` (`commitmentDesign.js:7-9`) |
| **Skillhub Institute** | A trimmed **6-stage** subset: `Offer Sent`, `Awaiting Confirmation`, `Admission`, `CIF`, `Unresponsive`, `Dead` (`INSTITUTE_LEAD_STAGES`, `commitmentDesign.js:16-23`) |

This is a **UI-only** restriction — every value stays valid in the data model. `leadStagesFor(isInstitute, current)`
(`commitmentDesign.js:28-32`) keeps a row's existing stage in the list even if it is now hidden, so
editing an old record cannot silently blank it. The default stage for a new row is `'Cold'`
everywhere except the Institute, where it is `'Offer Sent'`
(`defaultLeadStage`, `commitmentDesign.js:37`) — defaulting to a value the picker cannot show
would seed an unsaveable form.

Board views pin `Admission` and `Awaiting Confirmation` first (`BOARD_STAGE_ORDER`,
`commitmentDesign.js:41-45`).

### 22.6 Canonical Institute subject list

See [§9.8](#98-canonical-subjects). Eleven canonical subjects, one retired (`CHRM`), an alias map
for genuinely different words, and `subjectMatchCondition()` so filters keep matching
un-normalised history. Meta endpoints serve the canonical list, never `distinct('subject')`.

### 22.7 Money and VAT

All amounts are **AED**. UAE VAT is 5 %. LUC's `admissionFeePaid` column mixes net-of-VAT and
gross-of-VAT entries across roughly 348 rows (about 50/50 as of the 2026-04-23 profile). **There is
no backfill and there will not be one** — the mitigation is the disclaimer the Export Center puts
on any LUC sheet exposing that column, plus hint chips on the entry form. Treat sums of
`admissionFeePaid` as approximate.

---

## 23. Cross-cutting mechanics you must understand

### 23.1 The dispatcher pattern

Three routes serve two completely different pages depending on the caller's organisation:

| Route | Dispatcher | LUC page | Skillhub page |
|---|---|---|---|
| `/student-database` | `pages/StudentDatabasePage.js` (23 lines) | `LucStudentDatabasePage.js` | `SkillhubStudentDatabasePage.js` |
| `/meetings` | default export in `pages/MeetingTrackerPage.js:553` | `LucMeetingTrackerPage` (same file) | `SkillhubMeetingTrackerPage.js` |
| `/hourly-tracker` | default export in `pages/HourlyTrackerPage.js:124` | same file | `SkillhubHourlyTrackerPage.js` |

The resolution is always the same two lines: admin uses the org they picked in `AdminOrgTabs`
(persisted through `client/src/utils/adminOrgScope.js`), everyone else uses their own
`user.organization`; `isSkillhubOrg(viewOrg)` then chooses. `/commitments` uses the *same*
resolution but keeps one page and swaps the form dialog instead
(`CommitmentsPage.js:62-70`).

**Add org-specific behaviour at the dispatcher**, not by threading org checks through the LUC page.

### 23.2 Admin org scope

Admin has no organisation of their own in practice (their `User.organization` is `'luc'`), so the
UI carries the scope: `useAdminOrgScope()` (`client/src/utils/adminOrgScope.js`) holds the
current tab, and API calls pass `?organization=...`. Server-side, `buildScopeFilter` honours
`req.query.organization` **only for admin** (`server/middleware/auth.js:73-76`); every other role
is pinned to its own org and ignores the parameter entirely.

`resolveOrganization(req)` (`server/middleware/auth.js:105-110`) is the write-side counterpart:
non-admin creates take the org from the token; admin creates take `body.organization` or fall back
to `'luc'`.

### 23.3 `orgGate` has no admin exemption

`server/middleware/orgGate.js:5` is a straight equality check on `req.user.organization`. Five
route groups use it (`exec-overview`, `team-entries`, `tiers`, `payment-plans`, `docs-chat` +
the PDF mounts). It currently works for admin because the admin account's `organization` is
`'luc'`. **If you ever change an admin's organisation, five features go dark at once.**

### 23.4 Real-time (Socket.IO)

`server/services/realtime.js`. Attached to the same HTTP server (`server.js:127`). Authentication
is by JWT; on connect a socket joins `org:<organization>`, plus `org:<org>:admin` for admins and
`org:<org>:team:<id>` for team leads (`realtime.js:54-60`). Emitters: `emitToOrg`,
`emitTeamEntry`, `emitConsultant`, `emitUser`. It is a no-op in tests and degrades silently if
`socket.io` is unavailable — **nothing in the app depends on a socket message arriving**; every
live update also has a REST fallback.

### 23.5 Response envelope and errors

Success is `{ success: true, data | count | ... }`. Errors are `{ success: false, message }`,
produced either inline or by `server/middleware/errorHandler.js`, which maps Mongoose `CastError`
→ 404, duplicate key → 400, and `ValidationError` → 400. Controllers use raw `try/catch` with
`next(error)` — there is no `asyncHandler` wrapper anywhere.

`express-validator` is in `server/package.json` but **imported nowhere**. All validation is manual.

### 23.6 Tests

`cd server && npm test` runs Jest filtered to four directories:
`tests/(exports|meetings|institute|commitments)` (`server/package.json:9`). There are **six test
directories holding 18 `.test.js` files** — `tests/execOverview` (3 files) and `tests/hourly`
(1 file) are **not** run by that script even though `testMatch`
(`<rootDir>/tests/**/*.test.js`) would find them, so `npm test` executes 14 of the 18. Run
everything with `npx jest` from `server/`.

| Directory | Files | Covers |
|---|---|---|
| `tests/exports` | 6 | scope enforcement + pivot correctness; the 66-row fixture `students_2026-04-22.json` codifies four reference-workbook pivots |
| `tests/meetings` | 1 | The conditional-`required` update trap |
| `tests/institute` | 4 | Attendance, birthdays, schedule import, tests upsert |
| `tests/commitments` | 3 | Admission lock, `gradeOrYear`, `normalizeDemos` |
| `tests/execOverview` | 3 | Bucketing, aggregation, team-entry writes — **not in `npm test`** |
| `tests/hourly` | 1 | Self-consultant guard — **not in `npm test`** |

Client: `cd client && npm test` — six RTL/jsdom specs: four under
`client/src/components/exports/__tests__/`, one at
`client/src/services/__tests__/xlsxBuilder.test.js`, and one at
`client/src/utils/__tests__/timetableStudents.test.js` (this last one is easy to miss — it is the
only client spec outside the Export Center work).

---

## 24. Where the old docs are wrong

`docs/engineering/` and `docs/user-guides/` were last reviewed **2026-04-26**. Everything below
was verified against the code at handover time.

| Old doc | Claim | Reality |
|---|---|---|
| `user-guides/05-role-permissions-matrix.md` | `/meetings` is admin + team_lead only | `skillhub` was added (`server/routes/meetings.js:23-24`, `client/src/App.js:114`) |
| `user-guides/05-role-permissions-matrix.md` | Page list ends at `/pdf-viewer` | Missing entirely: `/institute`, `/tiers`, `/payment-plans`, `/leadership-dashboard`, `/team-dashboard`, `/consultant-performance`, `/monthly-targets`, `/admin/reconciliation` |
| `engineering/02-api-reference.md` | `POST /api/users` creates a user | No such route. Creation is `POST /api/auth/register` |
| `engineering/02-api-reference.md` | `GET /api/users/team/:teamLeadId` "lists a team lead's roster" | It queries `User` with `role: 'consultant'`, which is not in the enum — it always returns `[]` |
| `engineering/02-api-reference.md` | Only `/exports/pivot` and `/exports/template/:id` are rate-limited | `POST /api/institute/timetable/import` is also limited, 10/min/user (`routes/institute.js:29-36`) |
| `engineering/02-api-reference.md` | Route list as of 2026-04-26 | Missing the whole `/api/institute` group (15 route paths / 24 verb+path endpoints) and the whole `/api/tiers` group — the string "tiers" appears zero times in that file |
| `CLAUDE.md` (repo root) | `constants.js STATUS_LIST` contains `not_achieved` | Fixed — it is `['pending','in_progress','achieved','missed']` (`constants.js:170`) |
| `CLAUDE.md` | Commitment has a duplicate `leadStage` definition | Fixed — one definition, 12 values, locked by a test |
| `CLAUDE.md` | Notification controller uses `recipient`/`isActive` | Fixed — uses `user`/`isRead` |
| `App.js:180-191` comment | Team leads get a "Coming Soon lock" on Leadership pages | Stale — `ComingSoonLock` is imported nowhere; team leads get the read-only view |

Still accurate and still worth reading: the older docs' notes on CORS being wide open, `/login`
having no rate limit, logout being stateless, and CSP being disabled in Helmet
(`server/server.js:23`).

---

## 25. Related documents

| Document | Why you would open it |
|---|---|
| [00 — START HERE](00-START-HERE.md) | The map of this pack, and the five traps that have each caused a production issue |
| [01 — System Architecture](01-system-architecture.md) | The mental model: request lifecycle, multi-tenancy, module layout |
| [03 — Database Schema](03-database-schema.md) | All 27 collections, every field, every index, and the conditional-`required` trap in full |
| [04 — Deployment & Infrastructure](04-deployment-and-infrastructure.md) | Render, Atlas, S3, DNS |
| [05 — Environment Setup](05-environment-setup.md) | Running it locally; ports 3001/5001; why `npm run seed` is dangerous |
| [06 — API Reference](06-api-reference.md) | Endpoint-by-endpoint request/response shapes |
| [07 — Roles & Permissions](07-roles-and-permissions.md) | `buildScopeFilter`, `canAccessDoc`, `orgGate`, `assertDatasetAccess`, `assertInstitute` |
| [08 — Dependencies & Integrations](08-dependencies-and-integrations.md) | OpenAI, Groq, AWS S3, MongoDB Atlas, npm surface |
| [09 — Operations, Backup & Recovery](09-operations-backup-recovery.md) | The nightly S3 snapshot, restore drill, drift monitor |
| [10 — Known Issues & Roadmap](10-known-issues-and-roadmap.md) | The broken close-admission route, the `sno` race, untested suites, pending work |
| [11 — Credentials & Access Handover](11-credentials-and-access-handover.md) | The secret inventory and the rotation runbook — **start this on day 1** |

Repo-level references that are still authoritative and worth keeping:
`DOCS_RAG_FEATURE_SPEC.md` (19 sections + an appendix on the RAG pipeline), `DEPLOYMENT.md`,
and the root `CLAUDE.md` (accurate except for the four rows in [§24](#24-where-the-old-docs-are-wrong)).
