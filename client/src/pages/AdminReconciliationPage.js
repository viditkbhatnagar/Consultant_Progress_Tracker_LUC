import React from 'react';
import {
    Box,
    Stack,
    Typography,
    Tabs,
    Tab,
    Button,
    Chip,
    Card,
    CardContent,
    CircularProgress,
    Snackbar,
    Alert,
    Autocomplete,
    TextField,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LinkIcon from '@mui/icons-material/Link';
import RefreshIcon from '@mui/icons-material/Refresh';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import { useAuth } from '../context/AuthContext';
import DashboardShell from '../components/dashboard/DashboardShell';
import DashboardHero from '../components/dashboard/DashboardHero';
import SectionCard from '../components/dashboard/SectionCard';
import AdminSidebar from '../components/AdminSidebar';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import { API_BASE_URL } from '../utils/constants';

const fmtDate = (d) => {
    if (!d) return '—';
    try { return format(new Date(d), 'd MMM yyyy'); } catch { return '—'; }
};

const ChipRow = ({ label, value }) => (
    <Stack direction="row" spacing={1} alignItems="center">
        <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted)', minWidth: 84 }}>
            {label}
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'var(--d-text)', fontWeight: 500 }}>
            {value || '—'}
        </Typography>
    </Stack>
);

// Inline picker that pairs an orphan student (or commitment) to its
// counterpart by ObjectId. Used in two flavors per row.
const PairPicker = ({
    options,
    optionLabel,
    optionDescription,
    placeholder,
    onPair,
    disabled,
}) => {
    const [value, setValue] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const handleClick = async () => {
        if (!value || busy) return;
        setBusy(true);
        try {
            await onPair(value);
            setValue(null);
        } finally {
            setBusy(false);
        }
    };
    return (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <Autocomplete
                size="small"
                sx={{ minWidth: 320, flex: 1 }}
                options={options}
                value={value}
                onChange={(_e, v) => setValue(v)}
                getOptionLabel={optionLabel}
                renderOption={(props, opt) => (
                    <li {...props} key={opt._id}>
                        <Box>
                            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                                {optionLabel(opt)}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted)' }}>
                                {optionDescription(opt)}
                            </Typography>
                        </Box>
                    </li>
                )}
                isOptionEqualToValue={(a, b) => a?._id === b?._id}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder={placeholder}
                        size="small"
                    />
                )}
            />
            <Button
                size="small"
                variant="contained"
                startIcon={busy ? <CircularProgress size={14} /> : <LinkIcon fontSize="small" />}
                onClick={handleClick}
                disabled={!value || busy || disabled}
                sx={{ textTransform: 'none', fontWeight: 600 }}
            >
                Pair
            </Button>
        </Stack>
    );
};

const AdminReconciliationPage = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const themeState = useDashboardThemeState('reconciliation-theme-mode');

    const [tab, setTab] = React.useState('orphan-commits');
    const [counts, setCounts] = React.useState({
        orphanCommits: 0,
        orphanStudents: 0,
        manualStudents: 0,
    });
    const [loading, setLoading] = React.useState(false);
    const [orphanCommits, setOrphanCommits] = React.useState([]);
    const [orphanStudents, setOrphanStudents] = React.useState([]);
    const [manualStudents, setManualStudents] = React.useState([]);
    // Pair-pickers need linkable counterparts loaded once on demand.
    const [linkableForStudent, setLinkableForStudent] = React.useState({}); // keyed by student._id
    const [linkableForCommit, setLinkableForCommit] = React.useState({});  // keyed by commit._id
    const [toast, setToast] = React.useState(null);

    const loadAll = React.useCallback(async () => {
        setLoading(true);
        try {
            const [c, oc, os, ms] = await Promise.all([
                axios.get(`${API_BASE_URL}/reconciliation/counts`),
                axios.get(`${API_BASE_URL}/reconciliation/orphan-commitments`),
                axios.get(`${API_BASE_URL}/reconciliation/orphan-students`),
                axios.get(`${API_BASE_URL}/reconciliation/manual-students`),
            ]);
            setCounts(c.data?.data || { orphanCommits: 0, orphanStudents: 0, manualStudents: 0 });
            setOrphanCommits(oc.data?.data || []);
            setOrphanStudents(os.data?.data || []);
            setManualStudents(ms.data?.data || []);
        } catch (err) {
            setToast({ severity: 'error', message: err?.response?.data?.message || err.message });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { loadAll(); }, [loadAll]);

    // Lazy-load linkable counterparts when admin expands a row's picker.
    const loadLinkableStudentsFor = async (commit) => {
        if (linkableForCommit[commit._id]) return;
        try {
            // Server-side filter: same consultant, no commitmentId, LUC.
            const res = await axios.get(
                `${API_BASE_URL}/reconciliation/orphan-students`,
                { params: { limit: 500 } }
            );
            const consultantLower = (commit.consultantName || '').trim().toLowerCase();
            const candidates = (res.data?.data || []).filter(
                (s) => (s.consultantName || '').trim().toLowerCase() === consultantLower
            );
            setLinkableForCommit((prev) => ({ ...prev, [commit._id]: candidates }));
        } catch (err) {
            setToast({ severity: 'error', message: err?.response?.data?.message || err.message });
        }
    };

    const loadLinkableCommitsFor = async (student) => {
        if (linkableForStudent[student._id]) return;
        try {
            const res = await axios.get(
                `${API_BASE_URL}/commitments/linkable`,
                { params: { consultantName: student.consultantName, limit: 200 } }
            );
            setLinkableForStudent((prev) => ({ ...prev, [student._id]: res.data?.data || [] }));
        } catch (err) {
            setToast({ severity: 'error', message: err?.response?.data?.message || err.message });
        }
    };

    const doPair = async (studentId, commitmentId) => {
        try {
            await axios.post(`${API_BASE_URL}/reconciliation/pair`, { studentId, commitmentId });
            setToast({ severity: 'success', message: 'Paired ✓' });
            await loadAll();
            // Drop cached linkables so they refresh on next expand.
            setLinkableForCommit({});
            setLinkableForStudent({});
        } catch (err) {
            setToast({ severity: 'error', message: err?.response?.data?.message || err.message });
        }
    };

    const sidebar = (
        <AdminSidebar
            onLogout={logout}
            onAIAnalysis={() => navigate('/admin/dashboard')}
            onAPICosts={() => navigate('/admin/dashboard?section=ai-usage')}
            onDashboard={() => navigate('/admin/dashboard')}
        />
    );

    const heroRight = (
        <Stack direction="row" spacing={1} alignItems="center">
            <Button
                size="small"
                variant="text"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/admin/dashboard')}
                sx={{ color: 'var(--d-text-2)', textTransform: 'none', fontWeight: 600 }}
            >
                Dashboard
            </Button>
            <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon fontSize="small" />}
                onClick={loadAll}
                disabled={loading}
                sx={{ textTransform: 'none', fontWeight: 600 }}
            >
                Refresh
            </Button>
        </Stack>
    );

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <DashboardHero
                eyebrow="Administrator"
                title="Reconciliation"
                subtitle="Pair LUC closed commitments with their student records. Keeps the admission tracker aligned with the Student DB."
                right={heroRight}
            />

            <SectionCard padding={0} sx={{ overflow: 'hidden', minWidth: 0 }}>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    sx={{
                        px: 2,
                        borderBottom: '1px solid var(--d-border)',
                        '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 48 },
                    }}
                >
                    <Tab
                        label={`Closed commitments without student (${counts.orphanCommits})`}
                        value="orphan-commits"
                    />
                    <Tab
                        label={`Students without commitment (${counts.orphanStudents})`}
                        value="orphan-students"
                    />
                    <Tab
                        label={`Manual entries (${counts.manualStudents})`}
                        value="manual"
                    />
                </Tabs>

                <Box sx={{ p: 2.5, minWidth: 0 }}>
                    {loading && (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <CircularProgress size={16} />
                            <Typography sx={{ fontSize: 13 }}>Loading…</Typography>
                        </Stack>
                    )}

                    {tab === 'orphan-commits' && !loading && (
                        <Stack spacing={1.25}>
                            {orphanCommits.length === 0 && (
                                <Alert severity="success" variant="outlined">
                                    All closed commitments are paired with a student record. ✓
                                </Alert>
                            )}
                            {orphanCommits.map((c) => (
                                <Card key={c._id} variant="outlined">
                                    <CardContent>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                                                    {c.studentName || '(no name)'}
                                                </Typography>
                                                <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                                                    <Chip label={c.consultantName} size="small" />
                                                    <Chip label={c.teamName} size="small" variant="outlined" />
                                                    <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted)' }}>
                                                        Closed {fmtDate(c.admissionClosedDate || c.commitmentDate)}
                                                    </Typography>
                                                </Stack>
                                            </Box>
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={() => loadLinkableStudentsFor(c)}
                                                sx={{ textTransform: 'none' }}
                                            >
                                                Pair student…
                                            </Button>
                                        </Stack>
                                        {linkableForCommit[c._id] && (
                                            <PairPicker
                                                options={linkableForCommit[c._id]}
                                                optionLabel={(s) => s.studentName || '(no name)'}
                                                optionDescription={(s) =>
                                                    `${s.consultantName} · ${s.teamName} · closed ${fmtDate(s.closingDate)}`
                                                }
                                                placeholder="Pick the matching student…"
                                                onPair={(s) => doPair(s._id, c._id)}
                                            />
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </Stack>
                    )}

                    {tab === 'orphan-students' && !loading && (
                        <Stack spacing={1.25}>
                            {orphanStudents.length === 0 && (
                                <Alert severity="success" variant="outlined">
                                    Every LUC student is linked to a commitment (or flagged manual). ✓
                                </Alert>
                            )}
                            {orphanStudents.map((s) => (
                                <Card key={s._id} variant="outlined">
                                    <CardContent>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                                                    {s.studentName || '(no name)'}
                                                </Typography>
                                                <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                                                    <Chip label={s.consultantName} size="small" />
                                                    <Chip label={s.teamName} size="small" variant="outlined" />
                                                    <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted)' }}>
                                                        Closed {fmtDate(s.closingDate)}
                                                    </Typography>
                                                </Stack>
                                                <Stack direction="row" spacing={3} sx={{ mt: 0.5 }}>
                                                    <ChipRow label="Program" value={s.program} />
                                                    <ChipRow label="University" value={s.university} />
                                                </Stack>
                                            </Box>
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={() => loadLinkableCommitsFor(s)}
                                                sx={{ textTransform: 'none' }}
                                            >
                                                Pair commitment…
                                            </Button>
                                        </Stack>
                                        {linkableForStudent[s._id] && (
                                            <PairPicker
                                                options={linkableForStudent[s._id]}
                                                optionLabel={(c) => c.studentName || '(no name)'}
                                                optionDescription={(c) =>
                                                    `${c.consultantName} · ${c.teamName} · ${fmtDate(c.commitmentDate)}`
                                                }
                                                placeholder="Pick the matching commitment…"
                                                onPair={(c) => doPair(s._id, c._id)}
                                            />
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </Stack>
                    )}

                    {tab === 'manual' && !loading && (
                        <Stack spacing={1.25}>
                            {manualStudents.length === 0 && (
                                <Alert severity="info" variant="outlined">
                                    No students flagged as manual entry.
                                </Alert>
                            )}
                            {manualStudents.map((s) => (
                                <Card key={s._id} variant="outlined">
                                    <CardContent>
                                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                                            {s.studentName || '(no name)'}
                                        </Typography>
                                        <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                                            <Chip label={s.consultantName} size="small" />
                                            <Chip label={s.teamName} size="small" variant="outlined" />
                                            <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted)' }}>
                                                Closed {fmtDate(s.closingDate)}
                                            </Typography>
                                        </Stack>
                                        {s.manualEntryReason && (
                                            <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted)', mt: 1 }}>
                                                Reason: {s.manualEntryReason}
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </Stack>
                    )}
                </Box>
            </SectionCard>

            <Snackbar
                open={!!toast}
                autoHideDuration={4500}
                onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                {toast ? (
                    <Alert severity={toast.severity} onClose={() => setToast(null)} variant="filled">
                        {toast.message}
                    </Alert>
                ) : null}
            </Snackbar>
        </DashboardShell>
    );
};

export default AdminReconciliationPage;
