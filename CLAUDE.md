# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Team Progress Tracker — a MERN stack app for tracking team commitments, consultant performance, and student admissions for an education consultancy. Two user roles: **admin** (full access) and **team_lead** (scoped to own team).

## Development Commands

```bash
# Install all dependencies (root + server + client)
npm run install:all

# Run both servers concurrently (backend :5001, frontend :3001)
npm run dev

# Run backend only
npm run dev:server

# Run frontend only
npm run dev:client

# Build frontend for production
npm run build

# Seed database (creates admin + 9 team leads, writes credentials to LOGIN_CREDENTIALS.md)
npm run seed
# Runs: cd server && node scripts/seedDatabase.js

# Run frontend tests (Jest + React Testing Library)
cd client && npm test
```

**No backend tests exist** — `npm test` in `server/` is a no-op.

Legacy seed scripts exist in `server/utils/` (`seedUsers.js`, `seed2025.js`, `seedTeamBased2025.js`) but are not used by `npm run seed`.

## Architecture

### Backend (server/)
- **Express v5** + **Mongoose v9** with CommonJS modules, MongoDB Atlas
- Entry point: `server/server.js` (port 5001)
- Auth: JWT tokens via `Authorization: Bearer <token>` header
- Middleware: `auth.js` exports `protect` (JWT verification, checks `isActive`) and `authorize(...roles)` (role check)
- Routes all prefixed `/api`: auth, users, consultants, commitments, students, notifications
- Health check: `GET /api/health` (defined inline in `server.js`)
- Error handler middleware (`middleware/errorHandler.js`): catches Mongoose CastError (→404), duplicate key (→400), ValidationError (→400). All error responses: `{ success: false, message }`
- Controllers use raw `try/catch` with `next(error)` — no `asyncHandler` wrapper
- Role-based data scoping is done inline per controller (team leads filter by `teamLead: req.user.id`, admins see all)
- In production, Express serves the React build as static files with SPA fallback via regex `(/^(?!\/api).*/)`

### Frontend (client/)
- **React 19** + **MUI v7** + React Router v7 (port 3001)
- State: React Context for auth (`AuthContext`), local `useState` for everything else — no Redux
- API calls: service modules in `client/src/services/` using Axios with interceptors for auth tokens
- Route guard: `PrivateRoute` component checks auth + role
- Routes: `/login`, `/admin/dashboard`, `/team-lead/dashboard`, `/student-database`
- Charts: Recharts (`recharts`). Heatmap: `react-calendar-heatmap`
- Client-side Excel/CSV export via `xlsx` + `file-saver` in `exportService.js`
- Central constants in `client/src/utils/constants.js`: lead stages, statuses, roles, colors, `API_BASE_URL`
- Week utilities in `client/src/utils/weekUtils.js` (date-fns, `weekStartsOn: 1`)
- Theme (`client/src/theme.js`): Inter font, 12px border radius, gradient buttons/AppBar, hover-lift cards

### Key Models & Relationships
- **User** — login accounts (admin, team_lead). Has `isActive` for soft delete. Password field has `select: false`. JWT payload includes `id` and `role`.
- **Consultant** — sales consultants managed by team leads (no login account). Ref: `teamLead → User`
- **Commitment** — weekly sales tracking records. Ref: `teamLead → User`. Indexed on `(consultantName, weekNumber, year)`. Tracks `createdBy`/`lastUpdatedBy`. Status enum: `pending`, `in_progress`, `achieved`, `missed`.
- **Student** — admitted student records. Refs: `teamLead → User`, `consultant → Consultant`. Auto-increments `sno` per team lead. Pre-validate hook auto-calculates `conversionTime` and `month`. University and source are restricted enums.
- **Notification** — in-app notifications. Ref: `user → User`. Has `priority` (low/medium/high) and `type` fields.
- **WeeklySummary** — aggregated weekly metrics (appears unused — no controller or route references it)

### Business Logic
- **Weeks**: Monday–Sunday, ISO week numbers via `date-fns` (`weekStartsOn: 1`)
- **Admission closure is irreversible**: once `admissionClosed = true` on a Commitment, the server rejects any attempt to unset it
- **Lead stages**: Dead → Cold → Warm → Hot → Offer Sent → Awaiting Confirmation → Meeting Scheduled → Admission → CIF (+ Unresponsive)
- **Student serial numbers** (`sno`): auto-incremented per team lead via `Student.getNextSno(teamLeadId)`
- **Soft delete**: Users and Consultants use `isActive: false`
- **Permanent delete**: Deletes the entity without checks. Historical data (commitments, students) is preserved via denormalized string fields (`consultantName`, `teamLeadName`, `teamName`)

## Environment

Server env (`server/.env`): `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRE`, `JWT_REFRESH_EXPIRE`, `NODE_ENV`

Client env (`client/.env`): `REACT_APP_API_URL=http://localhost:5001/api` (production uses relative `/api`)

## Known Issues

- **Notification system is broken**: The Notification model defines the user reference field as `user`, but `notificationController.js` queries using `recipient` and checks `isActive` — neither exists on the model. Notification queries return empty results.
- **Client/server route mismatches**: Close admission (server: `PUT /:id/close-admission`, client: `PATCH /:id/close`), update meetings (server: `PUT`, client: `PATCH`), team consultants (server: `GET /api/users/team/:teamLeadId`, client: `GET /api/users/teamlead/:id/consultants`)
- **Client status mismatch**: `constants.js` `STATUS_LIST` includes `not_achieved` but the backend Commitment model enum uses `missed`
- **Duplicate `leadStage` field** in Commitment model — defined twice, second definition silently overwrites the first
- **`ConsultantDashboard.js`** in `client/src/pages/` is dead code (not imported or routed)
- **`express-validator`** is installed but never imported — all validation is manual in controllers

## Gotchas

- Client port is **3001** (not 3000), server port is **5001** (not 5000). If `server/.env` is missing, `server.js` defaults to port 5000 (not 5001).
- Multiple Axios interceptors set the auth token independently (in `commitmentService.js`, `userService.js`, and globally in `authService.js`). The `commitmentService` and `userService` interceptors are global (not instance-specific), so they stack up on the shared axios instance.
- `userService.js` uses `process.env.REACT_APP_API_URL` and sets `axios.defaults.baseURL`, while most other services import `API_BASE_URL` from `utils/constants.js`
- The `consultant` role exists in some legacy controller code but Users can only be `admin` or `team_lead`
- Commitment route file has careful ordering: specific routes (`/date-range`, `/week/:weekNumber/:year`) must come before the generic `/:id` catch-all
- No rate limiting or Helmet.js — security hardening is pending
