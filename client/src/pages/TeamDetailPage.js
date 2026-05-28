import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Chip,
    Stack,
    TextField,
    Snackbar,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import SyncIcon from '@mui/icons-material/Sync';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import AdminSidebar from '../components/AdminSidebar';
import Sidebar from '../components/Sidebar';
import DashboardShell from '../components/dashboard/DashboardShell';
import DashboardHero from '../components/dashboard/DashboardHero';
import ComingSoonLock from '../components/ComingSoonLock';
import EChart from '../components/charts/EChart';
import { donutOption, lineOption } from '../components/charts/presets';
import useRealtimeRefresh from '../hooks/useRealtimeRefresh';
import { getTeamDetail, getTeams } from '../services/execOverviewService';
import { listEntries, upsertEntry, bulkUpsertEntries } from '../services/teamEntryService';
import consultantService from '../services/consultantService';

// Display + formatting helpers ----------------------------------------------

const fmtCurrency = (n) => {
    if (n == null) return '—';
    return new Intl.NumberFormat('en-AE', {
        style: 'currency', currency: 'AED', maximumFractionDigits: 0,
    }).format(n);
};
const fmtPct = (n) => (n == null || Number.isNaN(n) ? '0.0%' : `${(n * 100).toFixed(1)}%`);

const yearOptions = () => {
    const now = new Date().getUTCFullYear();
    const out = [];
    for (let y = now + 1; y >= 2023; y--) out.push(y);
    return out;
};

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// Editable numeric cell. Local state so keystrokes don't re-render the
// rest of the grid; commits via `onCommit(fieldSlug, number)` when the
// user blurs the field or presses Enter.
const NumCell = React.memo(function NumCell({ value, onCommit, fieldSlug, isCurrency }) {
    const [local, setLocal] = useState(value === 0 ? '' : String(value ?? ''));
    const inputRef = useRef(null);
    useEffect(() => {
        // External value changed (e.g. via paste). Don't clobber while user
        // is mid-edit.
        if (document.activeElement !== inputRef.current) {
            setLocal(value === 0 ? '' : String(value ?? ''));
        }
    }, [value]);

    const commit = useCallback(() => {
        const n = local === '' ? 0 : Number(local);
        if (!Number.isFinite(n) || n < 0) {
            // revert visual to last good value
            setLocal(value === 0 ? '' : String(value ?? ''));
            return;
        }
        if (n !== (value ?? 0)) onCommit(fieldSlug, n);
    }, [local, value, fieldSlug, onCommit]);

    return (
        <TextField
            inputRef={inputRef}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                    inputRef.current?.blur();
                }
            }}
            size="small"
            type="number"
            inputProps={{
                min: 0,
                style: {
                    textAlign: 'right',
                    fontSize: isCurrency ? 12 : 13,
                    padding: '4px 6px',
                    width: isCurrency ? 90 : 50,
                },
            }}
            sx={{
                '& .MuiOutlinedInput-root': {
                    borderRadius: '4px',
                    backgroundColor: 'transparent',
                },
                '& fieldset': { border: 'none' },
                '&:hover .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(35,131,226,0.04)',
                },
                '& .MuiOutlinedInput-root.Mui-focused': {
                    backgroundColor: 'rgba(35,131,226,0.08)',
                    boxShadow: 'inset 0 0 0 1px var(--d-accent, #2383E2)',
                },
            }}
        />
    );
});

// Single editable row for one consultant × month. Owns the optimistic
// state for its fields so typing doesn't cause a full grid re-render.
const EntryRow = React.memo(function EntryRow({
    consultant,
    month,
    year,
    teamLeadId,
    initial,
    bucketSlugs,
    buckets,
    agiBuckets,
    onPersisted,
    onPaste,
    canEdit,
}) {
    const [row, setRow] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState(null);
    const saveTimerRef = useRef(null);

    // Re-sync when initial changes (e.g. after a bulk paste).
    useEffect(() => { setRow(initial); }, [initial]);

    const programSlugs = buckets.filter((b) => !agiBuckets.includes(b)).map((b) => bucketSlugs[b]);

    const totalAdmissions = programSlugs.reduce((acc, slug) => acc + (row[slug] || 0), 0);
    const percentRevenue =
        row.monthlyTarget > 0 ? (row.achievedRevenue || 0) / row.monthlyTarget : 0;

    const persistRow = useCallback(async (next) => {
        setSaving(true);
        try {
            await upsertEntry({
                consultant: consultant._id,
                teamLead: teamLeadId,
                year,
                month,
                ...next,
            });
            setSavedAt(Date.now());
            onPersisted?.();
        } catch (err) {
            // surface via parent
            onPersisted?.(err);
        } finally {
            setSaving(false);
        }
    }, [consultant._id, teamLeadId, year, month, onPersisted]);

    const handleCommit = useCallback((field, num) => {
        if (!canEdit) return;
        setRow((prev) => {
            const next = { ...prev, [field]: num };
            // Debounce persistence so rapid tabbing through cells fires
            // one save instead of many.
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => persistRow(next), 250);
            return next;
        });
    }, [canEdit, persistRow]);

    // Excel paste handler — let the parent component reassemble the
    // matrix; this row only triggers it.
    const handlePaste = useCallback((e, fieldSlug) => {
        if (!canEdit) return;
        const text = e.clipboardData?.getData('text/plain');
        if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
        e.preventDefault();
        onPaste?.({ consultantId: consultant._id, month, startSlug: fieldSlug, text });
    }, [canEdit, consultant._id, month, onPaste]);

    const cellSx = { p: 0.4 };

    return (
        <TableRow hover sx={consultant.isActive === false ? { opacity: 0.7 } : null}>
            <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'var(--d-surface, #FFFFFF)', fontWeight: 600, zIndex: 1 }}>
                {consultant.name}
                {consultant.isActive === false ? (
                    <Chip label="inactive" size="small" sx={{ ml: 0.75, height: 16, fontSize: 9 }} variant="outlined" />
                ) : null}
                {saving ? (
                    <SyncIcon sx={{ ml: 0.5, fontSize: 14, color: 'var(--d-text-muted)', verticalAlign: 'middle' }} />
                ) : savedAt && Date.now() - savedAt < 2000 ? (
                    <CheckCircleIcon sx={{ ml: 0.5, fontSize: 14, color: '#1F7A35', verticalAlign: 'middle' }} />
                ) : null}
            </TableCell>
            <TableCell align="right" sx={cellSx} onPasteCapture={(e) => handlePaste(e, 'monthlyTarget')}>
                <NumCell value={row.monthlyTarget} onCommit={handleCommit} fieldSlug="monthlyTarget" isCurrency />
            </TableCell>
            <TableCell align="right" sx={cellSx} onPasteCapture={(e) => handlePaste(e, 'achievedRevenue')}>
                <NumCell value={row.achievedRevenue} onCommit={handleCommit} fieldSlug="achievedRevenue" isCurrency />
            </TableCell>
            <TableCell align="right" sx={{ ...cellSx, color: percentRevenue >= 0.8 ? '#1F7A35' : '#A35A06', fontWeight: 600 }}>
                {fmtPct(percentRevenue)}
            </TableCell>
            <TableCell align="right" sx={cellSx}>
                {totalAdmissions || '—'}
            </TableCell>
            {buckets.map((b) => {
                const slug = bucketSlugs[b];
                const isAgi = agiBuckets.includes(b);
                return (
                    <TableCell
                        key={b}
                        align="right"
                        sx={{ ...cellSx, bgcolor: isAgi ? 'rgba(217,119,6,0.04)' : undefined }}
                        onPasteCapture={(e) => handlePaste(e, slug)}
                    >
                        <NumCell value={row[slug]} onCommit={handleCommit} fieldSlug={slug} />
                    </TableCell>
                );
            })}
        </TableRow>
    );
});

// Read-only summary tables below the editable month blocks: Member Wise
// Monthly Revenue (Month × member) and Consolidated Admissions (Program ×
// month), plus two ECharts. All derived server-side in getTeamDetail.
const TeamSummaryTables = ({ data }) => {
    const months = data.monthNames ? data.monthNames.map((m) => m.slice(0, 3)) : MONTH_NAMES.map((m) => m.slice(0, 3));
    const mw = data.memberWiseRevenue;
    const ca = data.consolidatedAdmissions;

    return (
        <Box sx={{ mt: 2 }}>
            {/* Charts */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 7 }}>
                    <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, color: 'var(--d-text-2)' }}>
                            Member Revenue Trend
                        </Typography>
                        <EChart
                            height={300}
                            option={lineOption({
                                categories: months,
                                // Tooltip-only (no paginated legend); null out zero
                                // months so partial-year lines don't crash to 0.
                                showLegend: false,
                                series: mw.members
                                    .filter((m) => m.ytdAchieved > 0)
                                    .map((m) => ({ name: m.consultantName, data: m.monthly.map((v) => (v > 0 ? v : null)) })),
                            })}
                        />
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 5 }}>
                    <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, color: 'var(--d-text-2)' }}>
                            Program Mix (admissions)
                        </Typography>
                        <EChart
                            height={300}
                            option={donutOption({
                                data: ca.rows.filter((r) => !r.isAgi && r.total > 0).map((r) => ({ name: r.program, value: r.total })),
                                radius: ['50%', '72%'],
                                centerText: String(ca.totalAdmissions.total),
                            })}
                        />
                    </Paper>
                </Grid>
            </Grid>

            {/* Member Wise Monthly Revenue */}
            <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden', mb: 3 }}>
                <Box sx={{ px: 2.5, py: 1.5, bgcolor: 'var(--d-surface-muted, #F1EFEA)', borderBottom: '1px solid var(--d-border-soft, #ECE9E2)' }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Member Wise Monthly Revenue</Typography>
                </Box>
                <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'var(--d-surface, #FFFFFF)' }}>
                                <TableCell sx={{ fontWeight: 700, position: 'sticky', left: 0, bgcolor: 'var(--d-surface, #FFFFFF)', zIndex: 1 }}>Member</TableCell>
                                {months.map((m) => (
                                    <TableCell key={m} align="right" sx={{ fontWeight: 700 }}>{m}</TableCell>
                                ))}
                                <TableCell align="right" sx={{ fontWeight: 700 }}>YTD Ach.</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>YTD Tgt</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>YTD %</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {mw.members.map((m) => (
                                <TableRow key={m.consultantName} hover>
                                    <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'var(--d-surface, #FFFFFF)', fontWeight: 600 }}>{m.consultantName}</TableCell>
                                    {m.monthly.map((v, i) => (
                                        <TableCell key={i} align="right">{v ? fmtCurrency(v) : '—'}</TableCell>
                                    ))}
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCurrency(m.ytdAchieved)}</TableCell>
                                    <TableCell align="right">{fmtCurrency(m.ytdTarget)}</TableCell>
                                    <TableCell align="right" sx={{ color: m.ytdPercent >= 0.8 ? '#1F7A35' : '#A35A06', fontWeight: 600 }}>{fmtPct(m.ytdPercent)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Consolidated Admissions — Program Wise */}
            <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden' }}>
                <Box sx={{ px: 2.5, py: 1.5, bgcolor: 'var(--d-surface-muted, #F1EFEA)', borderBottom: '1px solid var(--d-border-soft, #ECE9E2)' }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Consolidated Admissions — Program Wise</Typography>
                </Box>
                <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'var(--d-surface, #FFFFFF)' }}>
                                <TableCell sx={{ fontWeight: 700, position: 'sticky', left: 0, bgcolor: 'var(--d-surface, #FFFFFF)', zIndex: 1 }}>Program</TableCell>
                                {months.map((m) => (
                                    <TableCell key={m} align="right" sx={{ fontWeight: 700 }}>{m}</TableCell>
                                ))}
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {ca.rows.map((r) => (
                                <TableRow key={r.program} hover sx={r.isAgi ? { bgcolor: 'rgba(217,119,6,0.05)' } : null}>
                                    <TableCell sx={{ position: 'sticky', left: 0, bgcolor: r.isAgi ? '#FDF5E6' : 'var(--d-surface, #FFFFFF)', fontWeight: 600 }}>
                                        {r.program}{r.isAgi ? ' (excl.)' : ''}
                                    </TableCell>
                                    {r.monthly.map((v, i) => (
                                        <TableCell key={i} align="right">{v || '—'}</TableCell>
                                    ))}
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{r.total || '—'}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow sx={{ bgcolor: 'rgba(35,131,226,0.06)' }}>
                                <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'rgba(35,131,226,0.12)', fontWeight: 700, zIndex: 1 }}>Total Admissions</TableCell>
                                {ca.totalAdmissions.monthly.map((v, i) => (
                                    <TableCell key={i} align="right" sx={{ fontWeight: 700 }}>{v || '—'}</TableCell>
                                ))}
                                <TableCell align="right" sx={{ fontWeight: 700 }}>{ca.totalAdmissions.total || '—'}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

const TeamDetailPage = () => {
    const navigate = useNavigate();
    const { teamLeadId: paramId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, logout } = useAuth();
    const themeState = useDashboardThemeState('dashboard-theme-mode');

    const [year, setYear] = useState(Number(searchParams.get('year')) || new Date().getUTCFullYear());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [teams, setTeams] = useState([]);
    const [consultants, setConsultants] = useState([]);
    const [entriesById, setEntriesById] = useState({}); // key = `${consultantId}:${month}` -> entry
    const [toast, setToast] = useState(null);
    // One month is shown at a time, chosen from a dropdown (defaults to
    // January). Keeps the editable grid light (one month's inputs instead
    // of all 12) and matches the requested UX.
    const [selectedMonth, setSelectedMonth] = useState(1);

    const effectiveTeamId = user?.role === 'team_lead' ? user?._id || user?.id : paramId;
    // Writes are admin-only at the server. TLs see a Coming Soon lock
    // while the feature is being finalised for them.
    const isTeamLead = user?.role === 'team_lead';
    const canEdit = user?.role === 'admin';

    useEffect(() => {
        if (user?.role === 'admin') {
            getTeams().then((res) => setTeams(res.data || [])).catch(() => {});
        }
    }, [user?.role]);

    const refetch = useCallback(async () => {
        if (!effectiveTeamId || isTeamLead) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const [detailRes, consRes, entRes] = await Promise.all([
                getTeamDetail(effectiveTeamId, year),
                consultantService.getConsultants({ organization: 'luc' }),
                listEntries({ year, teamLeadId: effectiveTeamId }),
            ]);
            setData(detailRes.data);
            // /api/consultants populates teamLead as { _id, name, email }, so
            // pull the id off the object (fall back to raw ObjectId for safety).
            const teamConsultants = (consRes.data || [])
                .filter((c) => {
                    const tlId = c.teamLead?._id || c.teamLead;
                    return String(tlId) === String(effectiveTeamId);
                })
                .sort((a, b) => a.name.localeCompare(b.name));
            setConsultants(teamConsultants);
            const idx = {};
            for (const e of entRes.data || []) {
                idx[`${e.consultant}:${e.month}`] = e;
            }
            setEntriesById(idx);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load team detail');
        } finally {
            setLoading(false);
        }
    }, [effectiveTeamId, year, isTeamLead]);

    useEffect(() => { refetch(); }, [refetch]);

    // Live updates from other sessions (admin edits, added consultants).
    useRealtimeRefresh(
        ['teamEntry:upserted', 'teamEntry:bulk', 'teamEntry:deleted', 'consultant:created', 'consultant:updated', 'consultant:deactivated'],
        refetch,
        { year }
    );

    // Debounced refetch handle — multiple rapid saves (tabbing through
    // cells) collapse into one detail re-fetch instead of N.
    const refetchTimerRef = useRef(null);
    const handlePersisted = useCallback((err) => {
        if (err) {
            setToast({ severity: 'error', message: err.response?.data?.message || err.message });
            return;
        }
        if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = setTimeout(() => {
            getTeamDetail(effectiveTeamId, year)
                .then((res) => setData(res.data))
                .catch(() => {});
        }, 600);
    }, [effectiveTeamId, year]);

    // Bulk paste: parse a TSV block and bulk-upsert the resulting rows.
    // Currently only supports horizontal paste (multiple columns of the
    // same row — matches the most common Excel copy pattern).
    const handlePaste = useCallback(async ({ consultantId, month, startSlug, text }) => {
        if (!data) return;
        const allSlugs = ['monthlyTarget', 'achievedRevenue', ...data.programBuckets.map((b) => data.bucketSlugs[b]), ...data.agiBuckets.map((b) => data.bucketSlugs[b])];
        const startIdx = allSlugs.indexOf(startSlug);
        if (startIdx < 0) return;

        const linesRaw = text.replace(/\r/g, '').split('\n').filter((l) => l.length);
        const startConsultantIdx = consultants.findIndex((c) => String(c._id) === String(consultantId));
        if (startConsultantIdx < 0) return;

        const rows = [];
        linesRaw.forEach((line, rOff) => {
            const targetConsultant = consultants[startConsultantIdx + rOff];
            if (!targetConsultant) return;
            const cells = line.split('\t');
            const update = {
                consultant: targetConsultant._id,
                teamLead: effectiveTeamId,
                year,
                month,
            };
            let any = false;
            cells.forEach((raw, cOff) => {
                const slug = allSlugs[startIdx + cOff];
                if (!slug) return;
                const cleaned = raw.replace(/[^0-9.-]/g, '');
                if (cleaned === '') return;
                const n = Number(cleaned);
                if (Number.isFinite(n) && n >= 0) {
                    update[slug] = n;
                    any = true;
                }
            });
            if (any) rows.push(update);
        });

        if (rows.length === 0) return;
        try {
            const res = await bulkUpsertEntries(rows);
            const errs = res.data?.errors || [];
            setToast({
                severity: errs.length ? 'warning' : 'success',
                message: errs.length
                    ? `Pasted ${res.data?.upserted || 0}, ${errs.length} errors`
                    : `Pasted ${res.data?.upserted || 0} cells`,
            });
            // refresh entries + aggregate
            refetch();
        } catch (err) {
            setToast({ severity: 'error', message: err.response?.data?.message || err.message });
        }
    }, [data, consultants, effectiveTeamId, year, refetch]);

    const handleLogout = () => { logout(); navigate('/login'); };

    const sidebar = user?.role === 'admin' ? (
        <AdminSidebar
            onLogout={handleLogout}
            onDashboard={() => navigate('/admin/dashboard')}
            onAIAnalysis={() => navigate('/admin/dashboard?section=ai')}
            onAPICosts={() => navigate('/admin/dashboard?section=ai-usage')}
        />
    ) : (
        <Sidebar onLogout={handleLogout} onDashboard={() => navigate('/team-lead/dashboard')} />
    );

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <DashboardHero
                eyebrow={data ? data.teamLead.teamName : 'Team Dashboard'}
                title={data ? `${data.teamLead.teamName} · ${year}` : 'Loading…'}
                subtitle={
                    data
                        ? `Led by ${data.teamLead.name} · Edit cells directly · TEAM TOTAL, % Rev, Adm. and YTD auto-compute`
                        : ''
                }
                right={
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        {user?.role === 'admin' && teams.length ? (
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                                <InputLabel>Team</InputLabel>
                                <Select
                                    value={paramId || ''}
                                    label="Team"
                                    onChange={(e) => navigate(`/team-dashboard/${e.target.value}?year=${year}`)}
                                >
                                    {teams.map((t) => (
                                        <MenuItem key={t._id} value={t._id}>
                                            {t.teamName || `Team ${t.name}`}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : null}
                        <FormControl size="small" sx={{ minWidth: 130 }}>
                            <InputLabel>Month</InputLabel>
                            <Select
                                value={selectedMonth}
                                label="Month"
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            >
                                {MONTH_NAMES.map((m, i) => (
                                    <MenuItem key={m} value={i + 1}>{m}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 110 }}>
                            <InputLabel>Year</InputLabel>
                            <Select
                                value={year}
                                label="Year"
                                onChange={(e) => {
                                    const y = Number(e.target.value);
                                    setYear(y);
                                    const next = new URLSearchParams(searchParams);
                                    next.set('year', String(y));
                                    setSearchParams(next, { replace: true });
                                }}
                            >
                                {yearOptions().map((y) => (
                                    <MenuItem key={y} value={y}>{y}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                }
            />

            {isTeamLead ? (
                <ComingSoonLock
                    title="Team Dashboard"
                    subtitle="An Excel-style team sheet with 12 monthly blocks, member-level targets, and per-program admissions. Coming soon for team leads."
                />
            ) : loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
            ) : data ? (
                <Box sx={{ pb: 6 }}>
                    {/* YTD strip */}
                    <Grid container spacing={2} sx={{ mt: 1, mb: 3 }}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
                                <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>YTD Target</Typography>
                                <Typography sx={{ fontSize: 22, fontWeight: 700 }}>{fmtCurrency(data.ytd.target)}</Typography>
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
                                <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>YTD Achieved</Typography>
                                <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#1F7A35' }}>{fmtCurrency(data.ytd.achieved)}</Typography>
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
                                <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>YTD %</Typography>
                                <Typography sx={{ fontSize: 22, fontWeight: 700, color: data.ytd.percent >= 0.8 ? '#1F7A35' : '#A35A06' }}>{fmtPct(data.ytd.percent)}</Typography>
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
                                <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>YTD Remaining</Typography>
                                <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#A35A06' }}>{fmtCurrency(data.ytd.remaining)}</Typography>
                            </Paper>
                        </Grid>
                    </Grid>

                    {!canEdit ? (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            You're viewing another team — cells are read-only.
                        </Alert>
                    ) : (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Tip: click any cell to edit. Tab/Enter saves. Paste a block from Excel into any cell to fill the rest.
                        </Alert>
                    )}

                    {(() => {
                        const blockIdx = selectedMonth - 1;
                        const block = data.months[blockIdx];
                        const monthNum = selectedMonth;
                        if (!block) return null;
                        return (
                            <Paper key={monthNum} variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden', mb: 3 }}>
                                <Box
                                    sx={{
                                        px: 2.5, py: 1.5,
                                        bgcolor: 'var(--d-surface-muted, #F1EFEA)',
                                        borderBottom: '1px solid var(--d-border-soft, #ECE9E2)',
                                        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
                                    }}
                                >
                                    <Typography sx={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                                        {MONTH_NAMES[blockIdx]}
                                    </Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                        <Chip label={`Target: ${fmtCurrency(block.teamTotal.monthlyTarget)}`} size="small" sx={{ fontWeight: 600 }} />
                                        <Chip label={`Achieved: ${fmtCurrency(block.teamTotal.achievedRevenue)}`} size="small" color="success" variant="outlined" />
                                        <Chip label={fmtPct(block.teamTotal.percentRevenue)} size="small" color={block.teamTotal.percentRevenue >= 0.8 ? 'success' : 'warning'} />
                                        <Chip label={`${block.teamTotal.totalAdmissions} admissions`} size="small" variant="outlined" />
                                    </Stack>
                                </Box>
                                <TableContainer sx={{ overflowX: 'auto' }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'var(--d-surface, #FFFFFF)' }}>
                                                <TableCell sx={{ fontWeight: 700, position: 'sticky', left: 0, bgcolor: 'var(--d-surface, #FFFFFF)', zIndex: 2, minWidth: 170 }}>Member</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700 }}>Monthly Target</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700 }}>Achieved</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700 }}>% Rev</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700 }}>Adm.</TableCell>
                                                {data.buckets.map((b) => (
                                                    <TableCell key={b} align="right" sx={{ fontWeight: 700, fontSize: 11, bgcolor: data.agiBuckets.includes(b) ? 'rgba(217,119,6,0.06)' : undefined }}>
                                                        {b}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {consultants.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5 + data.buckets.length} sx={{ textAlign: 'center', py: 4, color: 'var(--d-text-muted)' }}>
                                                        No consultants in this team yet.
                                                    </TableCell>
                                                </TableRow>
                                            ) : consultants.map((c) => {
                                                const key = `${c._id}:${monthNum}`;
                                                const entry = entriesById[key] || {};
                                                const initial = {
                                                    monthlyTarget: entry.monthlyTarget || 0,
                                                    achievedRevenue: entry.achievedRevenue || 0,
                                                    ...Object.fromEntries(
                                                        Object.values(data.bucketSlugs).map((slug) => [slug, entry[slug] || 0])
                                                    ),
                                                };
                                                return (
                                                    <EntryRow
                                                        key={key}
                                                        consultant={c}
                                                        month={monthNum}
                                                        year={year}
                                                        teamLeadId={effectiveTeamId}
                                                        initial={initial}
                                                        bucketSlugs={data.bucketSlugs}
                                                        buckets={data.buckets}
                                                        agiBuckets={data.agiBuckets}
                                                        onPersisted={handlePersisted}
                                                        onPaste={handlePaste}
                                                        canEdit={canEdit}
                                                    />
                                                );
                                            })}
                                            <TableRow sx={{ bgcolor: 'rgba(35,131,226,0.06)' }}>
                                                <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'rgba(35,131,226,0.12)', fontWeight: 700, zIndex: 1 }}>TEAM TOTAL</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCurrency(block.teamTotal.monthlyTarget)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCurrency(block.teamTotal.achievedRevenue)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtPct(block.teamTotal.percentRevenue)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700 }}>{block.teamTotal.totalAdmissions || '—'}</TableCell>
                                                {data.buckets.map((b) => (
                                                    <TableCell key={b} align="right" sx={{ fontWeight: 700, bgcolor: data.agiBuckets.includes(b) ? 'rgba(217,119,6,0.08)' : undefined }}>
                                                        {block.teamTotal.buckets[b] || '—'}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        );
                    })()}

                    {/* Member Wise Monthly Revenue + Consolidated Admissions */}
                    {data.memberWiseRevenue && data.consolidatedAdmissions ? (
                        <TeamSummaryTables data={data} />
                    ) : null}
                </Box>
            ) : null}

            <Snackbar
                open={!!toast}
                autoHideDuration={3500}
                onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity={toast?.severity || 'info'} onClose={() => setToast(null)}>
                    {toast?.message}
                </Alert>
            </Snackbar>
        </DashboardShell>
    );
};

export default TeamDetailPage;
