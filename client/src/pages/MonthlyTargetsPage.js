import React, { useEffect, useMemo, useState } from 'react';
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
    Stack,
    Button,
    TextField,
    Snackbar,
    Tooltip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import AdminSidebar from '../components/AdminSidebar';
import Sidebar from '../components/Sidebar';
import DashboardShell from '../components/dashboard/DashboardShell';
import DashboardHero from '../components/dashboard/DashboardHero';
import consultantService from '../services/consultantService';
import { listEntries, bulkUpsertEntries } from '../services/teamEntryService';
import { getTeams } from '../services/execOverviewService';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtCurrency = (n) => new Intl.NumberFormat('en-AE', {
    style: 'currency', currency: 'AED', maximumFractionDigits: 0,
}).format(n || 0);

const yearOptions = () => {
    const now = new Date().getUTCFullYear();
    const out = [];
    for (let y = now + 1; y >= 2023; y--) out.push(y);
    return out;
};

const MonthlyTargetsPage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const themeState = useDashboardThemeState('dashboard-theme-mode');

    const [year, setYear] = useState(new Date().getUTCFullYear());
    const [teams, setTeams] = useState([]);
    const [teamLeadId, setTeamLeadId] = useState('');
    const [consultants, setConsultants] = useState([]);
    const [grid, setGrid] = useState({}); // { consultantId: { 1: amount, 2: amount, ... } }
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);

    const isAdmin = user?.role === 'admin';

    // Load teams (admin only)
    useEffect(() => {
        if (!isAdmin) {
            setTeamLeadId(user?._id || user?.id);
            return;
        }
        getTeams().then((res) => {
            setTeams(res.data || []);
            if (res.data?.length && !teamLeadId) setTeamLeadId(res.data[0]._id);
        }).catch(() => {});
    }, [isAdmin, user?._id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Load consultants + targets when team or year changes
    useEffect(() => {
        if (!teamLeadId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        Promise.all([
            consultantService.getConsultants({ organization: 'luc' }),
            listEntries({ year, teamLeadId }),
        ])
            .then(([cRes, eRes]) => {
                if (cancelled) return;
                const filtered = (cRes.data || []).filter((c) => String(c.teamLead) === String(teamLeadId));
                setConsultants(filtered);
                const g = {};
                for (const c of filtered) g[c._id] = {};
                for (const e of (eRes.data || [])) {
                    if (!g[e.consultant]) g[e.consultant] = {};
                    g[e.consultant][e.month] = e.monthlyTarget;
                }
                setGrid(g);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err.response?.data?.message || err.message || 'Failed to load targets');
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [teamLeadId, year]);

    const updateCell = (consultantId, month, raw) => {
        const num = raw === '' ? 0 : Number(raw);
        if (Number.isNaN(num) || num < 0) return;
        setGrid((prev) => ({
            ...prev,
            [consultantId]: { ...(prev[consultantId] || {}), [month]: num },
        }));
    };

    // Paste from Excel: TSV format. Pasting into first cell of a row fills
    // that row across all 12 months. Pasting into the first cell of the
    // grid fills the entire grid (rows = consultants in display order).
    const handlePaste = (e, startConsultantId, startMonth) => {
        const text = e.clipboardData?.getData('text/plain');
        if (!text || !text.includes('\t') && !text.includes('\n')) return; // not a tabular paste
        e.preventDefault();
        const rows = text.replace(/\r/g, '').split('\n').filter((r) => r.length);
        const startIdx = consultants.findIndex((c) => c._id === startConsultantId);
        if (startIdx < 0) return;

        setGrid((prev) => {
            const next = { ...prev };
            rows.forEach((row, rOffset) => {
                const targetConsultant = consultants[startIdx + rOffset];
                if (!targetConsultant) return;
                const cells = row.split('\t');
                cells.forEach((cell, cOffset) => {
                    const m = startMonth + cOffset;
                    if (m < 1 || m > 12) return;
                    const cleaned = cell.replace(/[^0-9.-]/g, '');
                    if (cleaned === '') return;
                    const v = Number(cleaned);
                    if (Number.isFinite(v) && v >= 0) {
                        next[targetConsultant._id] = { ...(next[targetConsultant._id] || {}), [m]: v };
                    }
                });
            });
            return next;
        });
        setToast({ severity: 'info', message: 'Pasted from clipboard — review and click Save All' });
    };

    const handleSave = async () => {
        if (!teamLeadId) return;
        setSaving(true);
        const rows = [];
        for (const c of consultants) {
            const cellRow = grid[c._id] || {};
            for (let m = 1; m <= 12; m++) {
                const amount = cellRow[m];
                if (amount == null) continue;
                rows.push({
                    consultant: c._id,
                    teamLead: teamLeadId,
                    year,
                    month: m,
                    monthlyTarget: amount,
                });
            }
        }
        try {
            const res = await bulkUpsertEntries(rows);
            const errs = res.data?.errors || [];
            setToast({
                severity: errs.length ? 'warning' : 'success',
                message: errs.length
                    ? `Saved ${res.data?.upserted || 0}, ${errs.length} errors`
                    : `Saved ${res.data?.upserted || 0} targets`,
            });
        } catch (err) {
            setToast({ severity: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => { logout(); navigate('/login'); };

    const sidebar = isAdmin ? (
        <AdminSidebar
            onLogout={handleLogout}
            onDashboard={() => navigate('/admin/dashboard')}
            onAIAnalysis={() => navigate('/admin/dashboard?section=ai')}
            onAPICosts={() => navigate('/admin/dashboard?section=ai-usage')}
        />
    ) : (
        <Sidebar onLogout={handleLogout} onDashboard={() => navigate('/team-lead/dashboard')} />
    );

    const rowTotal = (cid) => MONTHS.reduce((acc, _, i) => acc + ((grid[cid] || {})[i + 1] || 0), 0);
    const colTotal = (m) => consultants.reduce((acc, c) => acc + ((grid[c._id] || {})[m] || 0), 0);
    const grand = useMemo(() => consultants.reduce((acc, c) => acc + rowTotal(c._id), 0), [consultants, grid]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <DashboardHero
                eyebrow="Admin"
                title="Monthly Targets"
                subtitle="Set per-consultant monthly revenue targets · Paste from Excel supported · Saved targets drive the Executive Overview"
                right={
                    <Stack direction="row" spacing={1.5}>
                        {isAdmin && teams.length ? (
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                                <InputLabel>Team</InputLabel>
                                <Select value={teamLeadId} label="Team" onChange={(e) => setTeamLeadId(e.target.value)}>
                                    {teams.map((t) => (
                                        <MenuItem key={t._id} value={t._id}>
                                            {t.teamName || `Team ${t.name}`}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : null}
                        <FormControl size="small" sx={{ minWidth: 110 }}>
                            <InputLabel>Year</InputLabel>
                            <Select value={year} label="Year" onChange={(e) => setYear(Number(e.target.value))}>
                                {yearOptions().map((y) => (
                                    <MenuItem key={y} value={y}>{y}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button variant="contained" disabled={saving || loading} onClick={handleSave}>
                            {saving ? 'Saving…' : 'Save All'}
                        </Button>
                    </Stack>
                }
            />

            <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
                Tip: copy a block of cells from Excel and paste into any cell here — the rest fill automatically. Save to persist.
            </Alert>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : (
                <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden' }}>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: 'var(--d-surface-muted, #F1EFEA)' }}>
                                    <TableCell sx={{ fontWeight: 700, position: 'sticky', left: 0, bgcolor: 'var(--d-surface-muted, #F1EFEA)', zIndex: 1, minWidth: 180 }}>
                                        Consultant
                                    </TableCell>
                                    {MONTHS.map((m) => (
                                        <TableCell key={m} align="right" sx={{ fontWeight: 700, minWidth: 100 }}>{m}</TableCell>
                                    ))}
                                    <TableCell align="right" sx={{ fontWeight: 700, minWidth: 120 }}>Year Total</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {consultants.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={14} sx={{ textAlign: 'center', py: 4, color: 'var(--d-text-muted, #8A887E)' }}>
                                            No consultants found for this team.
                                        </TableCell>
                                    </TableRow>
                                ) : consultants.map((c) => (
                                    <TableRow key={c._id} hover>
                                        <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'var(--d-surface, #FFFFFF)', fontWeight: 600 }}>
                                            {c.name}
                                        </TableCell>
                                        {MONTHS.map((m, i) => (
                                            <TableCell key={m} align="right" sx={{ p: 0.5 }}>
                                                <TextField
                                                    value={(grid[c._id] || {})[i + 1] ?? ''}
                                                    onChange={(e) => updateCell(c._id, i + 1, e.target.value)}
                                                    onPaste={(e) => handlePaste(e, c._id, i + 1)}
                                                    size="small"
                                                    type="number"
                                                    inputProps={{ min: 0, style: { textAlign: 'right', fontSize: 13 } }}
                                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
                                                />
                                            </TableCell>
                                        ))}
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                                            <Tooltip title={fmtCurrency(rowTotal(c._id))}>
                                                <span>{fmtCurrency(rowTotal(c._id))}</span>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {consultants.length > 0 ? (
                                    <TableRow sx={{ bgcolor: 'rgba(35,131,226,0.06)' }}>
                                        <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'rgba(35,131,226,0.12)', fontWeight: 700 }}>TOTAL</TableCell>
                                        {MONTHS.map((m, i) => (
                                            <TableCell key={m} align="right" sx={{ fontWeight: 700 }}>{fmtCurrency(colTotal(i + 1))}</TableCell>
                                        ))}
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCurrency(grand)}</TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            <Snackbar
                open={!!toast}
                autoHideDuration={4000}
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

export default MonthlyTargetsPage;
