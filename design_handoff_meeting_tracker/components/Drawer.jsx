// Right-side drawer for row detail + Add Meeting modal
const { useState: useStateD, useEffect: useEffectD } = React;

const Drawer = ({ row, onClose, onUpdate }) => {
  useEffectD(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);
  if (!row) return null;

  return (
    <div className="drawer-layer">
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <button className="iconbtn ghost" onClick={onClose}><Icon name="x" size={16} /></button>
          <div className="drawer-head-actions">
            <button className="iconbtn ghost"><Icon name="bell" size={14} /></button>
            <button className="iconbtn ghost"><Icon name="more" size={14} /></button>
          </div>
        </div>
        <div className="drawer-body">
          <div className="drawer-hero">
            <Avatar name={row.name} size={56} />
            <div>
              <div className="drawer-name">{row.name}</div>
              <div className="drawer-sub">Meeting #{row.id.slice(-4)} · {row.date}</div>
            </div>
            <div className="drawer-hero-status">
              <StatusPill status={row.status} />
            </div>
          </div>

          <div className="drawer-grid">
            <Field label="Program" value={<span className="program-pill">{row.program}</span>} />
            <Field label="Mode" value={
              <span className={"mode " + (row.mode === "Zoom" ? "mode-zoom" : "mode-out")}>
                <ModeIcon mode={row.mode} /> {row.mode}
              </span>
            } />
            <Field label="Consultant" value={<div className="person"><Avatar name={row.consultant} size={20} /><span>{row.consultant}</span></div>} />
            <Field label="Team lead" value={<div className="person"><Avatar name={row.teamLead} size={20} /><span>{row.teamLead}</span></div>} />
          </div>

          <div className="drawer-section">
            <div className="section-title">Remarks</div>
            <textarea
              className="remarks-input"
              rows={3}
              defaultValue={row.remarks}
              placeholder="Add follow-up notes, objections, requested docs…"
            />
          </div>

          <div className="drawer-section">
            <div className="section-title">Timeline</div>
            <ul className="timeline">
              <li><span className="tl-dot" /><div><b>Status set to {row.status}</b><span className="tl-time">Today · 10:24</span></div></li>
              <li><span className="tl-dot" /><div>Meeting logged by {row.consultant}<span className="tl-time">{row.date}</span></div></li>
              <li><span className="tl-dot dim" /><div>Initial outreach<span className="tl-time">3 days before</span></div></li>
            </ul>
          </div>

          <div className="drawer-section">
            <div className="section-title">Quick actions</div>
            <div className="quick-actions">
              <button className="btn ghost sm"><Icon name="calendar" size={14} /> Reschedule</button>
              <button className="btn ghost sm"><Icon name="user" size={14} /> Student profile</button>
              <button className="btn ghost sm"><Icon name="book" size={14} /> Send brochure</button>
            </div>
          </div>
        </div>
        <div className="drawer-foot">
          <button className="btn ghost" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={onClose}>Save changes</button>
        </div>
      </aside>
    </div>
  );
};

const Field = ({ label, value }) => (
  <div className="field">
    <div className="field-label">{label}</div>
    <div className="field-value">{value}</div>
  </div>
);

const AddMeetingModal = ({ open, onClose, onSubmit }) => {
  const [form, setForm] = useStateD({
    name: "", program: "MBA", mode: "Zoom", consultant: "Arunima",
    teamLead: "Anousha", status: "Warm", remarks: "",
  });
  useEffectD(() => {
    if (!open) return;
    const onEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);
  if (!open) return null;

  const f = (k, v) => setForm({ ...form, [k]: v });
  const submit = () => {
    if (!form.name.trim()) return;
    onSubmit(form);
    setForm({ name: "", program: "MBA", mode: "Zoom", consultant: "Arunima", teamLead: "Anousha", status: "Warm", remarks: "" });
  };

  return (
    <div className="modal-layer">
      <div className="modal-scrim" onClick={onClose} />
      <div className="modal">
        <div className="modal-head">
          <div>
            <div className="modal-title">New meeting</div>
            <div className="modal-sub">Log an admissions meeting</div>
          </div>
          <button className="iconbtn ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <label className="fld full">
            <span>Student name</span>
            <input value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. Maria Anastasia" />
          </label>

          <label className="fld">
            <span>Program</span>
            <Segmented options={["BSc", "MBA"]} value={form.program} onChange={v => f("program", v)} />
          </label>
          <label className="fld">
            <span>Mode</span>
            <Segmented options={["Zoom", "Out Meeting"]} value={form.mode} onChange={v => f("mode", v)} />
          </label>

          <label className="fld">
            <span>Consultant</span>
            <Select options={MT_DATA.consultants} value={form.consultant} onChange={v => f("consultant", v)} />
          </label>
          <label className="fld">
            <span>Team lead</span>
            <Select options={MT_DATA.teamLeads} value={form.teamLead} onChange={v => f("teamLead", v)} />
          </label>

          <label className="fld full">
            <span>Status</span>
            <div className="status-picker">
              {MT_DATA.statuses.map(s => (
                <button key={s}
                  className={"sp-opt " + (form.status === s ? "on" : "")}
                  onClick={() => f("status", s)}>
                  <StatusPill status={s} size="sm" />
                </button>
              ))}
            </div>
          </label>

          <label className="fld full">
            <span>Remarks</span>
            <textarea rows={3} value={form.remarks} onChange={e => f("remarks", e.target.value)}
              placeholder="Follow-up plan, objections, documents…" />
          </label>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit}>
            <Icon name="plus" size={14} strokeWidth={2.4} /> Log meeting
          </button>
        </div>
      </div>
    </div>
  );
};

const Segmented = ({ options, value, onChange }) => (
  <div className="seg2">
    {options.map(o => (
      <button key={o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>{o}</button>
    ))}
  </div>
);

const Select = ({ options, value, onChange }) => (
  <div className="selectwrap">
    <select value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    <Icon name="chevronDown" size={12} />
  </div>
);

Object.assign(window, { Drawer, AddMeetingModal });
