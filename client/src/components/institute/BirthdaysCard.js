import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Chip, Collapse, Button, CircularProgress } from '@mui/material';
import CakeIcon from '@mui/icons-material/CakeOutlined';
import instituteService from '../../services/instituteService';

const fmtDate = (iso) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

// "Today" / "Tomorrow" / "in N days" — the branch cares about how soon, not the
// raw date, so lead with that.
const whenLabel = (n) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`);

const Row = ({ b }) => {
    const soon = b.daysAway <= 1;
    return (
        <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1, py: 0.75,
            borderBottom: '1px solid var(--d-border-soft, #f1efea)',
        }}>
            <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: soon ? 800 : 600 }}>
                {b.studentName}
                {b.yearOrGrade ? (
                    <Typography component="span" sx={{ fontSize: 11, color: 'var(--d-text-muted, #8A887E)', ml: 0.75 }}>
                        {b.yearOrGrade}
                    </Typography>
                ) : null}
            </Typography>
            {b.turning ? (
                <Typography sx={{ fontSize: 11.5, color: 'var(--d-text-3, #57564E)' }}>turns {b.turning}</Typography>
            ) : null}
            <Typography sx={{ fontSize: 12, color: 'var(--d-text-3, #57564E)', minWidth: 54, textAlign: 'right' }}>
                {fmtDate(b.date)}
            </Typography>
            <Chip
                label={whenLabel(b.daysAway)}
                size="small"
                sx={{
                    minWidth: 74, height: 22, fontSize: 11, fontWeight: 700,
                    color: soon ? '#A35A06' : 'var(--d-text-3, #57564E)',
                    bgcolor: soon ? 'rgba(217,119,6,0.14)' : 'var(--d-surface-muted, #F1EFEA)',
                }}
            />
        </Box>
    );
};

// Upcoming student birthdays. The daily job posts a notification on the morning
// itself (and the day before), but between those there was nothing to see —
// this shows what's coming so the branch can plan, and makes it obvious the
// reminders are set up rather than silently broken.
const BirthdaysCard = ({ days = 45, initialVisible = 4 }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        let alive = true;
        instituteService.getUpcomingBirthdays(days)
            .then((res) => { if (alive) setRows(res.data || []); })
            .catch(() => { if (alive) setRows([]); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [days]);

    if (loading) {
        return (
            <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2, mb: 2, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={18} />
            </Paper>
        );
    }
    if (!rows.length) return null;

    const head = rows.slice(0, initialVisible);
    const rest = rows.slice(initialVisible);
    const todayCount = rows.filter((r) => r.daysAway === 0).length;

    return (
        <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CakeIcon sx={{ fontSize: 18, color: '#C99700' }} />
                <Typography sx={{ fontSize: 14, fontWeight: 800 }}>
                    {todayCount ? `Birthday${todayCount > 1 ? 's' : ''} today!` : 'Upcoming birthdays'}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: 11.5, color: 'var(--d-text-muted, #8A887E)' }}>
                    next {days} days · you'll also get a reminder on the day
                </Typography>
            </Box>
            {head.map((b) => <Row key={`${b.studentName}-${b.date}`} b={b} />)}
            <Collapse in={expanded}>
                {rest.map((b) => <Row key={`${b.studentName}-${b.date}`} b={b} />)}
            </Collapse>
            {rest.length ? (
                <Button size="small" onClick={() => setExpanded((v) => !v)} sx={{ mt: 0.5, textTransform: 'none' }}>
                    {expanded ? 'Show less' : `Show ${rest.length} more`}
                </Button>
            ) : null}
        </Paper>
    );
};

export default BirthdaysCard;
