# Hourly Tracker Guide

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Product / training lead `[FILL]`

The Hourly Tracker (`/hourly-tracker`) records per-counselor activity
in fixed time slots. Two layouts exist: the **LUC flat layout** and the
**Skillhub multi-activity layout**.

## Slot model

Slots run from 09:30 to 19:00 with one-hour granularity:

| Slot ID | Time |
|---|---|
| `s0930` | 09:30–10:30 |
| `s1030` | 10:30–11:30 |
| `s1130` | 11:30–12:30 |
| `s1230` | 12:30–13:30 |
| `s1330` | 13:30–14:30 (lunch) |
| `s1430` | 14:30–15:30 |
| `s1530` | 15:30–16:30 |
| `s1630` | 16:30–17:30 |
| `s1730` | 17:30–18:30 |
| `s1830` | 18:30–19:00 (final) |

The same 10 slots apply to both layouts.

## Activity types

| Type | LUC | Skillhub | Notes |
|---|---|---|---|
| Calling | ✓ | ✓ | |
| Follow-up | ✓ | ✓ | LUC pairs Calling + Follow-up under one combined display |
| Demo Meeting | ✓ | ✓ | |
| Zoom | ✓ | ✓ | |
| Operations | ✓ | ✓ | |
| Drip | ✓ | ✓ | |
| Out Meeting | ✓ | ✓ | |
| Team Meeting | ✓ | ✓ | |
| TL's Team Meeting | ✓ | ✓ | |
| `sh_meeting` | — | ✓ | Skillhub-only, **duration-based** (30 min – 3 hr) |

## LUC layout

A single activity per slot with a count and optional note.

1. Pick a date (defaults to today).
2. Pick a consultant.
3. For each slot: choose activity type, enter count (and follow-up count
   when applicable), enter duration in minutes if relevant.

## Skillhub layout

Multiple activities per slot via the `activities[]` shape. Each entry
has its own type and count or duration. Use this when, for example, a
counselor takes a few calls and then runs a 60-minute parent meeting.

The leaderboard scores `sh_meeting` between Calling and Demo Meeting.

[SCREENSHOT: Skillhub multi-activity slot]

## Daily admissions and references (Skillhub)

In addition to slot logging, Skillhub captures:

- `dailyAdmissions/:org/:date` — how many admissions closed today
- `dailyReferences/:org/:date` — how many referrals were collected

These feed the dashboard KPIs.

## Leaderboard

`/hourly-tracker` → "Leaderboard" tab. Shows top performers across the
configured period, scored by activity volume × type weights. Useful for
recognition and coaching.

## AI insights

`/hourly-tracker` → "AI Insights". The tracker chat assistant analyses
the activity pattern for the chosen counselor / period. Verify before
relying on the conclusions.

## Gotchas

- Slot upserts are unique per `(consultant, date, slot)`. Editing the
  same slot replaces, not appends.
- `sh_meeting` durations under 30 minutes or over 3 hours are rejected.
- The leaderboard and AI insights respect your role's scope — team leads
  see their own team only; Skillhub branches see their own counselors.

## Related documents

- [Skillhub Counselor Manual](04-skillhub-counselor-manual.md)
- [Team Lead Manual](02-team-lead-manual.md)
- [Export Center Guide](06-export-center-guide.md)
- [API Reference §Hourly](../engineering/02-api-reference.md)
