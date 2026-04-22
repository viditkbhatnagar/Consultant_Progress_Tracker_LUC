# Handoff: Meeting Tracker Redesign

## Overview
A redesign of the **Admissions Meeting Tracker** — an internal tool for education consultants and team leads to log, track, and update student-admission meetings across programs (BSc / MBA), meeting modes (Zoom / Out-Meeting), and a status pipeline (Warm → Awaiting Confirmation → Admission / Lost).

The redesign adds:
- A **KPI strip** at the top with meetings logged, conversion %, follow-ups due, and a pipeline funnel.
- **Three view modes** — Table (dense data), Board (Kanban by status), Cards (visual grid) — with a segmented switcher.
- **Inline status editing** via popover (no need to open a full edit form).
- A **detail drawer** (click a row/card) for full info, timeline, and inline remarks editing.
- A structured **Add Meeting modal** with segmented pickers and a status picker.
- **Filter chips**, **multi-select bulk actions**, **density toggle**, **light/dark mode**, and **accent color swap**.

---

## About the Design Files
The files in this bundle are **design references created in HTML/React/CSS** — prototypes showing the intended look and behavior, **not production code to copy directly**.

Your task is to **recreate these designs in the target codebase** using its existing framework, component library, state management, and patterns. If no framework is chosen yet, use React with the project's preferred component/styling approach (e.g., shadcn/ui + Tailwind, Mantine, Chakra, etc.).

Do not import the provided JSX files as-is. Use them only as a visual and behavioral specification.

---

## Fidelity
**High-fidelity.** Pixel-perfect mockups with final colors, typography, spacing, radii, shadows, and interactions. Recreate faithfully in the target codebase's design system — swap to existing tokens where they exist, use the values below where they don't.

---

## Scope of this Handoff
The user has asked specifically to integrate these pieces into their existing Meeting Tracker page:

1. **KPI cards row** (the 4-card strip above the table)
2. **Three view modes**: Table / Board / Cards, with a segmented toggle
3. **The table design** (inline status pill editing, avatar cells, mode icons, program pill, remarks, actions)

Drawer, Add-Meeting modal, filter chips, and Tweaks panel are **nice-to-haves** — implement if easy, skip otherwise.

---

## Screens / Views

### 1. Page Shell

**Layout**
- Sticky top nav bar (56px tall): back button + brand + search + user avatar.
- Main content area, `max-width: 1600px`, centered, padding `20px 28px 48px`.
- Page header: H1 "Admissions tracker" + subtitle showing counts.
- KPI strip (see §2).
- Toolbar (see §3).
- View area (see §4 / §5 / §6).
- Footer: showing-count and pagination.

**Top bar**
- Height ~56px, background `var(--surface)`, 1px border bottom `var(--border)`.
- Left: back chevron (icon-only ghost button), brand mark (28×28 rounded square, accent color bg, white grid icon), brand title ("Meeting Tracker", 13.5px, weight 650) + subtitle ("Admissions · Spring intake 2026", 11px, muted).
- Right: search input (min-width 320px, soft bg, ⌘K kbd badge), bell + settings icon buttons, vertical divider, avatar + name + role.

---

### 2. KPI Strip

A 4-column grid: `grid-template-columns: 1fr 1fr 1fr 1.6fr; gap: 12px`.

**Card A — Meetings logged**
- Label: "MEETINGS LOGGED" (11px, uppercase, letter-spacing 0.06em, muted)
- Value: big number (28px, weight 650, tabular numerals, `-0.02em` letter-spacing)
- Trend pill: `+18%` in green (success bg/fg)
- Sub: "Last 30 days" (11.5px, muted)
- Sparkline: 120×28 area chart, accent color with 0→0.25 opacity gradient fill

**Card B — Conversion**
- Same structure; value is `NN%`, trend `+6%`, sub = "N admissions"
- Sparkline in the **success green** (`oklch(0.62 0.15 155)`)

**Card C — Follow-ups due**
- Value is a count. Trend shown as `-4%` (down is good here)
- Sub: "Warm + Awaiting"
- Sparkline in **warm amber** (`oklch(0.70 0.17 60)`)

**Card D — Pipeline funnel** (wider, spans 1.6fr)
- Label: "PIPELINE THIS PERIOD"
- Below label: 4 vertical segments (one per status) laid in a flex row, each with:
  - A 6px-tall rounded pill track with a filled inner bar sized by that status's percentage (track uses status "bg" tint, fill uses status "dot" solid color)
  - Below the pill: dot · status name · count (tabular, right-aligned)

See [Design Tokens](#design-tokens) for status palette.

**Card container styling**
- Background `var(--surface)`, border `1px solid var(--border-soft)`, radius `14px`, padding `14px 16px`.
- No shadow by default.

---

### 3. Toolbar

Wrapped card (same styling as KPI cards), padding `10px 12px`, split into two rows.

**Row 1 (top)**
- Left: Segmented control with 3 options — Table / Board / Cards, each with a small leading icon. Active segment has white surface + subtle shadow; inactive is transparent with muted text.
- Right: density toggle ("Compact" / "Comfy"), Export button (ghost), "+ New meeting" (primary, accent fill).

**Row 2 (filters)** (dashed border-top separator)
- A row of **filter chips**: Status, Program, Mode, Consultant, Team lead, Date range.
  - Default chip: pill with **dashed** border, label, and chevron-down. Click cycles through values.
  - Active chip: solid border, tinted `var(--accent-soft)` background, accent-text color, shows chip label + value + `×` icon.
- "Clear all" link button appears when any filter is active.
- Right side: **bulk-actions bar** appears only when ≥1 row is selected — "N selected" label, Change status, Reassign, Delete (danger) buttons.

---

### 4. Table View

- Full-width table. Header row: `var(--surface-2)` bg, sticky, `11px` uppercase, letter-spacing 0.05em, muted-3 color.
- Row padding: compact = `7px 12px`, comfy = `10px 12px`.
- Row border: `1px solid var(--border-soft)` on the bottom of each `<td>`.
- Row hover: `var(--surface-2)` bg.
- Row selected: `color-mix(in oklch, var(--accent) 6%, var(--surface))` bg.

**Columns**
1. **Checkbox** (36px, left-padded 14px).
2. **Date** — tabular-nums, 12px, muted. Format `DD/MM/YYYY`.
3. **Student** — Avatar (26px, deterministic color from name) + Name (weight 550) + tiny mono ID badge `#1023` (10.5px, muted, JetBrains Mono).
4. **Program** — a monospace "pill": `BSc` / `MBA`, 11px, `padding: 2px 8px`, radius 6px, `surface-2` bg, border soft.
5. **Mode** — inline icon + label. **Zoom** = `video` icon in blue (`oklch(0.52 0.14 255)`), **Out Meeting** = `mapPin` icon in warm orange (`oklch(0.50 0.12 35)`). 12px.
6. **Consultant** — 20px avatar + name (12.5px, muted-2).
7. **Team Lead** — same as consultant.
8. **Status** — clickable pill (see [Status Pill](#status-pill) spec). Click opens a popover listing all statuses to change to.
9. **Remarks** — truncated to single line w/ ellipsis, max-width ~280px, `—` em-dash for empty.
10. **Actions** — edit + more, icon-only ghost buttons, right-aligned.

**Checkbox**
- 15×15, 1.5px border, 4px radius. Checked = accent fill + white checkmark.

---

### 5. Board (Kanban) View

- 4-column CSS grid (one per status), gap 12px, `var(--surface-2)` bg wrap, padding 12px.
- Each column: surface bg, soft border, radius 10px, min-height 360px.
- Column header: status dot + title (weight 600, 12.5px) + muted count pill + "+" icon button on right.
- **Card** inside column:
  - Padding 10px, `var(--bg-soft)` bg, soft border, radius 10px.
  - Top: avatar (28px) + `.bcard-who` flex column (min-width: 0) containing name (600, truncated with ellipsis, single-line, line-height 1.3) and sub "Program · Date" (11px, muted-3). **Avatar must be `align-items: flex-start`** so it doesn't drift when name wraps.
  - Middle: optional remark excerpt (11.5px, muted-2, up to 2 lines).
  - Bottom: mode chip (left) + stacked avatars of consultant and team lead (overlap with 1.5px surface ring, right).
- Hover: surface bg + small shadow.
- Empty column shows a dashed placeholder "Drop a meeting here".

---

### 6. Cards View

- Responsive grid: `repeat(auto-fill, minmax(280px, 1fr))`, gap 12px, surface-2 bg wrap.
- Each card:
  - 3px-wide left stripe in status dot color.
  - Top row: big date — day number (22px, weight 650, tabular) + month (10.5px, uppercase, muted) — and status pill on the right.
  - Middle: 40px avatar + Name (13.5px, 600) + "Program program" sub (11.5px, muted-3).
  - Remarks (11.5px, muted-2, min-height 30px, bottom border soft).
  - Bottom: mode chip (left) + stacked consultant/team-lead avatars (right).
- Hover: lift (translate -1px) + shadow.

---

### 7. Detail Drawer (click a row / card)

- Right-anchored panel, 480px wide, full height.
- Scrim: `oklch(0.15 0.01 85 / 0.35)` with 2px backdrop-filter blur.
- Enters with 0.2s ease-out slide-in from right.
- Head: close button + bell + more.
- Body sections (all 18–22px vertical rhythm):
  1. **Hero**: 56px avatar + name (18px, 650) + ID/date sub + status pill.
  2. **Field grid** (2 cols): Program, Mode, Consultant, Team lead — each in a soft-bordered mini-card with uppercase label + value.
  3. **Remarks**: section title + textarea (soft bg, resize-vertical).
  4. **Timeline**: list of events with a dot and timestamp ("Today · 10:24").
  5. **Quick actions**: Reschedule, Student profile, Send brochure (ghost buttons).
- Footer: Close (ghost) + Save changes (primary).

---

### 8. Add Meeting Modal

- Centered, 560px wide, same scrim.
- Head: title "New meeting" + subtitle.
- Body: 2-column grid with fields:
  - Student name (full-width input)
  - Program (segmented BSc/MBA)
  - Mode (segmented Zoom/Out Meeting)
  - Consultant (select)
  - Team lead (select)
  - Status (full-width — row of status pills with an accent ring when selected)
  - Remarks (full-width textarea)
- Foot: Cancel (ghost) + "Log meeting" (primary, with plus icon).
- Field labels are uppercase, 11.5px, letter-spacing 0.04em, color muted-3.
- Inputs: 8px radius, 1px border, surface bg, focus ring = accent border + surface bg.

---

## Interactions & Behavior

| Interaction | Behavior |
|-------------|----------|
| Click status pill in table | Opens popover below with status list; click to change. Escape or outside-click closes. |
| Click row (name/avatar) | Opens detail drawer. |
| Click "+ New meeting" | Opens Add Meeting modal. |
| Submit modal | Prepends new row; closes modal; resets form. |
| Click filter chip | Cycles through that filter's values (all → value1 → value2 → all). |
| Click "Clear all" | Resets all filters to "all". |
| Select checkboxes | Bulk action bar appears with count + actions. Header checkbox toggles select-all for currently visible rows. |
| Density toggle | Switches table row padding between 7px and 10px vertical. |
| View toggle | Swaps between Table / Board / Cards instantly. |
| Escape | Closes any open drawer/modal/popover. |

**Animations**
- Drawer: 200ms `cubic-bezier(0.2, 0.8, 0.2, 1)` translateX(20px → 0) + fade.
- Modal: 180ms same easing, translateY(8px) scale(0.98) → 1.
- Popover/Tweaks: 150ms fade/pop.
- Card hover in Cards view: 120ms translateY and shadow.

---

## State Management

Local component state is sufficient for this feature. Suggested shape:

```ts
type Meeting = {
  id: string;
  date: string;          // "DD/MM/YYYY"
  dateObj: Date;
  name: string;
  program: "BSc" | "MBA";
  mode: "Zoom" | "Out Meeting";
  consultant: string;
  teamLead: string;
  status: "Admission" | "Warm" | "Awaiting" | "Lost";
  remarks: string;
};

type Filters = {
  status: "all" | Status;
  program: "all" | Program;
  mode: "all" | Mode;
  consultant: "all" | string;
  teamLead: "all" | string;
  date: "all" | "This week" | "This month" | "Last 30 days";
};

type UIState = {
  view: "table" | "board" | "cards";
  density: "compact" | "comfy";
  theme: "light" | "dark";
  accent: string;       // oklch() color value
  showKpis: boolean;
  selected: Set<string>;
  drawerRow: Meeting | null;
  modalOpen: boolean;
};
```

Persist `view / density / theme / accent / showKpis` to `localStorage` or the user's preferences API.

KPI values (total, conversion, follow-ups) are **derived** from the rows — don't store them separately.

---

## Design Tokens

### Colors (Light)

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `oklch(0.985 0.005 85)` | Page background (warm off-white) |
| `--bg-soft` | `oklch(0.975 0.006 85)` | Kanban card inner bg |
| `--surface` | `oklch(0.998 0.002 85)` | Cards, table, modal bg |
| `--surface-2` | `oklch(0.975 0.006 85)` | Secondary surface, hovers, inputs |
| `--border` | `oklch(0.915 0.008 85)` | Strong border (table header divider) |
| `--border-soft` | `oklch(0.945 0.006 85)` | Subtle row borders, card outlines |
| `--text` | `oklch(0.22 0.008 85)` | Primary text |
| `--text-2` | `oklch(0.42 0.008 85)` | Secondary text |
| `--text-3` | `oklch(0.62 0.008 85)` | Muted / metadata |
| `--accent` | `oklch(0.55 0.19 270)` | Primary (indigo). User-swappable. |
| `--accent-soft` | `color-mix(in oklch, var(--accent) 10%, transparent)` | Active chip bg |
| `--accent-text` | `color-mix(in oklch, var(--accent) 70%, black)` | Link/active text |
| `--danger` | `oklch(0.58 0.19 25)` | Delete / destructive |

### Colors (Dark)

| Token | Value |
|-------|-------|
| `--bg` | `oklch(0.16 0.008 260)` |
| `--bg-soft` | `oklch(0.18 0.009 260)` |
| `--surface` | `oklch(0.21 0.009 260)` |
| `--surface-2` | `oklch(0.24 0.010 260)` |
| `--border` | `oklch(0.30 0.012 260)` |
| `--border-soft` | `oklch(0.26 0.010 260)` |
| `--text` | `oklch(0.95 0.008 260)` |
| `--text-2` | `oklch(0.78 0.010 260)` |
| `--text-3` | `oklch(0.60 0.010 260)` |

### Status Pill Palette

| Status | BG (pill fill) | FG (text) | Dot (solid) |
|--------|----------------|-----------|-------------|
| Admission | `oklch(0.94 0.06 155)` | `oklch(0.38 0.11 155)` | `oklch(0.62 0.15 155)` |
| Warm | `oklch(0.95 0.07 65)` | `oklch(0.42 0.14 55)` | `oklch(0.70 0.17 60)` |
| Awaiting | `oklch(0.94 0.04 250)` | `oklch(0.40 0.10 260)` | `oklch(0.62 0.13 260)` |
| Lost | `oklch(0.94 0.04 20)` | `oklch(0.42 0.13 25)` | `oklch(0.62 0.16 25)` |

**Status pill shape**: 999px radius, padding `4px 10px 4px 8px` (md) / `3px 8px 3px 7px` (sm), 12px (md) / 11px (sm) font, weight 600, leading 6×6 dot in "Dot" color.

### Accent presets (user-selectable)
- Indigo `oklch(0.55 0.19 270)` *(default)*
- Teal `oklch(0.60 0.12 195)`
- Plum `oklch(0.52 0.17 320)`
- Olive `oklch(0.58 0.10 130)`
- Ember `oklch(0.60 0.18 35)`

### Spacing
Tailwind-like scale works fine: 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 28 / 40 / 48px.

### Radii
| Token | Value |
|-------|-------|
| `--radius-sm` | 6px |
| `--radius` | 10px |
| `--radius-lg` | 14px |
| pill | 999px |

### Shadows
- `--shadow-sm`: `0 1px 2px oklch(0.2 0.01 85 / 0.06)`
- `--shadow`: `0 1px 3px .../0.06), 0 4px 12px .../0.04)`
- `--shadow-lg`: `0 10px 30px .../0.08), 0 2px 6px .../0.05)`

### Typography
- **Sans**: `Inter` (weights 400/500/550/600/650/700). `font-feature-settings: "cv02", "cv11", "ss01"`.
- **Mono**: `JetBrains Mono` (for IDs, program pills).
- Base body size: **13px** — this is a data-dense app; use this as `text-sm`.
- Tabular numerals on all numeric columns: `font-variant-numeric: tabular-nums`.

| Element | Size | Weight | Other |
|---------|------|--------|-------|
| Page H1 | 22px | 650 | `-0.02em` tracking |
| Page subtitle | 12px | 400 | muted-3 |
| KPI label | 11px | 550 | uppercase, 0.06em tracking, muted-3 |
| KPI value | 28px | 650 | tabular, `-0.02em` |
| Table header | 11px | 550 | uppercase, 0.05em tracking |
| Table cell | 12.5px | 400–550 | |
| Row primary (name) | 12.5px | 550 | |
| ID badge | 10.5px | 400 | mono, muted-3 |
| Status pill | 12px | 600 | |
| Drawer name | 18px | 650 | `-0.01em` |

---

## Assets

- **Icons**: inline SVG, 24×24 viewBox, stroke-based. The set used: `search, plus, chevronDown, chevronLeft, chevronRight, x, calendar, video, mapPin, edit, trash, more, filter, table, board, grid, download, check, arrowUp, arrowDown, sparkle, clock, settings, logout, user, bell, book, sort`. In the real codebase, **substitute with Lucide / Heroicons / Phosphor** — whichever is already used.
- **Fonts**: Inter + JetBrains Mono from Google Fonts. Swap to your project's existing font stack if different.
- **Avatars**: generated from initials with a deterministic oklch color from the name (hue = `charCodeAt` sum mod 360, lightness 0.92 / chroma 0.05 for bg, 0.38 / 0.10 for fg). No avatar images.

---

## Files in this Handoff

Reference files (do not ship as-is — they're HTML/JSX prototypes):
- `Meeting Tracker.html` — entry point, loads React UMD + Babel + all components
- `styles.css` — full stylesheet with design tokens (cited above)
- `data.js` — sample data and available status / program / mode / consultant / team-lead values
- `components/Bits.jsx` — Icon component, StatusPill, Avatar, ModeIcon, Popover, and the `STATUS_STYLE` palette
- `components/Header.jsx` — TopBar + KPIStrip + Sparkline + FunnelBar
- `components/Toolbar.jsx` — view switcher + filter chips + bulk actions
- `components/TableView.jsx` — table view with inline status popover
- `components/OtherViews.jsx` — Board (Kanban) and Cards views
- `components/Drawer.jsx` — detail drawer + Add Meeting modal
- `components/Tweaks.jsx` — theme / density / view / accent / KPI toggle panel
- `components/App.jsx` — shell wiring it all together

Open `Meeting Tracker.html` in a browser to see the live design.

---

## Implementation Checklist (priority order)

- [ ] Wire design tokens into the project's CSS variables / theme config
- [ ] Implement the **KPI strip** (4 cards, sparklines, funnel)
- [ ] Implement the **view switcher** (Table / Board / Cards segmented control)
- [ ] Implement the **Table view** (all 10 columns, inline status popover, checkboxes)
- [ ] Implement the **Board view** (Kanban by status, status palette)
- [ ] Implement the **Cards view** (grid, stripe, big date)
- [ ] Wire **filters** to the existing filter controls
- [ ] *(Optional)* Detail drawer, Add Meeting modal, Tweaks panel, dark mode

---

## Prompt to paste into Claude Code

> I'm implementing a redesign of our Meeting Tracker page. See `design_handoff_meeting_tracker/README.md` and the HTML files in that folder for the complete spec.
>
> **What to do:**
> 1. Read `README.md` end-to-end.
> 2. Open `Meeting Tracker.html` in a browser (or inspect `styles.css`, `components/*.jsx`) to see the live reference.
> 3. In our codebase, integrate these pieces into the existing Meeting Tracker page, using our existing component library, tokens, and styling approach:
>    - The **KPI card strip** (4 cards: meetings logged, conversion, follow-ups due, pipeline funnel).
>    - The **view switcher** with three modes: **Table**, **Board** (Kanban by status), **Cards**.
>    - The **Table view** design (inline status pill editing, avatars, mode icons, program pill, remarks truncation, row actions).
> 4. Use the design tokens and status-color palette from the README; re-use our existing button / input / modal / popover primitives rather than copying raw CSS.
> 5. Keep data shape and API calls as they are in our codebase — this is a UI redesign only.
>
> **Do not** copy the HTML/JSX prototypes as-is. Treat them as visual spec only. Match colors, spacing, and typography pixel-perfectly; match behavior where described. Ask before adding anything not in the spec.
