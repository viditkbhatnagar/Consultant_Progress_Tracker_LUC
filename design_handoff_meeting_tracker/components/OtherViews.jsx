// Board (Kanban) view
const BoardView = ({ rows, onOpen }) => {
  const statuses = MT_DATA.statuses;
  return (
    <div className="board">
      {statuses.map(s => {
        const items = rows.filter(r => r.status === s);
        const style = STATUS_STYLE[s];
        return (
          <div key={s} className="board-col">
            <div className="board-head">
              <div className="board-head-left">
                <span className="board-dot" style={{ background: style.dot }} />
                <span className="board-title">{s}</span>
                <span className="board-count">{items.length}</span>
              </div>
              <button className="iconbtn ghost xs"><Icon name="plus" size={12} /></button>
            </div>
            <div className="board-body">
              {items.map(r => (
                <button key={r.id} className="bcard" onClick={() => onOpen(r)}>
                  <div className="bcard-top">
                    <Avatar name={r.name} size={28} />
                    <div className="bcard-who">
                      <p className="bcard-name">{r.name}</p>
                      <p className="bcard-sub">{r.program} · {r.date}</p>
                    </div>
                  </div>
                  {r.remarks && <div className="bcard-remark">{r.remarks}</div>}
                  <div className="bcard-bot">
                    <span className={"mode " + (r.mode === "Zoom" ? "mode-zoom" : "mode-out")}>
                      <ModeIcon mode={r.mode} /> {r.mode}
                    </span>
                    <div className="bcard-people">
                      <Avatar name={r.consultant} size={18} />
                      <Avatar name={r.teamLead} size={18} />
                    </div>
                  </div>
                </button>
              ))}
              {items.length === 0 && <div className="bcard-empty">Drop a meeting here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CardsView = ({ rows, onOpen, onStatusChange }) => {
  return (
    <div className="cards-grid">
      {rows.map(r => {
        const s = STATUS_STYLE[r.status];
        return (
          <div key={r.id} className="meet-card" onClick={() => onOpen(r)}>
            <div className="meet-card-stripe" style={{ background: s.dot }} />
            <div className="meet-card-top">
              <div className="meet-card-date">
                <div className="date-big">{r.date.slice(0, 2)}</div>
                <div className="date-mo">{monthName(r.date)}</div>
              </div>
              <StatusPill status={r.status} size="sm" />
            </div>
            <div className="meet-card-body">
              <Avatar name={r.name} size={40} />
              <div className="meet-card-who">
                <p className="meet-card-name">{r.name}</p>
                <p className="meet-card-sub">{r.program} program</p>
              </div>
            </div>
            <div className="meet-card-remarks">
              {r.remarks || <span className="dim">No remarks yet</span>}
            </div>
            <div className="meet-card-foot">
              <span className={"mode " + (r.mode === "Zoom" ? "mode-zoom" : "mode-out")}>
                <ModeIcon mode={r.mode} /> {r.mode}
              </span>
              <div className="meet-card-people">
                <Avatar name={r.consultant} size={22} />
                <Avatar name={r.teamLead} size={22} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const monthName = (d) => {
  const m = parseInt(d.slice(3, 5), 10);
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1];
};

Object.assign(window, { BoardView, CardsView });
