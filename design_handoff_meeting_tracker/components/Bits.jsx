// Small shared bits: icons, pills, avatars, buttons
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Minimal inline SVG icons (stroke)
const Icon = ({ name, size = 16, className = "", strokeWidth = 1.8 }) => {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    chevronDown: <><path d="m6 9 6 6 6-6" /></>,
    chevronLeft: <><path d="m15 18-6-6 6-6" /></>,
    chevronRight: <><path d="m9 18 6-6-6-6" /></>,
    x: <><path d="M18 6 6 18M6 6l12 12" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
    video: <><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m22 8-6 4 6 4V8Z" /></>,
    mapPin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    edit: <><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" /></>,
    trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
    more: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
    filter: <><path d="M4 5h16M7 12h10M10 19h4" /></>,
    table: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>,
    board: <><rect x="3" y="3" width="6" height="18" rx="1.5" /><rect x="10" y="3" width="6" height="12" rx="1.5" /><rect x="17" y="3" width="4" height="8" rx="1.5" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></>,
    check: <><path d="m4 12 5 5L20 6" /></>,
    arrowUp: <><path d="M12 19V5m0 0-6 6m6-6 6 6" /></>,
    arrowDown: <><path d="M12 5v14m0 0 6-6m-6 6-6-6" /></>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    trendUp: <><path d="M3 17l6-6 4 4 7-7M14 8h7v7" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    bell: <><path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 3h16l-2-3ZM10 21a2 2 0 0 0 4 0" /></>,
    book: <><path d="M4 4h10a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H4V4ZM4 17h11" /></>,
    sort: <><path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths[name] || null}
    </svg>
  );
};

// Status palette (oklch, harmonic)
const STATUS_STYLE = {
  Admission:  { bg: "oklch(0.94 0.06 155)", fg: "oklch(0.38 0.11 155)", dot: "oklch(0.62 0.15 155)" },
  Warm:       { bg: "oklch(0.95 0.07 65)",  fg: "oklch(0.42 0.14 55)",  dot: "oklch(0.70 0.17 60)" },
  Awaiting:   { bg: "oklch(0.94 0.04 250)", fg: "oklch(0.40 0.10 260)", dot: "oklch(0.62 0.13 260)" },
  Lost:       { bg: "oklch(0.94 0.04 20)",  fg: "oklch(0.42 0.13 25)",  dot: "oklch(0.62 0.16 25)" },
};

const StatusPill = ({ status, onClick, size = "md" }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.Awaiting;
  const pad = size === "sm" ? "3px 8px 3px 7px" : "4px 10px 4px 8px";
  const fs = size === "sm" ? 11 : 12;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: pad, borderRadius: 999,
        background: s.bg, color: s.fg, fontSize: fs, fontWeight: 600,
        border: "1px solid transparent", cursor: onClick ? "pointer" : "default",
        letterSpacing: 0.1, lineHeight: 1,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot }} />
      {status}
    </button>
  );
};

// Deterministic avatar color from a name
const avatarColor = (name) => {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return { bg: `oklch(0.92 0.05 ${h})`, fg: `oklch(0.38 0.10 ${h})` };
};
const Avatar = ({ name, size = 24 }) => {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const c = avatarColor(name);
  return (
    <span style={{
      width: size, height: size, borderRadius: 999, background: c.bg, color: c.fg,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: 600, flexShrink: 0,
      fontFamily: "var(--font-sans)",
    }}>{initials}</span>
  );
};

const ModeIcon = ({ mode }) => {
  if (mode === "Zoom") return <Icon name="video" size={14} />;
  return <Icon name="mapPin" size={14} />;
};

// Lightweight popover
const Popover = ({ open, onClose, children, anchorRect, align = "start", width = 220 }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onEsc = (e) => { if (e.key === "Escape") onClose(); };
    setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open, onClose]);
  if (!open || !anchorRect) return null;
  const left = align === "end" ? anchorRect.right - width : anchorRect.left;
  const top = anchorRect.bottom + 6;
  return (
    <div ref={ref} style={{
      position: "fixed", top, left, width, zIndex: 50,
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: 6,
    }}>
      {children}
    </div>
  );
};

Object.assign(window, { Icon, StatusPill, Avatar, ModeIcon, Popover, STATUS_STYLE, avatarColor });
