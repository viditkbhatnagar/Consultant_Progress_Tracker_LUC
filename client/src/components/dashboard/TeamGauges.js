import React from 'react';
import { Box, Typography } from '@mui/material';
import { Star as StarIcon } from '@mui/icons-material';

// A compact semicircular gauge where a FULL arc = 100% of target (the finish
// line). 98.5% therefore sits just before the finish; teams that beat target
// show a full arc (the exact % is printed below). pathLength=100 normalizes the
// dash so the fill is exact regardless of the arc's rendered pixel length.
function GaugeArc({ pct, color }) {
    const cx = 70, cy = 60, r = 52, sw = 11, max = 100; // full gauge = 100% of target
    const frac = Math.max(0, Math.min((pct || 0) / max, 1));
    const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`; // top semicircle
    const angle = ((180 - frac * 180) * Math.PI) / 180;
    const mx = cx + r * Math.cos(angle);
    const my = cy - r * Math.sin(angle);
    return (
        <svg viewBox="0 0 140 72" style={{ width: '100%', display: 'block' }}>
            <path d={arc} fill="none" stroke="#E7E4DD" strokeWidth={sw} strokeLinecap="round" />
            <path d={arc} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" pathLength={100} strokeDasharray={`${frac * 100} 100`} />
            <circle cx={mx} cy={my} r={5.5} fill={color} stroke="#fff" strokeWidth={1.5} />
            {/* 50% tick at the apex */}
            <line x1={cx} y1={2} x2={cx} y2={9} stroke="#C9C6BC" strokeWidth={1.5} />
            <text x={6} y={70} fontSize="7.5" fill="#B6B3A8">0%</text>
            <text x={134} y={70} textAnchor="end" fontSize="7.5" fill="#B6B3A8">100%</text>
        </svg>
    );
}

const aedK = (n) => `${Math.round((n || 0) / 1000).toLocaleString()}K`;

// At-a-glance gauge grid. Mirrors the detail table exactly: same team order (as
// passed in), 0/0 teams hidden, and achieved/target shown so every gauge is
// verifiable against the table. The single top performer gets a subtle ring +
// star (without re-ranking the list). metric = 'mtd' | 'ytd'.
export default function TeamGauges({ teams = [], metric = 'ytd' }) {
    const rows = teams
        .map((t) => {
            const target = metric === 'mtd' ? t.mtdTarget : t.ytdTarget;
            const achieved = metric === 'mtd' ? t.mtdAchieved : t.ytdAchieved;
            const pct = target ? (achieved / target) * 100 : 0;
            return { name: t.teamName, achieved, target, pct };
        })
        .filter((t) => t.target > 0 || t.achieved > 0);

    if (rows.length === 0) return null;
    const best = rows.reduce((m, t) => (t.pct > (m?.pct ?? -1) ? t : m), null);

    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 1.5 }}>
            {rows.map((t) => {
                const hit = t.pct >= 100;
                const color = hit ? '#1F7A35' : '#C77F1A';
                const isBest = best && t.name === best.name;
                return (
                    <Box key={t.name} sx={{
                        border: isBest ? '1.5px solid #2E9E4B' : '1px solid var(--d-border-soft, #ECE9E2)',
                        borderRadius: '14px', p: 1.5, textAlign: 'center', bgcolor: 'var(--d-surface, #fff)',
                        boxShadow: isBest ? '0 0 0 3px rgba(46,158,75,0.12)' : 'none',
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.25, minHeight: 18 }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--d-text, #191918)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {t.name}
                            </Typography>
                            {isBest && <StarIcon sx={{ fontSize: 14, color: '#2E9E4B' }} />}
                        </Box>
                        <GaugeArc pct={t.pct} color={color} />
                        <Typography sx={{ fontSize: 19, fontWeight: 800, color, lineHeight: 1, mt: -0.5 }}>
                            {t.pct.toFixed(1)}%
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: 'var(--d-text-muted, #8A887E)', mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                            AED {aedK(t.achieved)} / {aedK(t.target)}
                        </Typography>
                    </Box>
                );
            })}
        </Box>
    );
}
