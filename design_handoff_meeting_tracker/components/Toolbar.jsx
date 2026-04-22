// Toolbar: view switcher, filters, bulk actions

const FilterChip = ({ label, value, onClear, onClick, active }) => (
  <button className={"chip " + (active ? "active" : "")} onClick={onClick}>
    <span className="chip-label">{label}</span>
    {value && <span className="chip-value">{value}</span>}
    <Icon name={value ? "x" : "chevronDown"} size={12} />
  </button>
);

const Toolbar = ({
  view, setView, filters, setFilters, clearFilters, selectedCount, onBulk,
  onAdd, density, setDensity
}) => {
  const { consultants, teamLeads, statuses, modes, programs } = MT_DATA;
  const hasFilters = Object.values(filters).some(v => v && v !== "all");

  const cycle = (k, options) => {
    const cur = filters[k];
    const idx = cur === "all" ? -1 : options.indexOf(cur);
    const next = idx + 1 >= options.length ? "all" : options[idx + 1];
    setFilters({ ...filters, [k]: next });
  };

  return (
    <div className="toolbar">
      <div className="toolbar-row top">
        <div className="segmented">
          <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}>
            <Icon name="table" size={14} /> Table
          </button>
          <button className={view === "board" ? "on" : ""} onClick={() => setView("board")}>
            <Icon name="board" size={14} /> Board
          </button>
          <button className={view === "cards" ? "on" : ""} onClick={() => setView("cards")}>
            <Icon name="grid" size={14} /> Cards
          </button>
        </div>

        <div className="spacer" />

        <button className="btn ghost sm" onClick={() => setDensity(density === "compact" ? "comfy" : "compact")}>
          <Icon name="sort" size={14} />
          {density === "compact" ? "Compact" : "Comfy"}
        </button>
        <button className="btn ghost sm">
          <Icon name="download" size={14} /> Export
        </button>
        <button className="btn primary" onClick={onAdd}>
          <Icon name="plus" size={14} strokeWidth={2.4} /> New meeting
        </button>
      </div>

      <div className="toolbar-row filters">
        <FilterChip label="Status" value={filters.status !== "all" ? filters.status : ""}
          onClick={() => cycle("status", statuses)} active={filters.status !== "all"} />
        <FilterChip label="Program" value={filters.program !== "all" ? filters.program : ""}
          onClick={() => cycle("program", programs)} active={filters.program !== "all"} />
        <FilterChip label="Mode" value={filters.mode !== "all" ? filters.mode : ""}
          onClick={() => cycle("mode", modes)} active={filters.mode !== "all"} />
        <FilterChip label="Consultant" value={filters.consultant !== "all" ? filters.consultant : ""}
          onClick={() => cycle("consultant", consultants)} active={filters.consultant !== "all"} />
        <FilterChip label="Team lead" value={filters.teamLead !== "all" ? filters.teamLead : ""}
          onClick={() => cycle("teamLead", teamLeads)} active={filters.teamLead !== "all"} />
        <FilterChip label="Date range" value={filters.date !== "all" ? filters.date : ""}
          onClick={() => cycle("date", ["This week", "This month", "Last 30 days"])}
          active={filters.date !== "all"} />

        {hasFilters && (
          <button className="linkbtn" onClick={clearFilters}>Clear all</button>
        )}

        <div className="spacer" />

        {selectedCount > 0 && (
          <div className="bulk">
            <span className="bulk-count">{selectedCount} selected</span>
            <button className="btn ghost sm" onClick={() => onBulk("status")}>Change status</button>
            <button className="btn ghost sm" onClick={() => onBulk("assign")}>Reassign</button>
            <button className="btn ghost sm danger" onClick={() => onBulk("delete")}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { Toolbar });
