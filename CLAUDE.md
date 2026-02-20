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

# Seed database
npm run seed
# or: cd server && node utils/seedUsers.js

# Run frontend tests (Jest + React Testing Library)
cd client && npm test
```

**No backend tests exist** — `npm test` in `server/` is a no-op.

## Architecture

### Backend (server/)
- **Express.js** with CommonJS modules, Mongoose ODM, MongoDB Atlas
- Entry point: `server/server.js` (port 5001)
- Auth: JWT tokens via `Authorization: Bearer <token>` header
- Middleware: `auth.js` exports `protect` (JWT verification) and `authorize(...roles)` (role check)
- Routes all prefixed `/api`: auth, users, consultants, commitments, students, notifications
- In production, Express serves the React build as static files with SPA fallback

### Frontend (client/)
- **React 19** + **MUI v7** + React Router v7 (port 3001)
- State: React Context for auth (`AuthContext`), local `useState` for everything else — no Redux
- API calls: service modules in `client/src/services/` using Axios with interceptors for auth tokens
- Route guard: `PrivateRoute` component checks auth + role
- Routes: `/login`, `/admin/dashboard`, `/team-lead/dashboard`, `/student-database`

### Key Models & Relationships
- **User** — login accounts (admin, team_lead). Has `isActive` for soft delete.
- **Consultant** — sales consultants managed by team leads (no login account). Ref: `teamLead → User`
- **Commitment** — weekly sales tracking records. Ref: `teamLead → User`. Indexed on `(consultantName, weekNumber, year)`
- **Student** — admitted student records. Refs: `teamLead → User`, `consultant → Consultant`. Auto-increments `sno` per team lead.
- **Notification** — in-app notifications. Ref: `user → User`
- **WeeklySummary** — aggregated weekly metrics

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

## Gotchas

- Client port is **3001** (not 3000), server port is **5001** (not 5000)
- Multiple Axios interceptors set the auth token independently (in `commitmentService.js`, `userService.js`, and globally in `authService.js`)
- The `consultant` role exists in some legacy controller code but Users can only be `admin` or `team_lead`
- No rate limiting or Helmet.js — security hardening is pending
