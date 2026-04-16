import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Box,
    Typography,
    Button,
    IconButton,
    TextField,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Tooltip,
    CircularProgress,
    Alert,
    Menu,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LogoutIcon from '@mui/icons-material/Logout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import hourlyService from '../services/hourlyService';
import AdminOrgTabs from '../components/AdminOrgTabs';
import {
    getSlotsForOrg,
    getActivitiesForOrg,
    getLunchGapForOrg,
    resolveViewOrg,
} from '../utils/hourlyConfig';
import { useAdminOrgScope } from '../utils/adminOrgScope';
import { ORGANIZATION_LABELS } from '../utils/constants';

// Helpers (same semantics as LUC page)
const formatDateStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isTodayDate = (d) => {
    const t = new Date();
    return (
        d.getFullYear() === t.getFullYear() &&
        d.getMonth() === t.getMonth() &&
        d.getDate() === t.getDate()
    );
};

const DURATIONS = [
    { v: 30, lbl: '30 min' },
    { v: 60, lbl: '1 hr' },
    { v: 90, lbl: '1.5 hr' },
    { v: 120, lbl: '2 hr' },
    { v: 150, lbl: '2.5 hr' },
    { v: 180, lbl: '3 hr' },
];

// Minimal markdown renderer for AI analysis / leaderboard output.
// Supports: ## h2, ### h3, - / * bullets, **bold**, *italic*, blank-line spacing.
// Keeps the output consistent with the LUC AISummaryCard visual language.
const inlineMd = (text) =>
    text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|\s)\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>');

const MarkdownBlock = ({ text }) => {
    if (!text) return null;
    const lines = text.split('\n');
    const out = [];
    let key = 0;
    let bulletBuf = null;
    const flushBullets = () => {
        if (bulletBuf && bulletBuf.length) {
            out.push(
                <Box key={key++} component="ul" sx={{ pl: 3, my: 0.5 }}>
                    {bulletBuf.map((item, i) => (
                        <Box
                            key={i}
                            component="li"
                            sx={{ fontSize: 14, lineHeight: 1.7, color: '#1e293b', mb: 0.3 }}
                            dangerouslySetInnerHTML={{ __html: inlineMd(item) }}
                        />
                    ))}
                </Box>
            );
        }
        bulletBuf = null;
    };
    for (const raw of lines) {
        const line = raw.trimEnd();
        if (line.startsWith('## ')) {
            flushBullets();
            out.push(
                <Typography
                    key={key++}
                    variant="h6"
                    sx={{
                        fontWeight: 700,
                        mt: 2,
                        mb: 1,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0',
                        pb: 0.5,
                    }}
                >
                    {line.slice(3)}
                </Typography>
            );
        } else if (line.startsWith('### ')) {
            flushBullets();
            out.push(
                <Typography
                    key={key++}
                    variant="subtitle1"
                    sx={{ fontWeight: 700, mt: 1.5, mb: 0.5, color: '#334155' }}
                    dangerouslySetInnerHTML={{ __html: inlineMd(line.slice(4)) }}
                />
            );
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            if (!bulletBuf) bulletBuf = [];
            bulletBuf.push(line.replace(/^[-*]\s/, ''));
        } else if (/^\d+\.\s/.test(line)) {
            flushBullets();
            out.push(
                <Typography
                    key={key++}
                    sx={{ fontSize: 14, lineHeight: 1.7, color: '#1e293b', mb: 0.3, pl: 1 }}
                    dangerouslySetInnerHTML={{ __html: inlineMd(line) }}
                />
            );
        } else if (line.trim() === '') {
            flushBullets();
            out.push(<Box key={key++} sx={{ height: 6 }} />);
        } else {
            flushBullets();
            out.push(
                <Typography
                    key={key++}
                    sx={{ fontSize: 14, lineHeight: 1.7, color: '#334155', mb: 0.5 }}
                    dangerouslySetInnerHTML={{ __html: inlineMd(line) }}
                />
            );
        }
    }
    flushBullets();
    return <Box sx={{ fontFamily: '"Inter", sans-serif' }}>{out}</Box>;
};

const SkillhubHourlyTrackerPage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [adminOrg] = useAdminOrgScope();
    const viewOrg = resolveViewOrg(user, adminOrg);
    const isAdmin = user?.role === 'admin';

    const SLOTS = useMemo(() => getSlotsForOrg(viewOrg), [viewOrg]);
    const ACTIVITIES = useMemo(() => getActivitiesForOrg(viewOrg), [viewOrg]);
    const LUNCH = useMemo(() => getLunchGapForOrg(viewOrg), [viewOrg]);
    const lunchIdx = useMemo(() => {
        // Lunch sits between slot index 4 (s1230) and the following slot for
        // Skillhub (s1500), so we render a gap block at position 5 visually.
        // For Skillhub: s0930, s1030, s1130, s1230, s1300 | LUNCH | s1500...
        // Find the first gap in the slot list based on time.
        for (let i = 0; i < SLOTS.length - 1; i++) {
            // crude: if the next slot's label time is not contiguous
            if (SLOTS[i].end === '2:00' && SLOTS[i + 1].lbl === '3:00') return i + 1;
            if (SLOTS[i].end === '1:00' && SLOTS[i + 1].lbl === '2:00') return i + 1;
        }
        return -1;
    }, [SLOTS]);

    const [currentDate, setCurrentDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [consultants, setConsultants] = useState([]);
    const [activities, setActivities] = useState(new Map());
    const [admissions, setAdmissions] = useState(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerTarget, setPickerTarget] = useState(null);
    const [pickerType, setPickerType] = useState(null);
    const [pickerDur, setPickerDur] = useState(60);
    const [pickerCount, setPickerCount] = useState(1);
    const [pickerNote, setPickerNote] = useState('');

    const [aiOpen, setAiOpen] = useState(false);
    const [aiContent, setAiContent] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiKind, setAiKind] = useState('analysis');

    const dateStr = formatDateStr(currentDate);
    const isTodaySelected = isTodayDate(currentDate);
    const canEdit = isTodaySelected || isAdmin;

    // Load data
    const loadAll = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [consRes, actRes, admRes] = await Promise.all([
                hourlyService.getConsultants(),
                hourlyService.getDayActivities(dateStr),
                hourlyService.getDayAdmissions(dateStr),
            ]);
            setConsultants(consRes.data || []);
            const actMap = new Map();
            (actRes.data || []).forEach((a) => {
                actMap.set(`${a.consultant}:${a.slotId}`, a);
            });
            setActivities(actMap);
            const admMap = new Map();
            (admRes.data || []).forEach((a) => {
                admMap.set(String(a.consultant?._id || a.consultant), a.count);
            });
            setAdmissions(admMap);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [dateStr]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const openPicker = (consultantId, consultantName, slot) => {
        if (!canEdit) return;
        const existing = activities.get(`${consultantId}:${slot.id}`);
        setPickerTarget({ consultantId, consultantName, slot });
        setPickerType(existing?.activityType || null);
        setPickerDur(existing?.duration || slot.mins || 60);
        setPickerCount(existing?.count || 1);
        setPickerNote(existing?.note || '');
        setPickerOpen(true);
    };

    const savePick = async () => {
        if (!pickerTarget || !pickerType) {
            setPickerOpen(false);
            return;
        }
        const { consultantId, consultantName, slot } = pickerTarget;
        const act = ACTIVITIES.find((a) => a.slug === pickerType);
        try {
            await hourlyService.upsertSlot({
                consultantId,
                consultantName,
                date: dateStr,
                slotId: slot.id,
                activityType: pickerType,
                count: act?.hasCount ? pickerCount : 1,
                duration: act?.allowsDuration ? pickerDur : slot.mins,
                note: pickerNote,
            });
            setPickerOpen(false);
            await loadAll();
        } catch (e) {
            alert(e.response?.data?.message || 'Save failed');
        }
    };

    const clearSlot = async () => {
        if (!pickerTarget) return;
        const { consultantId, slot } = pickerTarget;
        try {
            await hourlyService.clearSlot({
                consultantId,
                date: dateStr,
                slotId: slot.id,
            });
            setPickerOpen(false);
            await loadAll();
        } catch (e) {
            alert(e.response?.data?.message || 'Clear failed');
        }
    };

    const updateAdmissions = async (consultantId, delta) => {
        if (!canEdit) return;
        const current = admissions.get(consultantId) || 0;
        const next = Math.max(0, current + delta);
        try {
            await hourlyService.upsertAdmission({
                consultantId,
                date: dateStr,
                count: next,
            });
            await loadAll();
        } catch (e) {
            alert(e.response?.data?.message || 'Update failed');
        }
    };

    const runAI = async (kind) => {
        setAiKind(kind);
        setAiOpen(true);
        setAiLoading(true);
        setAiContent('');
        try {
            const res =
                kind === 'analysis'
                    ? await hourlyService.getAIAnalysis(dateStr)
                    : await hourlyService.getLeaderboard(dateStr);
            setAiContent(res.data || 'No data.');
        } catch (e) {
            setAiContent(e.response?.data?.message || 'Failed to generate.');
        } finally {
            setAiLoading(false);
        }
    };

    const branchLabel = ORGANIZATION_LABELS[viewOrg] || 'Skillhub';
    const activityMap = useMemo(
        () => ACTIVITIES.reduce((m, a) => ({ ...m, [a.slug]: a }), {}),
        [ACTIVITIES]
    );

    // Aggregate daily totals across all activity records currently loaded.
    const totals = useMemo(() => {
        const t = {
            calls: 0,
            followupAdmissions: 0,
            schedules: 0,
            breaks: 0,
            demoMeetings: 0,
            demoMinutes: 0,
            paymentFollowups: 0,
            operations: 0,
            activeConsultants: new Set(),
        };
        for (const act of activities.values()) {
            if (act.isContinuation) continue;
            t.activeConsultants.add(String(act.consultant));
            switch (act.activityType) {
                case 'sh_call':
                    t.calls += act.count || 1;
                    break;
                case 'sh_followup_admission':
                    t.followupAdmissions += act.count || 1;
                    break;
                case 'sh_schedule':
                    t.schedules += 1;
                    break;
                case 'sh_break':
                    t.breaks += 1;
                    break;
                case 'sh_demo_meeting':
                    t.demoMeetings += 1;
                    t.demoMinutes += act.duration || 60;
                    break;
                case 'sh_payment_followup':
                    t.paymentFollowups += act.count || 1;
                    break;
                case 'sh_operations':
                    t.operations += 1;
                    break;
                default:
                    break;
            }
        }
        let totalAdmissions = 0;
        for (const v of admissions.values()) totalAdmissions += v || 0;
        return {
            ...t,
            totalAdmissions,
            activeCount: t.activeConsultants.size,
        };
    }, [activities, admissions]);

    const activeCount = totals.activeCount;
    const consultantCount = consultants.length;

    // Maps DB activityType → summary column key. Shared by aggregation +
    // note-bucketing so the eye icon appears under the right column.
    const ACT_TO_COL = {
        sh_call: 'calls',
        sh_followup_admission: 'followupAdmissions',
        sh_schedule: 'schedules',
        sh_break: 'breaks',
        sh_demo_meeting: 'demoMeetings',
        sh_payment_followup: 'paymentFollowups',
        sh_operations: 'operations',
    };

    const slotLabelById = useMemo(() => {
        const m = {};
        for (const s of SLOTS) m[s.id] = `${s.lbl}–${s.end}`;
        return m;
    }, [SLOTS]);

    // Per-counselor daily totals + collected notes, rendered as the DAILY
    // SUMMARY columns in the grid (mirrors LUC's per-row summary block).
    const perCounselor = useMemo(() => {
        const emptyNotes = () => ({
            calls: [], followupAdmissions: [], schedules: [], breaks: [],
            demoMeetings: [], paymentFollowups: [], operations: [],
        });
        const map = {};
        for (const c of consultants) {
            map[c._id] = {
                calls: 0,
                followupAdmissions: 0,
                schedules: 0,
                breaks: 0,
                demoMeetings: 0,
                demoMinutes: 0,
                paymentFollowups: 0,
                operations: 0,
                admissions: admissions.get(c._id) || 0,
                notes: emptyNotes(),
            };
        }
        for (const act of activities.values()) {
            if (act.isContinuation) continue;
            const s = map[String(act.consultant)];
            if (!s) continue;
            switch (act.activityType) {
                case 'sh_call': s.calls += act.count || 1; break;
                case 'sh_followup_admission': s.followupAdmissions += act.count || 1; break;
                case 'sh_schedule': s.schedules += 1; break;
                case 'sh_break': s.breaks += 1; break;
                case 'sh_demo_meeting':
                    s.demoMeetings += 1;
                    s.demoMinutes += act.duration || 60;
                    break;
                case 'sh_payment_followup': s.paymentFollowups += act.count || 1; break;
                case 'sh_operations': s.operations += 1; break;
                default: break;
            }
            // Collect note, keyed by column
            if (act.note && act.note.trim()) {
                const col = ACT_TO_COL[act.activityType];
                if (col) {
                    s.notes[col].push({
                        slot: slotLabelById[act.slotId] || act.slotId,
                        note: act.note,
                    });
                }
            }
        }
        return map;
    }, [consultants, activities, admissions, slotLabelById]);

    const SUMMARY_COLS = [
        { key: 'calls', label: 'Calling', color: '#2563eb' },
        { key: 'followupAdmissions', label: 'F/Up Adm', color: '#0891b2' },
        { key: 'schedules', label: 'Schedule', color: '#4f46e5' },
        { key: 'demoMeetings', label: 'Demo', color: '#16a34a' },
        { key: 'paymentFollowups', label: 'Pay F/Up', color: '#7c3aed' },
        { key: 'operations', label: 'Ops', color: '#dc2626' },
        { key: 'breaks', label: 'Break', color: '#64748b' },
        { key: 'admissions', label: 'Adm', color: '#be185d' },
    ];

    const shiftDate = (days) => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + days);
        setCurrentDate(d);
    };

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f0f3f8' }}>
            {/* Header */}
            <Box
                sx={{
                    px: 2,
                    py: 1.5,
                    bgcolor: '#fff',
                    borderBottom: '1px solid rgba(0,0,0,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                }}
            >
                <IconButton onClick={() => navigate(-1)} size="small">
                    <ArrowBackIcon />
                </IconButton>
                <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
                    {branchLabel} Hourly Tracker
                </Typography>
                {isAdmin && <AdminOrgTabs sx={{ mb: 0 }} onChange={() => window.location.reload()} />}
                <Box sx={{ flex: 1 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton size="small" onClick={() => shiftDate(-1)}>
                        <ChevronLeftIcon />
                    </IconButton>
                    <Chip
                        label={currentDate.toDateString()}
                        onClick={() => setCurrentDate(new Date(new Date().setHours(0, 0, 0, 0)))}
                    />
                    <IconButton size="small" onClick={() => shiftDate(1)}>
                        <ChevronRightIcon />
                    </IconButton>
                </Box>
                <Button
                    size="small"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={() => runAI('analysis')}
                >
                    AI Analysis
                </Button>
                <Button
                    size="small"
                    startIcon={<EmojiEventsIcon />}
                    onClick={() => runAI('leaderboard')}
                >
                    Leaderboard
                </Button>
                <IconButton onClick={logout} size="small">
                    <LogoutIcon />
                </IconButton>
            </Box>

            {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

            {/* Daily summary KPI strip (matches LUC visual language) */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: '6px',
                    px: 2,
                    pt: 1,
                    pb: 1,
                    bgcolor: '#fff',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    flexWrap: 'wrap',
                }}
            >
                {[
                    {
                        v: totals.calls,
                        l: 'Calling',
                        c: '#2563eb',
                        wide: true,
                        sub: consultantCount ? `Avg ${Math.round(totals.calls / Math.max(1, consultantCount))}` : '',
                    },
                    {
                        v: totals.followupAdmissions,
                        l: 'F/Up Admission',
                        c: '#0891b2',
                        wide: true,
                        sub: consultantCount ? `Avg ${Math.round(totals.followupAdmissions / Math.max(1, consultantCount))}` : '',
                    },
                    {
                        v: totals.totalAdmissions,
                        l: 'Admissions',
                        c: '#be185d',
                        wide: true,
                    },
                    {
                        v: totals.demoMeetings,
                        l: 'Demo Mtg',
                        c: '#16a34a',
                        sub: `${(totals.demoMinutes / 60).toFixed(1)}h`,
                    },
                    {
                        v: totals.paymentFollowups,
                        l: 'Payment F/Up',
                        c: '#7c3aed',
                    },
                    {
                        v: totals.schedules,
                        l: 'Schedule',
                        c: '#4f46e5',
                    },
                    {
                        v: totals.operations,
                        l: 'Operations',
                        c: '#dc2626',
                    },
                    {
                        v: totals.breaks,
                        l: 'Breaks',
                        c: '#64748b',
                    },
                    {
                        v: `${activeCount}/${consultantCount}`,
                        l: 'Active',
                        c: '#0d9488',
                        isText: true,
                    },
                ].map((kpi) => (
                    <Box
                        key={kpi.l}
                        sx={{
                            flex: kpi.wide ? 1.8 : 1,
                            minWidth: 90,
                            bgcolor: '#f8fafc',
                            borderRadius: 2,
                            border: '1px solid rgba(0,0,0,0.06)',
                            px: 1.2,
                            py: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Typography
                            sx={{
                                fontFamily: '"JetBrains Mono", monospace',
                                fontSize: kpi.wide ? 22 : 18,
                                fontWeight: 700,
                                color: kpi.c,
                                lineHeight: 1.15,
                            }}
                        >
                            {kpi.v}
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: kpi.wide ? 9 : 8,
                                color: '#94a3b8',
                                textTransform: 'uppercase',
                                letterSpacing: '.04em',
                                fontWeight: 600,
                                textAlign: 'center',
                                lineHeight: 1.2,
                                mt: 0.3,
                            }}
                        >
                            {kpi.l}
                        </Typography>
                        {kpi.sub && (
                            <Typography
                                sx={{
                                    fontSize: 11,
                                    color: '#475569',
                                    fontWeight: 700,
                                    mt: 0.3,
                                }}
                            >
                                {kpi.sub}
                            </Typography>
                        )}
                    </Box>
                ))}
            </Box>

            {/* Grid */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box
                        sx={{
                            bgcolor: '#fff',
                            borderRadius: 2,
                            overflow: 'auto',
                            boxShadow: 1,
                        }}
                    >
                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: 12,
                            }}
                        >
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    <th
                                        style={{
                                            padding: 8,
                                            textAlign: 'left',
                                            borderBottom: '1px solid rgba(0,0,0,0.08)',
                                            position: 'sticky',
                                            left: 0,
                                            background: '#f8fafc',
                                            zIndex: 2,
                                            minWidth: 180,
                                        }}
                                    >
                                        Counselor
                                    </th>
                                    {SLOTS.map((s, i) => (
                                        <React.Fragment key={s.id}>
                                            {i === lunchIdx && (
                                                <th
                                                    style={{
                                                        padding: '6px 4px',
                                                        background: '#fef3c7',
                                                        color: '#92400e',
                                                        fontWeight: 700,
                                                        fontSize: 10,
                                                        textTransform: 'uppercase',
                                                        textAlign: 'center',
                                                        borderBottom: '1px solid rgba(0,0,0,0.08)',
                                                        minWidth: 80,
                                                    }}
                                                >
                                                    🍽️ {LUNCH.note}<br />
                                                    <span style={{ fontSize: 9, opacity: 0.7 }}>{LUNCH.lbl}</span>
                                                </th>
                                            )}
                                            <th
                                                style={{
                                                    padding: '6px 4px',
                                                    borderBottom: '1px solid rgba(0,0,0,0.08)',
                                                    fontSize: 10,
                                                    color: '#64748b',
                                                    minWidth: 80,
                                                    textAlign: 'center',
                                                }}
                                            >
                                                {s.lbl}
                                                <br />
                                                <span style={{ fontSize: 9, opacity: 0.6 }}>
                                                    –{s.end}
                                                </span>
                                            </th>
                                        </React.Fragment>
                                    ))}
                                    {/* DAILY SUMMARY header group spanning the 7 per-counselor metric columns */}
                                    <th
                                        colSpan={SUMMARY_COLS.length - 1}
                                        style={{
                                            padding: '5px 4px',
                                            textAlign: 'center',
                                            borderLeft: '2px solid #fcd34d',
                                            borderBottom: '1px solid rgba(0,0,0,0.08)',
                                            fontSize: 10,
                                            fontWeight: 700,
                                            letterSpacing: '.1em',
                                            textTransform: 'uppercase',
                                            color: '#92400e',
                                            background: '#fef3c7',
                                        }}
                                    >
                                        Daily Summary
                                    </th>
                                    <th
                                        style={{
                                            padding: 8,
                                            textAlign: 'center',
                                            borderBottom: '1px solid rgba(0,0,0,0.08)',
                                            fontSize: 10,
                                            color: '#be185d',
                                            fontWeight: 700,
                                            minWidth: 100,
                                        }}
                                    >
                                        Admissions
                                    </th>
                                </tr>
                                {/* Second header row: per-metric labels under DAILY SUMMARY */}
                                <tr style={{ background: '#fffbeb' }}>
                                    <th style={{ position: 'sticky', left: 0, background: '#fffbeb', borderBottom: '1px solid rgba(0,0,0,0.08)' }} />
                                    {SLOTS.map((s, i) => (
                                        <React.Fragment key={`sub-${s.id}`}>
                                            {i === lunchIdx && (
                                                <th style={{ background: '#fef3c7', borderBottom: '1px solid rgba(0,0,0,0.08)' }} />
                                            )}
                                            <th style={{ background: '#fffbeb', borderBottom: '1px solid rgba(0,0,0,0.08)' }} />
                                        </React.Fragment>
                                    ))}
                                    {SUMMARY_COLS.filter((c) => c.key !== 'admissions').map((col) => (
                                        <th
                                            key={col.key}
                                            style={{
                                                padding: '4px 2px',
                                                fontSize: 9,
                                                fontWeight: 700,
                                                color: col.color,
                                                textTransform: 'uppercase',
                                                letterSpacing: '.04em',
                                                textAlign: 'center',
                                                borderBottom: '1px solid rgba(0,0,0,0.08)',
                                                minWidth: 56,
                                            }}
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                    <th style={{ background: '#fffbeb', borderBottom: '1px solid rgba(0,0,0,0.08)' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {consultants.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={SLOTS.length + 2 + SUMMARY_COLS.length}
                                            style={{
                                                textAlign: 'center',
                                                padding: 32,
                                                color: '#64748b',
                                            }}
                                        >
                                            No counselors seeded for this branch.
                                        </td>
                                    </tr>
                                )}
                                {consultants.map((c) => {
                                    const cid = c._id;
                                    return (
                                        <tr key={cid}>
                                            <td
                                                style={{
                                                    padding: 8,
                                                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                                                    fontWeight: 600,
                                                    position: 'sticky',
                                                    left: 0,
                                                    background: '#fff',
                                                    zIndex: 1,
                                                }}
                                            >
                                                {c.name}
                                                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>
                                                    {c.teamName}
                                                </div>
                                            </td>
                                            {SLOTS.map((s, i) => {
                                                const act = activities.get(`${cid}:${s.id}`);
                                                const meta = act && activityMap[act.activityType];
                                                return (
                                                    <React.Fragment key={s.id}>
                                                        {i === lunchIdx && (
                                                            <td
                                                                style={{
                                                                    background: '#fffbeb',
                                                                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                                                                }}
                                                            />
                                                        )}
                                                        <td
                                                            style={{
                                                                padding: 2,
                                                                borderBottom: '1px solid rgba(0,0,0,0.06)',
                                                                verticalAlign: 'middle',
                                                                textAlign: 'center',
                                                            }}
                                                        >
                                                            <Tooltip
                                                                title={
                                                                    act
                                                                        ? `${meta?.label || act.activityType}${act.note ? ' — ' + act.note : ''}`
                                                                        : canEdit
                                                                        ? 'Click to log activity'
                                                                        : 'Read-only'
                                                                }
                                                                arrow
                                                            >
                                                                <Box
                                                                    onClick={() => openPicker(cid, c.name, s)}
                                                                    sx={{
                                                                        minHeight: 38,
                                                                        mx: 0.3,
                                                                        borderRadius: 1,
                                                                        cursor: canEdit ? 'pointer' : 'default',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        fontSize: 11,
                                                                        fontWeight: 600,
                                                                        color: act ? '#fff' : '#94a3b8',
                                                                        bgcolor: act ? meta?.color || '#64748b' : 'transparent',
                                                                        border: act ? 'none' : '1px dashed rgba(0,0,0,0.1)',
                                                                        '&:hover': canEdit
                                                                            ? { bgcolor: act ? meta?.color : 'rgba(0,0,0,0.04)' }
                                                                            : {},
                                                                    }}
                                                                >
                                                                    {act ? (
                                                                        <Box sx={{ textAlign: 'center', lineHeight: 1.1 }}>
                                                                            {meta?.label?.split(' ')[0] || act.activityType}
                                                                            {act.count > 1 ? ` ×${act.count}` : ''}
                                                                            {act.note && (
                                                                                <Box sx={{ fontSize: 9, fontWeight: 400 }}>
                                                                                    📝
                                                                                </Box>
                                                                            )}
                                                                        </Box>
                                                                    ) : (
                                                                        '+'
                                                                    )}
                                                                </Box>
                                                            </Tooltip>
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                            {/* Per-counselor DAILY SUMMARY cells */}
                                            {SUMMARY_COLS.filter((col) => col.key !== 'admissions').map((col) => {
                                                const val = perCounselor[cid]?.[col.key] || 0;
                                                const colNotes = perCounselor[cid]?.notes?.[col.key] || [];
                                                const sub =
                                                    col.key === 'demoMeetings' && perCounselor[cid]?.demoMinutes
                                                        ? `${(perCounselor[cid].demoMinutes / 60).toFixed(1)}h`
                                                        : '';
                                                return (
                                                    <td
                                                        key={col.key}
                                                        style={{
                                                            padding: '4px 2px',
                                                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                                                            background: '#fffbeb',
                                                            textAlign: 'center',
                                                            fontFamily: '"JetBrains Mono", monospace',
                                                            position: 'relative',
                                                        }}
                                                    >
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                                            <span style={{
                                                                fontSize: 14,
                                                                fontWeight: 700,
                                                                color: val > 0 ? col.color : '#cbd5e1',
                                                                lineHeight: 1.1,
                                                            }}>
                                                                {val}
                                                            </span>
                                                            {colNotes.length > 0 && (
                                                                <Tooltip
                                                                    arrow
                                                                    placement="top"
                                                                    title={
                                                                        <Box sx={{ p: 0.5, maxWidth: 320 }}>
                                                                            <Box sx={{ fontWeight: 700, fontSize: 11, mb: 0.5, textTransform: 'uppercase', letterSpacing: '.04em', opacity: 0.85 }}>
                                                                                {col.label} Notes ({colNotes.length})
                                                                            </Box>
                                                                            {colNotes.map((n, i) => (
                                                                                <Box key={i} sx={{ mb: 0.8, fontSize: 12, lineHeight: 1.5 }}>
                                                                                    <Box sx={{ fontWeight: 700, opacity: 0.85 }}>
                                                                                        {n.slot}
                                                                                    </Box>
                                                                                    <Box>{n.note}</Box>
                                                                                </Box>
                                                                            ))}
                                                                        </Box>
                                                                    }
                                                                >
                                                                    <VisibilityIcon
                                                                        sx={{
                                                                            fontSize: 13,
                                                                            color: col.color,
                                                                            opacity: 0.75,
                                                                            cursor: 'pointer',
                                                                            '&:hover': { opacity: 1 },
                                                                        }}
                                                                    />
                                                                </Tooltip>
                                                            )}
                                                        </Box>
                                                        {sub && (
                                                            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>
                                                                {sub}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td
                                                style={{
                                                    padding: 4,
                                                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                                    <IconButton
                                                        size="small"
                                                        disabled={!canEdit || (admissions.get(cid) || 0) === 0}
                                                        onClick={() => updateAdmissions(cid, -1)}
                                                        sx={{ fontSize: 14 }}
                                                    >
                                                        −
                                                    </IconButton>
                                                    <Typography sx={{ minWidth: 24, fontWeight: 700, color: '#be185d' }}>
                                                        {admissions.get(cid) || 0}
                                                    </Typography>
                                                    <IconButton
                                                        size="small"
                                                        disabled={!canEdit}
                                                        onClick={() => updateAdmissions(cid, 1)}
                                                        sx={{ fontSize: 14 }}
                                                    >
                                                        +
                                                    </IconButton>
                                                </Box>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </Box>
                )}
            </Box>

            {/* Activity Picker Dialog */}
            <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {pickerTarget?.consultantName} — {pickerTarget?.slot.lbl}–{pickerTarget?.slot.end}
                </DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                        Select an activity type
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, mb: 2 }}>
                        {ACTIVITIES.map((a) => (
                            <Button
                                key={a.slug}
                                variant={pickerType === a.slug ? 'contained' : 'outlined'}
                                onClick={() => setPickerType(a.slug)}
                                sx={{
                                    justifyContent: 'flex-start',
                                    textTransform: 'none',
                                    bgcolor: pickerType === a.slug ? a.color : 'transparent',
                                    color: pickerType === a.slug ? '#fff' : a.color,
                                    borderColor: a.color,
                                    '&:hover': {
                                        bgcolor: pickerType === a.slug ? a.color : `${a.color}15`,
                                        borderColor: a.color,
                                    },
                                }}
                            >
                                {a.label}
                            </Button>
                        ))}
                    </Box>

                    {pickerType && activityMap[pickerType]?.hasCount && (
                        <TextField
                            fullWidth
                            type="number"
                            label="Count"
                            value={pickerCount}
                            onChange={(e) => setPickerCount(Math.max(1, Number(e.target.value) || 1))}
                            sx={{ mb: 2 }}
                        />
                    )}

                    {pickerType && activityMap[pickerType]?.allowsDuration && (
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Duration</InputLabel>
                            <Select
                                label="Duration"
                                value={pickerDur}
                                onChange={(e) => setPickerDur(Number(e.target.value))}
                            >
                                {DURATIONS.map((d) => (
                                    <MenuItem key={d.v} value={d.v}>
                                        {d.lbl}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        label="Note (optional)"
                        value={pickerNote}
                        onChange={(e) => setPickerNote(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={clearSlot}>
                        Clear Slot
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Button onClick={() => setPickerOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={savePick} disabled={!pickerType}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* AI Analysis / Leaderboard Dialog */}
            <Dialog open={aiOpen} onClose={() => setAiOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    {aiKind === 'analysis' ? '🤖 Daily AI Analysis' : '🏆 Daily Leaderboard'}
                </DialogTitle>
                <DialogContent dividers>
                    {aiLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <MarkdownBlock text={aiContent} />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAiOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SkillhubHourlyTrackerPage;
