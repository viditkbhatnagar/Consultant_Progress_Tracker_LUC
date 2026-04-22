// Top nav bar + KPI strip
const { useState: useStateH } = React;

const TopBar = ({ accent }) => {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="iconbtn ghost" aria-label="Back"><Icon name="chevronLeft" size={18} /></button>
        <div className="brand">
          <div className="brand-mark" style={{ background: accent }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M4 12h10M4 17h16" />
            </svg>
          </div>
          <div className="brand-text">
            <div className="brand-title">Meeting Tracker</div>
            <div className="brand-sub">Admissions · Spring intake 2026</div>
          </div>
        </div>
      </div>
      <div className="topbar-right">
        <div className="search">
          <Icon name="search" size={14} />
          <input placeholder="Search students, remarks…" />
          <kbd>⌘K</kbd>
        </div>
        <button className="iconbtn ghost" aria-label="Notifications"><Icon name="bell" size={16} /></button>
        <button className="iconbtn ghost" aria-label="Settings"><Icon name="settings" size={16} /></button>
        <div className="divider-v" />
        <div className="me">
          <Avatar name="Anousha Khan" size={28} />
          <div className="me-text">
            <div className="me-name">Anousha Khan</div>
            <div className="me-role">Team Lead</div>
          </div>
        </div>
      </div>
    </header>
  );
};

const KPI = ({ label, value, sub, trend, accent, spark }) => {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-row">
        <div className="kpi-value">{value}</div>
        {trend != null && (
          <div className={"kpi-trend " + (trend >= 0 ? "up" : "down")}>
            <Icon name={trend >= 0 ? "arrowUp" : "arrowDown"} size={12} strokeWidth={2.2} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="kpi-sub">{sub}</div>
      {spark && <div className="kpi-spark">{spark}</div>}
    </div>
  );
};

const Sparkline = ({ points, color = "currentColor" }) => {
  const w = 120, h = 28;
  const max = Math.max(...points), min = Math.min(...points);
  const norm = (v) => h - 2 - ((v - min) / Math.max(1, max - min)) * (h - 4);
  const step = w / (points.length - 1);
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${norm(v).toFixed(1)}`).join(" ");
  const area = d + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-grad)" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const FunnelBar = ({ rows, statuses }) => {
  const counts = statuses.map(s => rows.filter(r => r.status === s).length);
  const total = rows.length || 1;
  return (
    <div className="kpi kpi-wide">
      <div className="kpi-label">Pipeline this period</div>
      <div className="funnel">
        {statuses.map((s, i) => {
          const style = STATUS_STYLE[s];
          const pct = (counts[i] / total) * 100;
          return (
            <div key={s} className="funnel-seg" style={{ flex: counts[i] || 0.3 }}>
              <div className="funnel-bar" style={{ background: style.bg }}>
                <div className="funnel-fill" style={{ background: style.dot, width: `${pct}%` }} />
              </div>
              <div className="funnel-meta">
                <span className="funnel-dot" style={{ background: style.dot }} />
                <span className="funnel-label">{s}</span>
                <span className="funnel-count">{counts[i]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const KPIStrip = ({ rows, statuses }) => {
  const total = rows.length;
  const admissions = rows.filter(r => r.status === "Admission").length;
  const conv = total ? Math.round((admissions / total) * 100) : 0;
  const followUps = rows.filter(r => r.status === "Warm" || r.status === "Awaiting").length;
  const zoomCt = rows.filter(r => r.mode === "Zoom").length;
  const zoomPct = total ? Math.round((zoomCt / total) * 100) : 0;

  return (
    <div className="kpis">
      <KPI label="Meetings logged" value={total} sub="Last 30 days" trend={18}
        spark={<Sparkline points={[3,5,4,7,6,9,8,10,9,12,11,14]} color="var(--accent)" />} />
      <KPI label="Conversion" value={`${conv}%`} sub={`${admissions} admissions`} trend={6}
        spark={<Sparkline points={[20,22,25,24,28,30,32,35,34,36,39,conv]} color="oklch(0.62 0.15 155)" />} />
      <KPI label="Follow-ups due" value={followUps} sub="Warm + Awaiting" trend={-4}
        spark={<Sparkline points={[14,13,15,14,13,12,14,13,12,11,12,followUps]} color="oklch(0.70 0.17 60)" />} />
      <FunnelBar rows={rows} statuses={statuses} />
    </div>
  );
};

Object.assign(window, { TopBar, KPIStrip });
