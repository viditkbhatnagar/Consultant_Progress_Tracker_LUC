// Table view
const { useState: useStateT, useRef: useRefT } = React;

const TableView = ({ rows, density, selected, toggleSelect, toggleAll, onOpen, onStatusChange }) => {
  const [popover, setPopover] = useStateT(null); // {id, rect}
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));

  return (
    <div className={"table-wrap " + density}>
      <table className="tracker-table">
        <thead>
          <tr>
            <th className="cb">
              <Checkbox checked={allSelected} onChange={() => toggleAll(rows)} />
            </th>
            <th className="th-date">Date <Icon name="chevronDown" size={12} /></th>
            <th>Student</th>
            <th>Program</th>
            <th>Mode</th>
            <th>Consultant</th>
            <th>Team Lead</th>
            <th>Status</th>
            <th>Remarks</th>
            <th className="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isSel = selected.has(r.id);
            return (
              <tr key={r.id} className={isSel ? "selected" : ""}>
                <td className="cb"><Checkbox checked={isSel} onChange={() => toggleSelect(r.id)} /></td>
                <td className="num"><span className="date-chip">{r.date}</span></td>
                <td>
                  <button className="student" onClick={() => onOpen(r)}>
                    <Avatar name={r.name} size={26} />
                    <div>
                      <div className="student-name">{r.name}</div>
                      <div className="student-sub">#{r.id.slice(-4)}</div>
                    </div>
                  </button>
                </td>
                <td><span className="program-pill">{r.program}</span></td>
                <td>
                  <span className={"mode " + (r.mode === "Zoom" ? "mode-zoom" : "mode-out")}>
                    <ModeIcon mode={r.mode} /> {r.mode}
                  </span>
                </td>
                <td><div className="person"><Avatar name={r.consultant} size={20} /><span>{r.consultant}</span></div></td>
                <td><div className="person"><Avatar name={r.teamLead} size={20} /><span>{r.teamLead}</span></div></td>
                <td>
                  <StatusPill
                    status={r.status}
                    onClick={(e) => setPopover({ id: r.id, rect: e.currentTarget.getBoundingClientRect() })}
                  />
                </td>
                <td className="remarks">
                  {r.remarks ? <span title={r.remarks}>{r.remarks}</span> : <span className="dim">—</span>}
                </td>
                <td className="actions">
                  <button className="iconbtn ghost" aria-label="Edit" onClick={() => onOpen(r)}><Icon name="edit" size={14} /></button>
                  <button className="iconbtn ghost" aria-label="More"><Icon name="more" size={14} /></button>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan="10" className="empty">No meetings match your filters.</td></tr>
          )}
        </tbody>
      </table>

      <Popover
        open={!!popover}
        onClose={() => setPopover(null)}
        anchorRect={popover?.rect}
        width={180}
      >
        <div className="menu-label">Change status</div>
        {MT_DATA.statuses.map(s => (
          <button key={s} className="menu-item" onClick={() => { onStatusChange(popover.id, s); setPopover(null); }}>
            <StatusPill status={s} size="sm" /> 
          </button>
        ))}
      </Popover>
    </div>
  );
};

const Checkbox = ({ checked, onChange }) => (
  <label className="cbx">
    <input type="checkbox" checked={checked} onChange={onChange} />
    <span className="cbx-box">{checked && <Icon name="check" size={10} strokeWidth={3} />}</span>
  </label>
);

Object.assign(window, { TableView, Checkbox });
