// Main app shell
const { useState: useStateA, useMemo: useMemoA, useEffect: useEffectA } = React;

const SAVED = JSON.parse(localStorage.getItem("mt-state") || "null") || {};

const App = () => {
  const [tweaks, setTweaks] = useStateA({
    theme: SAVED.theme || "light",
    density: SAVED.density || "compact",
    view: SAVED.view || "table",
    accent: SAVED.accent || "oklch(0.55 0.19 270)",
    showKpis: SAVED.showKpis !== false,
  });
  const [tweakOpen, setTweakOpen] = useStateA(false);
  const [rows, setRows] = useStateA(MT_DATA.rows);
  const [filters, setFilters] = useStateA({
    status: "all", program: "all", mode: "all", consultant: "all", teamLead: "all", date: "all",
  });
  const [selected, setSelected] = useStateA(new Set());
  const [drawerRow, setDrawerRow] = useStateA(null);
  const [modalOpen, setModalOpen] = useStateA(false);

  useEffectA(() => {
    localStorage.setItem("mt-state", JSON.stringify(tweaks));
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.style.setProperty("--accent", tweaks.accent);
  }, [tweaks]);

  // Tweaks wiring
  useEffectA(() => {
    const onMsg = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweakOpen(true);
      if (e.data?.type === "__deactivate_edit_mode") setTweakOpen(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const setTweak = (patch) => {
    const next = { ...tweaks, ...patch };
    setTweaks(next);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*");
  };

  const filtered = useMemoA(() => {
    return rows.filter(r => {
      if (filters.status !== "all" && r.status !== filters.status) return false;
      if (filters.program !== "all" && r.program !== filters.program) return false;
      if (filters.mode !== "all" && r.mode !== filters.mode) return false;
      if (filters.consultant !== "all" && r.consultant !== filters.consultant) return false;
      if (filters.teamLead !== "all" && r.teamLead !== filters.teamLead) return false;
      return true;
    });
  }, [rows, filters]);

  const clearFilters = () => setFilters({
    status: "all", program: "all", mode: "all", consultant: "all", teamLead: "all", date: "all"
  });

  const toggleSelect = (id) => {
    const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n);
  };
  const toggleAll = (visible) => {
    const allSel = visible.every(r => selected.has(r.id));
    const n = new Set(selected);
    if (allSel) visible.forEach(r => n.delete(r.id));
    else visible.forEach(r => n.add(r.id));
    setSelected(n);
  };

  const updateStatus = (id, status) => {
    setRows(rows.map(r => r.id === id ? { ...r, status } : r));
  };

  const addMeeting = (form) => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const newRow = {
      id: "m-" + Date.now(),
      date: `${dd}/${mm}/${now.getFullYear()}`,
      dateObj: now,
      ...form,
    };
    setRows([newRow, ...rows]);
    setModalOpen(false);
  };

  return (
    <div className="app">
      <TopBar accent={tweaks.accent} />
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Admissions tracker</h1>
            <p className="page-subtitle">
              <span className="dot-sep" />
              {filtered.length} of {rows.length} meetings · updated just now
            </p>
          </div>
          <div className="page-head-right">
            <button className="btn ghost sm" onClick={() => setTweakOpen(!tweakOpen)}>
              <Icon name="sparkle" size={14} /> Tweaks
            </button>
          </div>
        </div>

        {tweaks.showKpis && <KPIStrip rows={rows} statuses={MT_DATA.statuses} />}

        <Toolbar
          view={tweaks.view} setView={(v) => setTweak({ view: v })}
          filters={filters} setFilters={setFilters} clearFilters={clearFilters}
          selectedCount={selected.size}
          onBulk={() => {}}
          onAdd={() => setModalOpen(true)}
          density={tweaks.density} setDensity={(d) => setTweak({ density: d })}
        />

        <div className="view-area">
          {tweaks.view === "table" && (
            <TableView
              rows={filtered}
              density={tweaks.density}
              selected={selected}
              toggleSelect={toggleSelect}
              toggleAll={toggleAll}
              onOpen={setDrawerRow}
              onStatusChange={updateStatus}
            />
          )}
          {tweaks.view === "board" && <BoardView rows={filtered} onOpen={setDrawerRow} />}
          {tweaks.view === "cards" && <CardsView rows={filtered} onOpen={setDrawerRow} />}
        </div>

        <div className="page-foot">
          <span>Showing {filtered.length} of {rows.length}</span>
          <div className="pagination">
            <button className="iconbtn ghost xs"><Icon name="chevronLeft" size={14} /></button>
            <span className="page-indicator">Page 1 of 1</span>
            <button className="iconbtn ghost xs"><Icon name="chevronRight" size={14} /></button>
          </div>
        </div>
      </main>

      <Drawer row={drawerRow} onClose={() => setDrawerRow(null)} onUpdate={updateStatus} />
      <AddMeetingModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={addMeeting} />
      <TweakPanel open={tweakOpen} state={tweaks} setState={setTweak} onClose={() => setTweakOpen(false)} />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
