import React, { useEffect, useMemo, useState } from 'react';

// 3 cyclists ride at the same ground level. They have different speeds so the
// pack churns naturally — leader pulls away, gets caught, drops back, etc.
// The animation-delay values stagger their starting x-position so on first
// paint they're already spread across the screen instead of all entering from
// the left at once.
const layersData = [
  { className: 'layer-6', speed: '120s', size: '222px', zIndex: 1, image: '6' },
  { className: 'layer-5', speed: '95s',  size: '311px', zIndex: 1, image: '5' },
  { className: 'layer-4', speed: '75s',  size: '468px', zIndex: 1, image: '4' },
  { className: 'bike-1',  speed: '11s',  size: '75px',  zIndex: 2, image: 'bike', animation: 'mv_bike', bottom: '95px', noRepeat: true, delay: '-8s' },
  { className: 'bike-2',  speed: '14s',  size: '75px',  zIndex: 2, image: 'bike', animation: 'mv_bike', bottom: '95px', noRepeat: true, delay: '-5s' },
  { className: 'bike-3',  speed: '17s',  size: '75px',  zIndex: 2, image: 'bike', animation: 'mv_bike', bottom: '95px', noRepeat: true, delay: '-2s' },
  { className: 'layer-3', speed: '55s',  size: '158px', zIndex: 3, image: '3' },
  { className: 'layer-2', speed: '30s',  size: '145px', zIndex: 4, image: '2' },
  { className: 'layer-1', speed: '20s',  size: '136px', zIndex: 5, image: '1' },
];

// Each card mirrors its bike's animation timing so it stays glued above the
// rider. Sits in a higher z-index so it reads above foreground mountains.
const cardData = [
  { className: 'card-1', speed: '11s', delay: '-8s', role: 'leader' },
  { className: 'card-2', speed: '14s', delay: '-5s', role: 'middle' },
  { className: 'card-3', speed: '17s', delay: '-2s', role: 'rear'   },
];

// Each scene = a team lead leading two teammates. Pulled from
// server/scripts/seedDatabase.js (LUC team leads + their consultants).
// Admin scene = Bhanu leading the team leads themselves.
const TEAM_SCENES = [
  {
    leader: { name: 'Tony',     line: "Elizabeth, Swetha — let's close strong!" },
    middle: { name: 'Elizabeth', line: 'On it, Tony!' },
    rear:   { name: 'Swetha',   line: 'Right behind you!' },
  },
  {
    leader: { name: 'Shasin', line: "Linta, Dipin — Q-target this Friday!" },
    middle: { name: 'Linta',  line: "We're pushing hard!" },
    rear:   { name: 'Dipin',  line: 'Almost there!' },
  },
  {
    leader: { name: 'Arfath',    line: "Lilian, Aishwarya — keep pace!" },
    middle: { name: 'Lilian',    line: 'Catching up, Arfath!' },
    rear:   { name: 'Aishwarya', line: 'Pedal harder!' },
  },
  {
    leader: { name: 'Shakil', line: "Nihala, Lijia — eyes on the prize!" },
    middle: { name: 'Nihala', line: 'Locked in!' },
    rear:   { name: 'Lijia',  line: 'Following your lead!' },
  },
  {
    leader: { name: 'Manoj',  line: "Shahal, Eslam — push push push!" },
    middle: { name: 'Shahal', line: 'Going strong!' },
    rear:   { name: 'Eslam',  line: "Won't slow down!" },
  },
  {
    leader: { name: 'Anousha',  line: "Farineen, Arunima — one more call!" },
    middle: { name: 'Farineen', line: 'Dialing now!' },
    rear:   { name: 'Arunima',  line: 'Closing the next one!' },
  },
  {
    leader: { name: 'Jamshad',   line: "Arfas, Kasanjali — front of the pack!" },
    middle: { name: 'Arfas',     line: 'On your wheel!' },
    rear:   { name: 'Kasanjali', line: "Let's win this!" },
  },
  {
    leader: { name: 'Bahrain', line: "Chitra, Aghin — target up ahead!" },
    middle: { name: 'Chitra',  line: 'Pushing through!' },
    rear:   { name: 'Aghin',   line: 'Going for it!' },
  },
  {
    leader: { name: 'Shaik',    line: "Faizaan, Thanusree — Q-end strong!" },
    middle: { name: 'Faizaan',  line: 'On track!' },
    rear:   { name: 'Thanusree', line: 'Right with you!' },
  },
  // Admin scene — Bhanu leads the team leads themselves
  {
    leader: { name: 'Bhanu',  line: 'Team — best quarter ever, let’s go!' },
    middle: { name: 'Tony',   line: 'Leading the charge!' },
    rear:   { name: 'Shasin', line: 'Right behind you!' },
  },
];

const baseStyles = `
  .mv-bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: linear-gradient(to bottom, #aac8db 0%, #cfdcc5 38%, #efd3a8 72%, #e6bd86 100%);
  }
  .mv-bg .mv-layer {
    position: absolute;
    inset: 0;
    background-repeat: repeat-x;
    background-position: 0 100%;
    animation-name: mv_drift;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    will-change: background-position;
  }
  .mv-bg .bike-1,
  .mv-bg .bike-2,
  .mv-bg .bike-3 {
    top: auto;
    right: auto;
    left: 0;
    width: 90px;
    height: 75px;
    background-position: 0 0;
    will-change: transform;
  }
  .mv-bg .mv-card {
    position: absolute;
    left: 0;
    bottom: 180px;
    transform: translateX(-260px);
    background: #ffffff;
    border: 1.5px solid #1f2240;
    border-radius: 14px;
    padding: 6px 12px 8px;
    width: max-content;
    max-width: 230px;
    z-index: 10;
    text-align: center;
    line-height: 1.25;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    animation-name: mv_bike;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    will-change: transform;
    pointer-events: none;
    transition: opacity 0.45s ease;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .mv-bg .mv-card-name {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.10em;
    color: #667eea;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .mv-bg .mv-card.is-leader .mv-card-name {
    color: #764ba2;
  }
  .mv-bg .mv-card-line {
    font-size: 11.5px;
    font-weight: 500;
    color: #1f2240;
    font-style: italic;
  }
  .mv-bg .mv-card::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 22px;
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid #ffffff;
  }
  .mv-bg .mv-card::before {
    content: '';
    position: absolute;
    bottom: -8px;
    left: 20px;
    width: 0;
    height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-top: 8px solid #1f2240;
  }
  @keyframes mv_drift {
    from { background-position: 0 100%; }
    to   { background-position: -1500px 100%; }
  }
  @keyframes mv_bike {
    from { transform: translateX(-260px); }
    to   { transform: translateX(calc(100vw + 260px)); }
  }
  @media (prefers-reduced-motion: reduce) {
    .mv-bg .mv-layer { animation: none !important; }
    .mv-bg .mv-card  { animation: none !important; opacity: 0 !important; }
  }
  @media (max-width: 600px) {
    .mv-bg .mv-card { max-width: 170px; padding: 5px 10px 6px; }
    .mv-bg .mv-card-name { font-size: 9px; }
    .mv-bg .mv-card-line { font-size: 10.5px; }
  }
`;

const MountainVistaParallax = () => {
  const [sceneIdx, setSceneIdx] = useState(() =>
    Math.floor(Math.random() * TEAM_SCENES.length)
  );
  const [cardsVisible, setCardsVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setCardsVisible(false);
      setTimeout(() => {
        setSceneIdx((i) => (i + 1) % TEAM_SCENES.length);
        setCardsVisible(true);
      }, 450);
    }, 9000);
    return () => clearInterval(id);
  }, []);

  const dynamicStyles = useMemo(() => {
    const layerCss = layersData
      .map((layer) => {
        const url = `https://s3-us-west-2.amazonaws.com/s.cdpn.io/24650/${layer.image}.png`;
        return `
          .mv-bg .${layer.className} {
            background-image: url(${url});
            animation-duration: ${layer.speed};
            background-size: auto ${layer.size};
            z-index: ${layer.zIndex};
            ${layer.animation ? `animation-name: ${layer.animation};` : ''}
            ${layer.delay ? `animation-delay: ${layer.delay};` : ''}
            ${layer.bottom ? `bottom: ${layer.bottom};` : ''}
            ${layer.noRepeat ? 'background-repeat: no-repeat;' : ''}
          }
        `;
      })
      .join('\n');

    const cardCss = cardData
      .map(
        (c) => `
          .mv-bg .${c.className} {
            animation-duration: ${c.speed};
            animation-delay: ${c.delay};
          }
        `
      )
      .join('\n');

    return layerCss + '\n' + cardCss;
  }, []);

  const scene = TEAM_SCENES[sceneIdx];

  return (
    <div className="mv-bg" aria-hidden="true">
      <style>{baseStyles}</style>
      <style>{dynamicStyles}</style>
      {layersData.map((layer) => (
        <div key={layer.className} className={`mv-layer ${layer.className}`} />
      ))}
      {cardData.map((c) => {
        const data = scene[c.role];
        return (
          <div
            key={c.className}
            className={`mv-card ${c.className}${c.role === 'leader' ? ' is-leader' : ''}`}
            style={{ opacity: cardsVisible ? 1 : 0 }}
          >
            <div className="mv-card-name">{data.name}</div>
            <div className="mv-card-line">{data.line}</div>
          </div>
        );
      })}
    </div>
  );
};

export default React.memo(MountainVistaParallax);
