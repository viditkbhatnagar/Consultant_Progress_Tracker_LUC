// Tweaks panel — controlled by parent
const TweakPanel = ({ open, state, setState, onClose }) => {
  if (!open) return null;
  const accents = [
    { name: "Indigo",  value: "oklch(0.55 0.19 270)" },
    { name: "Teal",    value: "oklch(0.60 0.12 195)" },
    { name: "Plum",    value: "oklch(0.52 0.17 320)" },
    { name: "Olive",   value: "oklch(0.58 0.10 130)" },
    { name: "Ember",   value: "oklch(0.60 0.18 35)"  },
  ];
  return (
    <div className="tweaks">
      <div className="tweaks-head">
        <div className="tweaks-title"><Icon name="sparkle" size={14} /> Tweaks</div>
        <button className="iconbtn ghost xs" onClick={onClose}><Icon name="x" size={14} /></button>
      </div>

      <div className="tweak-row">
        <div className="tweak-label">Theme</div>
        <div className="seg2 sm">
          <button className={state.theme === "light" ? "on" : ""} onClick={() => setState({ theme: "light" })}>Light</button>
          <button className={state.theme === "dark" ? "on" : ""} onClick={() => setState({ theme: "dark" })}>Dark</button>
        </div>
      </div>

      <div className="tweak-row">
        <div className="tweak-label">Density</div>
        <div className="seg2 sm">
          <button className={state.density === "compact" ? "on" : ""} onClick={() => setState({ density: "compact" })}>Compact</button>
          <button className={state.density === "comfy" ? "on" : ""} onClick={() => setState({ density: "comfy" })}>Comfy</button>
        </div>
      </div>

      <div className="tweak-row">
        <div className="tweak-label">Default view</div>
        <div className="seg2 sm">
          <button className={state.view === "table" ? "on" : ""} onClick={() => setState({ view: "table" })}>Table</button>
          <button className={state.view === "board" ? "on" : ""} onClick={() => setState({ view: "board" })}>Board</button>
          <button className={state.view === "cards" ? "on" : ""} onClick={() => setState({ view: "cards" })}>Cards</button>
        </div>
      </div>

      <div className="tweak-row">
        <div className="tweak-label">Accent</div>
        <div className="swatches">
          {accents.map(a => (
            <button key={a.name}
              className={"swatch " + (state.accent === a.value ? "on" : "")}
              style={{ background: a.value }}
              onClick={() => setState({ accent: a.value })}
              title={a.name}
            />
          ))}
        </div>
      </div>

      <div className="tweak-row">
        <div className="tweak-label">Show KPIs</div>
        <div className="seg2 sm">
          <button className={state.showKpis ? "on" : ""} onClick={() => setState({ showKpis: true })}>On</button>
          <button className={!state.showKpis ? "on" : ""} onClick={() => setState({ showKpis: false })}>Off</button>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { TweakPanel });
