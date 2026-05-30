import React from 'react';
import { Box, Typography } from '@mui/material';
import { Star as StarIcon } from '@mui/icons-material';

// A compact semicircular gauge (0–200% scale, 100% at the top), filled from the
// left proportional to the value, with a marker dot at the end.
function GaugeArc({ pct, color, empty }) {
    const cx = 70, cy = 60, r = 54, sw = 11, max = 200;
    const frac = Math.max(0, Math.min((pct || 0) / max, 1));
    const len = Math.PI * r;
    const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`; // top semicircle
    const angle = ((180 - frac * 180) * Math.PI) / 180;
    const mx = cx + r * Math.cos(angle);
    const my = cy - r * Math.sin(angle);
    return (
        <svg viewBox="0 0 140 70" style={{ width: '100%', display: 'block' }}>
            <path d={arc} fill="none" stroke="#E7E4DD" strokeWidth={sw} strokeLinecap="round" />
            {!empty && (
                <>
                    <path d={arc} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${frac * len} ${len}`} />
                    <circle cx={mx} cy={my} r={6} fill={color} stroke="#fff" strokeWidth={1.5} />
                </>
            )}
            <text x={cx} y={12} textAnchor="middle" fontSize="8.5" fill="#9A988E" fontWeight="700">100%</text>
            <text x={12} y={68} textAnchor="middle" fontSize="8" fill="#B6B3A8">0</text>
            <text x={128} y={68} textAnchor="middle" fontSize="8" fill="#B6B3A8">200</text>
        </svg>
    );
}

const aedK = (n) => `AED ${Math.round((n || 0) / 1000).toLocaleString()}K`;

// Ranked gauge grid for team performance. metric = 'mtd' | 'ytd'.
export default function TeamGauges({ teams = [], metric = 'ytd' }) {
    const rows = teams
        .map((t) => {
            const target = metric === 'mtd' ? t.mtdTarget : t.ytdTarget;
            const achieved = metric === 'mtd' ? t.mtdAchieved : t.ytdAchieved;
            const pct = target ? (achieved / target) * 100 : 0;
            return { name: t.teamName, achieved, target, pct, empty: !target && !achieved };
        })
        .sort((a, b) => Number(a.empty) - Number(b.empty) || b.pct - a.pct);

    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' }, gap: 1.5 }}>
            {rows.map((t, i) => {
                const color = t.pct >= 100 ? (i === 0 ? '#2E9E4B' : '#1F7A35') : '#C77F1A';
                return (
                    <Box key={t.name} sx={{
                        border: '1px solid var(--d-border-soft, #ECE9E2)', borderRadius: '14px', p: 1.5, textAlign: 'center',
                        bgcolor: t.empty ? 'var(--d-surface-muted, #F6F5F1)' : 'var(--d-surface, #fff)', opacity: t.empty ? 0.7 : 1,
                    }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--d-text-muted, #8A887E)', fontWeight: 700, px: 0.25 }}>
                            <span>#{i + 1}</span>
                            {i === 0 && !t.empty ? <StarIcon sx={{ fontSize: 15, color: '#2E9E4B' }} /> : <span />}
                        </Box>
                        <GaugeArc pct={t.pct} color={color} empty={t.empty} />
                        <Typography sx={{ fontSize: 20, fontWeight: 800, color: t.empty ? 'var(--d-text-faint, #B6B3A8)' : color, lineHeight: 1, mt: -0.5 }}>
                            {t.empty ? '—' : `${t.pct.toFixed(1)}%`}
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, mt: 0.5, color: 'var(--d-text, #191918)' }}>{t.name}</Typography>
                        <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted, #8A887E)' }}>{t.empty ? '—' : aedK(t.achieved)}</Typography>
                    </Box>
                );
            })}
        </Box>
    );
}
