import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box,
    Typography,
    Button,
    IconButton,
    Dialog,
    DialogContent,
    Snackbar,
    TextField,
    Tooltip,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    ChevronLeft,
    ChevronRight,
    Add as AddIcon,
    Delete as DeleteIcon,
    PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import hourlyService from '../services/hourlyService';
import consultantService from '../services/consultantService';

// ─── CONSTANTS ───────────────────────────────────────────────
const SLOTS = [
    { id: 's0930', lbl: '9:30', end: '10:30', mins: 60 },
    { id: 's1030', lbl: '10:30', end: '11:30', mins: 60 },
    { id: 's1130', lbl: '11:30', end: '12:30', mins: 60 },
    { id: 's1230', lbl: '12:30', end: '1:00', mins: 30 },
    { id: 'lunch', lbl: '1:00', end: '2:00', mins: 60, isLunch: true },
    { id: 's1400', lbl: '2:00', end: '3:00', mins: 60 },
    { id: 's1500', lbl: '3:00', end: '4:00', mins: 60 },
    { id: 's1600', lbl: '4:00', end: '5:00', mins: 60 },
    { id: 's1700', lbl: '5:00', end: '6:00', mins: 60 },
    { id: 's1800', lbl: '6:00', end: '7:00', mins: 60 },
    { id: 's1900', lbl: '7:00', end: '7:30', mins: 30 },
];
const WORK_SLOTS = SLOTS.filter((s) => !s.isLunch);
const AM_SLOTS = SLOTS.slice(0, 4);
const PM_SLOTS = SLOTS.slice(5);

const ACTIVITY_TYPES = [
    { id: 'call', icon: '📞', lbl: 'Call', hasCount: true, hasDur: false, color: '#2563eb', bg: '#eff6ff', unit: 'calls' },
    { id: 'followup', icon: '↩️', lbl: 'Follow-up', hasCount: true, hasDur: false, color: '#0891b2', bg: '#ecfeff', unit: 'follow-ups' },
    { id: 'noshow', icon: '⚙️', lbl: 'Operations', hasCount: true, hasDur: false, color: '#dc2626', bg: '#fef2f2', unit: 'operations' },
    { id: 'drip', icon: '📧', lbl: 'Drip', hasCount: false, hasDur: false, color: '#d97706', bg: '#fffbeb' },
    { id: 'meeting', icon: '🤝', lbl: 'Offline Meeting', hasCount: false, hasDur: true, color: '#16a34a', bg: '#f0fdf4' },
    { id: 'zoom', icon: '💻', lbl: 'Zoom', hasCount: false, hasDur: true, color: '#4f46e5', bg: '#eef2ff' },
    { id: 'outmeet', icon: '🚗', lbl: 'Out Meeting', hasCount: false, hasDur: true, color: '#7c3aed', bg: '#f5f3ff' },
    { id: 'teammeet', icon: '👥', lbl: 'Team Meeting', hasCount: false, hasDur: true, color: '#be185d', bg: '#fdf2f8' },
];

const DURATIONS = [
    { v: 30, lbl: '30 min', sub: 'Half hour' },
    { v: 60, lbl: '1 hr', sub: 'Full hour' },
    { v: 90, lbl: '1.5 hr', sub: 'One & half' },
    { v: 120, lbl: '2 hr', sub: 'Two hours' },
    { v: 150, lbl: '2.5 hr', sub: 'Two & half' },
    { v: 180, lbl: '3 hr', sub: 'Three hours' },
    { v: 240, lbl: '4 hr', sub: 'Four hours' },
    { v: 300, lbl: '5 hr', sub: 'Five hours' },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isToday(d) {
    const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function getCurrentSlotId() {
    const now = new Date();
    const tot = now.getHours() * 60 + now.getMinutes();
    if (tot >= 570 && tot < 630) return 's0930';
    if (tot >= 630 && tot < 690) return 's1030';
    if (tot >= 690 && tot < 750) return 's1130';
    if (tot >= 750 && tot < 780) return 's1230';
    if (tot >= 780 && tot < 840) return 'lunch';
    if (tot >= 840 && tot < 900) return 's1400';
    if (tot >= 900 && tot < 960) return 's1500';
    if (tot >= 960 && tot < 1020) return 's1600';
    if (tot >= 1020 && tot < 1080) return 's1700';
    if (tot >= 1080 && tot < 1140) return 's1800';
    if (tot >= 1140 && tot < 1170) return 's1900';
    return null;
}

// ─── COMPONENT ───────────────────────────────────────────────
const HourlyTrackerPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const dateInputRef = useRef(null);

    const [currentDate, setCurrentDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [currentView, setCurrentView] = useState('daily');
    const [monthReport, setMonthReport] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() });
    const [consultants, setConsultants] = useState([]);
    const [activities, setActivities] = useState(new Map());
    const [admissions, setAdmissions] = useState(new Map());
    const [loading, setLoading] = useState(false);

    // Picker state
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerTarget, setPickerTarget] = useState(null);
    const [pickerType, setPickerType] = useState(null);
    const [pickerDur, setPickerDur] = useState(60);
    const [pickerCount, setPickerCount] = useState(1);
    const [pickerNote, setPickerNote] = useState('');

    // Monthly data
    const [monthActivities, setMonthActivities] = useState([]);
    const [monthAdmissions, setMonthAdmissions] = useState([]);

    // Admin features
    const isAdmin = user?.role === 'admin';
    const [manageOpen, setManageOpen] = useState(false);
    const [newConsultantName, setNewConsultantName] = useState('');
    const [newConsultantTeam, setNewConsultantTeam] = useState('');

    // Toast
    const [toast, setToast] = useState({ open: false, msg: '' });

    const showToast = (msg) => setToast({ open: true, msg });

    // ─── DATA LOADING ────────────────────────────────
    const loadConsultants = useCallback(async () => {
        try {
            const res = await hourlyService.getConsultants();
            setConsultants(res.data || []);
        } catch (err) {
            console.error('Failed to load consultants:', err);
        }
    }, []);

    const loadDayActivities = useCallback(async (date) => {
        try {
            const res = await hourlyService.getDayActivities(formatDateStr(date));
            const map = new Map();
            (res.data || []).forEach((a) => {
                map.set(`${a.consultant}_${a.slotId}`, a);
            });
            setActivities(map);
        } catch (err) {
            console.error('Failed to load activities:', err);
        }
    }, []);

    const loadDayAdmissions = useCallback(async (date) => {
        try {
            const res = await hourlyService.getDayAdmissions(formatDateStr(date));
            const map = new Map();
            (res.data || []).forEach((a) => {
                map.set(a.consultant, a.count);
            });
            setAdmissions(map);
        } catch (err) {
            console.error('Failed to load admissions:', err);
        }
    }, []);

    const loadMonthActivities = useCallback(async (y, m) => {
        try {
            const res = await hourlyService.getMonthActivities(y, m);
            setMonthActivities(res.data || []);
        } catch (err) {
            console.error('Failed to load monthly activities:', err);
        }
    }, []);

    const loadMonthAdmissions = useCallback(async (y, m) => {
        try {
            const res = await hourlyService.getMonthAdmissions(y, m);
            setMonthAdmissions(res.data || []);
        } catch (err) {
            console.error('Failed to load monthly admissions:', err);
        }
    }, []);

    useEffect(() => {
        loadConsultants();
    }, [loadConsultants]);

    useEffect(() => {
        loadDayActivities(currentDate);
        loadDayAdmissions(currentDate);
    }, [currentDate, loadDayActivities, loadDayAdmissions]);

    useEffect(() => {
        if (currentView === 'monthly') {
            loadMonthActivities(monthReport.y, monthReport.m);
            loadMonthAdmissions(monthReport.y, monthReport.m);
        }
    }, [currentView, monthReport, loadMonthActivities, loadMonthAdmissions]);

    // Refresh current slot highlight every minute
    const [curSlot, setCurSlot] = useState(isToday(currentDate) ? getCurrentSlotId() : null);
    useEffect(() => {
        const interval = setInterval(() => {
            setCurSlot(isToday(currentDate) ? getCurrentSlotId() : null);
        }, 60000);
        return () => clearInterval(interval);
    }, [currentDate]);

    // ─── HELPERS ─────────────────────────────────────
    const getAct = (consultantId, slotId) => activities.get(`${consultantId}_${slotId}`) || null;

    const getStats = (consultantId) => {
        let calls = 0, followups = 0, noshows = 0, drips = 0, physicalMtgs = 0, zoomMtgs = 0, teamMtgs = 0, activeHrs = 0, meetHrs = 0;
        WORK_SLOTS.forEach((s) => {
            const d = getAct(consultantId, s.id);
            if (!d || d.isContinuation) return;
            const mins = d.duration || s.mins;
            const hrs = mins / 60;
            activeHrs += hrs;
            if (d.activityType === 'call') calls += d.count || 1;
            if (d.activityType === 'followup') followups += d.count || 1;
            if (d.activityType === 'noshow') noshows += d.count || 1;
            if (d.activityType === 'drip') drips++;
            if (d.activityType === 'meeting' || d.activityType === 'outmeet') { physicalMtgs++; meetHrs += hrs; }
            if (d.activityType === 'zoom') { zoomMtgs++; meetHrs += hrs; }
            if (d.activityType === 'teammeet') { teamMtgs++; meetHrs += hrs; }
        });
        return { calls, followups, noshows, drips, physicalMtgs, zoomMtgs, teamMtgs, activeHrs: +activeHrs.toFixed(1), meetHrs: +meetHrs.toFixed(1) };
    };

    const getTeamTotals = () => {
        const t = { calls: 0, followups: 0, noshows: 0, drips: 0, physicalMtgs: 0, zoomMtgs: 0, teamMtgs: 0, activeHrs: 0, meetHrs: 0 };
        consultants.forEach((c) => {
            const s = getStats(c._id);
            Object.keys(t).forEach((k) => (t[k] += s[k]));
        });
        t.activeHrs = +t.activeHrs.toFixed(1);
        t.meetHrs = +t.meetHrs.toFixed(1);
        return t;
    };

    // ─── ACTIONS ─────────────────────────────────────
    const isTodaySelected = isToday(currentDate);

    const handleCellClick = (consultant, slotId) => {
        if (!isTodaySelected) { showToast('Entries can only be made for today'); return; }
        const existing = getAct(consultant._id, slotId);
        // If it's a continuation, open the parent
        if (existing && existing.isContinuation && existing.parentSlotId) {
            setPickerTarget({ consultant, slotId: existing.parentSlotId });
            const parent = getAct(consultant._id, existing.parentSlotId);
            setPickerType(parent?.activityType || null);
            setPickerDur(parent?.duration || 60);
            setPickerCount(parent?.count || 1);
            setPickerNote(parent?.note || '');
        } else {
            setPickerTarget({ consultant, slotId });
            setPickerType(existing?.activityType || null);
            setPickerDur(existing?.duration || 60);
            setPickerCount(existing?.count || 1);
            setPickerNote(existing?.note || '');
        }
        setPickerOpen(true);
    };

    const handleSave = async () => {
        if (!pickerTarget || !pickerType) { showToast('Select an activity type'); return; }
        const { consultant, slotId } = pickerTarget;
        const act = ACTIVITY_TYPES.find((a) => a.id === pickerType);
        const slotDef = SLOTS.find((s) => s.id === slotId);
        const dur = act.hasDur ? pickerDur : (slotDef ? slotDef.mins : 60);
        const count = act.hasCount ? (pickerCount || 1) : 1;

        setLoading(true);
        try {
            await hourlyService.upsertSlot({
                consultantId: consultant._id,
                consultantName: consultant.name,
                date: formatDateStr(currentDate),
                slotId,
                activityType: pickerType,
                count,
                duration: dur,
                note: pickerNote,
            });
            await loadDayActivities(currentDate);
            setPickerOpen(false);
            const durStr = act.hasDur ? ` · ${dur >= 60 ? dur / 60 + 'h' : dur + 'm'}` : '';
            const cntStr = act.hasCount && count > 1 ? ` · ×${count}` : '';
            showToast(`${act.icon} ${consultant.name}${durStr}${cntStr}`);
        } catch (err) {
            showToast('Failed to save');
        }
        setLoading(false);
    };

    const handleClearSlot = async () => {
        if (!pickerTarget) return;
        const { consultant, slotId } = pickerTarget;
        setLoading(true);
        try {
            await hourlyService.clearSlot({
                consultantId: consultant._id,
                date: formatDateStr(currentDate),
                slotId,
            });
            await loadDayActivities(currentDate);
            setPickerOpen(false);
        } catch (err) {
            showToast('Failed to clear');
        }
        setLoading(false);
    };

    const getAdmission = (consultantId) => admissions.get(consultantId) || 0;

    const handleAdmissionChange = async (consultant, value) => {
        if (!isTodaySelected) return;
        const count = parseInt(value) || 0;
        // Optimistic update
        setAdmissions((prev) => {
            const next = new Map(prev);
            if (count > 0) next.set(consultant._id, count);
            else next.delete(consultant._id);
            return next;
        });
        try {
            await hourlyService.upsertAdmission({
                consultantId: consultant._id,
                date: formatDateStr(currentDate),
                count,
            });
        } catch (err) {
            showToast('Failed to save admission');
            loadDayAdmissions(currentDate);
        }
    };

    const getTotalAdmissions = () => {
        let total = 0;
        admissions.forEach((v) => (total += v));
        return total;
    };

    const handleAddConsultant = async () => {
        if (!newConsultantName.trim()) { showToast('Enter consultant name'); return; }
        try {
            await consultantService.createConsultant({
                name: newConsultantName.trim(),
                teamName: newConsultantTeam.trim() || 'General',
            });
            setNewConsultantName('');
            setNewConsultantTeam('');
            await loadConsultants();
            showToast('Consultant added');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to add consultant');
        }
    };

    const handleDeleteConsultant = async (consultant) => {
        if (!window.confirm(`Remove "${consultant.name}" from the tracker? This will deactivate them.`)) return;
        try {
            await consultantService.deleteConsultant(consultant._id);
            await loadConsultants();
            showToast(`${consultant.name} removed`);
        } catch (err) {
            showToast('Failed to remove consultant');
        }
    };

    const handleClearDay = async () => {
        if (!isTodaySelected) { showToast('Can only clear today\'s data'); return; }
        if (!window.confirm(`Clear ALL data for ${formatDateStr(currentDate)}?`)) return;
        setLoading(true);
        try {
            await hourlyService.clearDay(formatDateStr(currentDate));
            await loadDayActivities(currentDate);
            showToast('Day cleared');
        } catch (err) {
            showToast('Failed to clear day');
        }
        setLoading(false);
    };

    // ─── DATE NAV ────────────────────────────────────
    const shiftDate = (delta) => {
        setCurrentDate((prev) => {
            const d = new Date(prev);
            d.setDate(d.getDate() + delta);
            return d;
        });
    };

    const goToday = () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        setCurrentDate(d);
    };

    // ─── MONTHLY STATS ──────────────────────────────
    const getMonthlyStats = () => {
        const { y, m } = monthReport;
        const daysInMonth = new Date(y, m + 1, 0).getDate();

        const rows = consultants.map((c) => {
            const r = { consultant: c, calls: 0, followups: 0, noshows: 0, drips: 0, physicalMtgs: 0, zoomMtgs: 0, teamMtgs: 0, activeHrs: 0, meetHrs: 0, admissions: 0, days: 0, heatmap: [] };
            // Sum admissions for this consultant across the month
            monthAdmissions.filter((a) => a.consultant === c._id).forEach((a) => { r.admissions += a.count || 0; });
            for (let d = 1; d <= daysInMonth; d++) {
                let dayCalls = 0, dayPhysical = 0, dayZoom = 0, dayTeam = 0, dayFollowups = 0, dayNoshows = 0, dayDrips = 0, dayActiveHrs = 0, dayMeetHrs = 0;
                const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                monthActivities.filter((a) => a.consultant === c._id && a.date && a.date.startsWith(dateStr) && !a.isContinuation).forEach((a) => {
                    const mins = a.duration || 60;
                    const hrs = mins / 60;
                    dayActiveHrs += hrs;
                    if (a.activityType === 'call') dayCalls += a.count || 1;
                    if (a.activityType === 'followup') dayFollowups += a.count || 1;
                    if (a.activityType === 'noshow') dayNoshows += a.count || 1;
                    if (a.activityType === 'drip') dayDrips++;
                    if (a.activityType === 'meeting' || a.activityType === 'outmeet') { dayPhysical++; dayMeetHrs += hrs; }
                    if (a.activityType === 'zoom') { dayZoom++; dayMeetHrs += hrs; }
                    if (a.activityType === 'teammeet') { dayTeam++; dayMeetHrs += hrs; }
                });
                r.calls += dayCalls; r.followups += dayFollowups; r.noshows += dayNoshows;
                r.drips += dayDrips; r.physicalMtgs += dayPhysical; r.zoomMtgs += dayZoom; r.teamMtgs += dayTeam;
                r.activeHrs += dayActiveHrs; r.meetHrs += dayMeetHrs;
                const dayMeetings = dayPhysical + dayZoom + dayTeam;
                if (dayCalls + dayMeetings + dayFollowups + dayNoshows + dayDrips > 0) r.days++;
                r.heatmap.push(dayCalls + dayMeetings + dayDrips + dayFollowups);
            }
            r.activeHrs = +r.activeHrs.toFixed(1);
            r.meetHrs = +r.meetHrs.toFixed(1);
            return r;
        });

        const teamTot = { calls: 0, followups: 0, noshows: 0, drips: 0, physicalMtgs: 0, zoomMtgs: 0, teamMtgs: 0, activeHrs: 0, meetHrs: 0, admissions: 0, days: 0 };
        rows.forEach((r) => {
            teamTot.calls += r.calls; teamTot.followups += r.followups; teamTot.noshows += r.noshows;
            teamTot.drips += r.drips; teamTot.physicalMtgs += r.physicalMtgs; teamTot.zoomMtgs += r.zoomMtgs; teamTot.teamMtgs += r.teamMtgs;
            teamTot.activeHrs += r.activeHrs; teamTot.meetHrs += r.meetHrs; teamTot.admissions += r.admissions; teamTot.days += r.days;
        });
        teamTot.activeHrs = +teamTot.activeHrs.toFixed(1);
        teamTot.meetHrs = +teamTot.meetHrs.toFixed(1);

        return { rows, teamTot, daysInMonth };
    };

    const heatColor = (v) => {
        if (v === 0) return '#f1f5f9';
        if (v <= 2) return '#bfdbfe';
        if (v <= 5) return '#60a5fa';
        if (v <= 10) return '#2563eb';
        return '#1d4ed8';
    };

    // ─── STYLES ──────────────────────────────────────
    const S = {
        hdr: { background: '#0c1829', height: 52, display: 'flex', alignItems: 'center', gap: 1, px: 1.5, position: 'relative', zIndex: 50, boxShadow: '0 2px 12px rgba(0,0,0,.25)', overflow: 'visible', flexShrink: 0 },
        brand: { display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, mr: 0.5 },
        brandMark: { width: 30, height: 30, borderRadius: '7px', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff' },
        vtab: (active) => ({ px: 1.5, py: 0.5, borderRadius: '5px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: active ? 'rgba(255,255,255,.15)' : 'none', color: active ? '#fff' : 'rgba(255,255,255,.5)', transition: 'all .15s', '&:hover': { background: 'rgba(255,255,255,.1)' }, minWidth: 'auto' }),
        kpi: { display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1.5, py: 0.3, borderRadius: '6px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.09)', minWidth: 58 },
        th: { background: '#243348', color: 'rgba(255,255,255,.7)', fontFamily: '"JetBrains Mono",monospace', fontSize: 10, fontWeight: 500, p: '5px 2px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.07)', whiteSpace: 'nowrap' },
        td: { borderRight: '1px solid #dde3ed', borderBottom: '1px solid #dde3ed', height: 36, verticalAlign: 'middle', p: 0 },
    };

    const teamTotals = currentView === 'daily' ? getTeamTotals() : {};

    // ─── RENDER ──────────────────────────────────────
    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f0f3f8', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
            {/* ── HEADER ── */}
            <Box sx={S.hdr}>
                <Tooltip title="Back to Dashboard">
                    <IconButton size="small" onClick={() => navigate(user?.role === 'admin' ? '/admin/dashboard' : '/team-lead/dashboard')} sx={{ color: 'rgba(255,255,255,.5)', p: 0.5 }}>
                        <ArrowBackIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
                <Box sx={S.brand}>
                    <Box sx={S.brandMark}>L</Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#fff', whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#0ea5e9' }}>Learners</span> Activity Tracker
                    </Typography>
                </Box>

                <Box sx={{ width: '1px', height: 24, background: 'rgba(255,255,255,.1)', flexShrink: 0 }} />

                {/* View tabs */}
                <Box sx={{ display: 'flex', gap: '3px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '8px', p: '3px', flexShrink: 0 }}>
                    <Button sx={S.vtab(currentView === 'daily')} onClick={() => setCurrentView('daily')}>📅 Daily</Button>
                    <Button sx={S.vtab(currentView === 'monthly')} onClick={() => setCurrentView('monthly')}>📊 Monthly</Button>
                </Box>

                <Box sx={{ width: '1px', height: 24, background: 'rgba(255,255,255,.1)', flexShrink: 0 }} />

                {/* Date nav (daily only) */}
                {currentView === 'daily' && (
                    <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            <IconButton size="small" onClick={() => shiftDate(-1)} sx={{ width: 26, height: 26, borderRadius: '5px', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)', '&:hover': { background: 'rgba(255,255,255,.14)', color: '#fff' } }}>
                                <ChevronLeft sx={{ fontSize: 16 }} />
                            </IconButton>
                            <Box onClick={() => dateInputRef.current?.showPicker()} sx={{ px: '11px', py: '4px', borderRadius: '6px', background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.12)', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { background: 'rgba(255,255,255,.14)' } }}>
                                {`${DAYS[currentDate.getDay()]}, ${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
                            </Box>
                            <input
                                type="date"
                                ref={dateInputRef}
                                value={formatDateStr(currentDate)}
                                onChange={(e) => { if (e.target.value) { const [y, m, d] = e.target.value.split('-').map(Number); setCurrentDate(new Date(y, m - 1, d)); } }}
                                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
                            />
                            <IconButton size="small" onClick={() => shiftDate(1)} sx={{ width: 26, height: 26, borderRadius: '5px', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)', '&:hover': { background: 'rgba(255,255,255,.14)', color: '#fff' } }}>
                                <ChevronRight sx={{ fontSize: 16 }} />
                            </IconButton>
                            <Button size="small" onClick={goToday} sx={{ px: '10px', py: '4px', borderRadius: '5px', border: '1px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.5)', fontSize: 11, fontWeight: 500, textTransform: 'none', minWidth: 'auto', lineHeight: 1, '&:hover': { background: 'rgba(255,255,255,.1)', color: '#fff' } }}>
                                Today
                            </Button>
                        </Box>

                        {/* KPIs */}
                        <Box sx={{ display: 'flex', gap: '3px', ml: 'auto', flexShrink: 0 }}>
                            {[
                                { v: teamTotals.calls, l: 'Calls', c: '#60a5fa' },
                                { v: teamTotals.physicalMtgs, l: 'Offline Meeting', c: '#4ade80' },
                                { v: teamTotals.zoomMtgs, l: 'Zoom', c: '#818cf8' },
                                { v: teamTotals.teamMtgs, l: 'Team Meeting', c: '#f472b6' },
                                { v: teamTotals.noshows, l: 'Ops', c: '#f87171' },
                                { v: teamTotals.followups, l: 'Follow-ups', c: '#fbbf24' },
                                { v: teamTotals.drips, l: 'Drips', c: '#c084fc' },
                                { v: getTotalAdmissions(), l: 'Admissions', c: '#f9a8d4' },
                            ].map((kpi) => (
                                <Box key={kpi.l} sx={S.kpi}>
                                    <Typography sx={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 16, fontWeight: 600, color: kpi.c, lineHeight: 1.1 }}>{kpi.v}</Typography>
                                    <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.07em', mt: '1px' }}>{kpi.l}</Typography>
                                </Box>
                            ))}
                        </Box>

                        {!isTodaySelected && (
                            <Box sx={{ px: '11px', py: '4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', fontSize: 11, fontWeight: 600, color: '#fbbf24', flexShrink: 0 }}>
                                View Only
                            </Box>
                        )}
                        {isAdmin && (
                            <Button size="small" onClick={() => setManageOpen(true)} sx={{ px: '11px', py: '4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.5)', fontSize: 11, textTransform: 'none', flexShrink: 0, minWidth: 'auto', lineHeight: 1, '&:hover': { background: 'rgba(255,255,255,.12)', color: '#fff' } }}>
                                <PersonAddIcon sx={{ fontSize: 14, mr: 0.5 }} /> Manage
                            </Button>
                        )}
                        {isTodaySelected && isAdmin && (
                            <Button size="small" onClick={handleClearDay} sx={{ px: '11px', py: '4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.4)', fontSize: 11, textTransform: 'none', flexShrink: 0, minWidth: 'auto', lineHeight: 1, '&:hover': { background: 'rgba(220,38,38,.2)', color: '#fca5a5', borderColor: 'rgba(220,38,38,.3)' } }}>
                                ✕ Clear Day
                            </Button>
                        )}
                    </>
                )}
            </Box>

            {/* ── LEGEND BAR ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap', overflowX: 'auto', px: 2, py: 0.6, background: '#fff', borderBottom: '1px solid #dde3ed', flexShrink: 0, '&::-webkit-scrollbar': { height: 0 } }}>
                {ACTIVITY_TYPES.map((a) => (
                    <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.3, borderRadius: 20, border: `1px solid ${a.color}25`, color: a.color, background: a.bg, whiteSpace: 'nowrap', fontSize: 10.5, fontWeight: 500, flexShrink: 0 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                        {a.icon} {a.lbl}
                    </Box>
                ))}
                <Typography sx={{ fontSize: 10.5, color: '#8a9ab0', whiteSpace: 'nowrap', ml: 0.5, flexShrink: 0 }}>
                    Click cell to select activity & enter count/duration
                </Typography>
            </Box>

            {/* ── DAILY VIEW ── */}
            {currentView === 'daily' && (
                <Box sx={{ flex: 1, overflow: 'auto', '&::-webkit-scrollbar': { width: 6, height: 6 }, '&::-webkit-scrollbar-track': { background: '#f0f3f8' }, '&::-webkit-scrollbar-thumb': { background: '#c8d0de', borderRadius: 10 } }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 30 }}>
                            {/* Group header */}
                            <tr>
                                <th style={{ width: 34, background: '#1a2840', border: 'none', position: 'sticky', left: 0, zIndex: 40 }} />
                                <th style={{ width: 160, background: '#1a2840', border: 'none', position: 'sticky', left: 34, zIndex: 40 }} />
                                <th colSpan={AM_SLOTS.length} style={{ background: '#1e3055', color: '#93c5fd', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '5px 3px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.06)' }}>
                                    MORNING 9:30-1:00
                                </th>
                                <th colSpan={1} style={{ background: '#1c1c28', color: 'rgba(255,255,255,.25)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '5px 3px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.06)' }}>
                                    LUNCH
                                </th>
                                <th colSpan={PM_SLOTS.length} style={{ background: '#1a3328', color: '#86efac', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '5px 3px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.06)' }}>
                                    AFTERNOON 2:00-7:30
                                </th>
                                <th colSpan={10} style={{ background: '#2a2010', color: '#fcd34d', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '5px 3px', textAlign: 'center' }}>
                                    DAILY SUMMARY
                                </th>
                            </tr>
                            {/* Slot header */}
                            <tr>
                                <th style={{ width: 34, background: '#1a2535', color: 'rgba(255,255,255,.3)', fontSize: 9, padding: '5px 2px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.07)', position: 'sticky', left: 0, zIndex: 40 }}>#</th>
                                <th style={{ width: 160, background: '#1a2535', color: 'rgba(255,255,255,.6)', fontSize: 10, padding: '0 8px', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,.07)', position: 'sticky', left: 34, zIndex: 40 }}>CONSULTANT</th>
                                {SLOTS.map((s) => {
                                    const isCur = s.id === curSlot;
                                    if (s.isLunch) {
                                        return <th key={s.id} style={{ width: 58, background: isCur ? '#1a3a52' : '#1e1e2e', color: isCur ? '#7dd3fc' : 'rgba(255,255,255,.25)', fontSize: 9, padding: '5px 2px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.07)', boxShadow: isCur ? 'inset 0 -2px 0 #38bdf8' : 'none' }}>1:00<br /><span style={{ fontSize: 7.5, opacity: .5 }}>2:00</span></th>;
                                    }
                                    return <th key={s.id} style={{ width: 74, background: isCur ? '#1a3a52' : '#243348', color: isCur ? '#7dd3fc' : 'rgba(255,255,255,.7)', fontFamily: '"JetBrains Mono",monospace', fontSize: 10, fontWeight: 500, padding: '5px 2px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.07)', boxShadow: isCur ? 'inset 0 -2px 0 #38bdf8' : 'none' }}>{s.lbl}<br /><span style={{ fontSize: 7.5, opacity: .5 }}>{s.end}</span></th>;
                                })}
                                {[
                                    { l: 'CALLS', c: '#93c5fd' }, { l: 'F/UP', c: '#67e8f9' }, { l: 'OPS', c: '#fca5a5' },
                                    { l: 'DRIPS', c: '#fcd34d' }, { l: 'OFFLINE MEETING', c: '#86efac' }, { l: 'ZOOM', c: '#818cf8' }, { l: 'TEAM MEETING', c: '#f472b6' }, { l: 'ACT HRS', c: '#94a3b8' }, { l: 'MEETING HRS', c: '#94a3b8' }, { l: 'ADMISSION', c: '#f9a8d4' },
                                ].map((h, i) => (
                                    <th key={h.l} style={{ width: 52, background: '#1e1a0e', color: h.c, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', padding: '5px 2px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.07)', borderLeft: i === 0 ? '2px solid #dfd08a' : 'none' }}>{h.l}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {consultants.map((c, idx) => {
                                const st = getStats(c._id);
                                return (
                                    <tr key={c._id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfd' }}>
                                        <td style={{ ...S.td, width: 34, textAlign: 'center', fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: '#8a9ab0', background: '#f6f8fc', borderRight: '1px solid #c8d0de', position: 'sticky', left: 0, zIndex: 5 }}>{idx + 1}</td>
                                        <td style={{ ...S.td, width: 160, background: '#f6f8fc', borderRight: '2px solid #c8d0de', padding: '0 7px', position: 'sticky', left: 34, zIndex: 5 }}>
                                            <Tooltip title={c.teamLead?.name ? `Team: ${c.teamName || c.teamLead.teamName || ''}` : ''} placement="right">
                                                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0d1520', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {c.name}
                                                </div>
                                            </Tooltip>
                                        </td>
                                        {SLOTS.map((s) => {
                                            if (s.isLunch) {
                                                return (
                                                    <td key={s.id} style={{ ...S.td, width: 58, textAlign: 'center', background: '#fef9ec', cursor: 'default' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                                            <span style={{ fontSize: 12 }}>🍽</span>
                                                            <span style={{ fontSize: 7.5, textTransform: 'uppercase', letterSpacing: '.06em', color: '#d97706', marginTop: 1 }}>Lunch</span>
                                                        </div>
                                                    </td>
                                                );
                                            }
                                            const d = getAct(c._id, s.id);
                                            const act = d && !d.isContinuation ? ACTIVITY_TYPES.find((a) => a.id === d.activityType) : null;
                                            const isCur = s.id === curSlot;
                                            return (
                                                <td
                                                    key={s.id}
                                                    onClick={() => handleCellClick(c, s.id)}
                                                    style={{
                                                        ...S.td,
                                                        width: 74,
                                                        textAlign: 'center',
                                                        cursor: isTodaySelected ? 'pointer' : 'default',
                                                        position: 'relative',
                                                        overflow: 'hidden',
                                                        background: d ? (act ? act.bg : 'transparent') : 'transparent',
                                                        boxShadow: isCur ? 'inset 0 0 0 2px rgba(14,165,233,.35)' : 'none',
                                                        opacity: d && d.isContinuation ? 0.85 : 1,
                                                    }}
                                                >
                                                    {d && d.isContinuation && (() => {
                                                        const pAct = ACTIVITY_TYPES.find((a) => a.id === d.activityType);
                                                        return pAct ? (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px 5px', borderRadius: 4, fontSize: 8.5, fontWeight: 700, fontStyle: 'italic', color: pAct.color, background: pAct.bg, borderLeft: `2px solid ${pAct.color}`, opacity: .65 }}>
                                                                {pAct.icon}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                    {act && (
                                                        <>
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '2px 5px', borderRadius: 4, fontSize: 9.5, fontWeight: 700, color: act.color, background: act.bg, borderLeft: `2px solid ${act.color}`, whiteSpace: 'nowrap', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {act.icon} {act.lbl}
                                                            </span>
                                                            {d.count > 1 && (
                                                                <span style={{ position: 'absolute', top: 2, right: 3, fontFamily: '"JetBrains Mono",monospace', fontSize: 9, fontWeight: 600, background: 'rgba(0,0,0,.12)', color: '#fff', borderRadius: 3, padding: '0 3px', lineHeight: 1.4 }}>{d.count}</span>
                                                            )}
                                                            {d.duration > 60 && (
                                                                <span style={{ position: 'absolute', bottom: 2, right: 3, fontFamily: '"JetBrains Mono",monospace', fontSize: 9, fontWeight: 600, background: 'rgba(0,0,0,.12)', color: '#fff', borderRadius: 3, padding: '0 3px', lineHeight: 1.4 }}>{d.duration / 60}h</span>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        {/* Stats columns */}
                                        {[
                                            { v: st.calls, cls: '#2563eb' }, { v: st.followups, cls: '#0891b2' }, { v: st.noshows, cls: '#dc2626' },
                                            { v: st.drips, cls: '#d97706' }, { v: st.physicalMtgs, cls: '#16a34a' }, { v: st.zoomMtgs, cls: '#4f46e5' }, { v: st.teamMtgs, cls: '#be185d' },
                                            { v: st.activeHrs, cls: '#44556a', suf: 'h' }, { v: st.meetHrs, cls: '#44556a', suf: 'h' },
                                        ].map((sv, i) => (
                                            <td key={i} style={{ ...S.td, width: 52, textAlign: 'center', background: '#fffcf0', borderRight: '1px solid #e5dab8', borderLeft: i === 0 ? '2px solid #dfd08a' : undefined }}>
                                                <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 600, color: sv.v === 0 ? '#c5d0df' : sv.cls }}>
                                                    {sv.v === 0 ? '—' : `${sv.v}${sv.suf || ''}`}
                                                </span>
                                            </td>
                                        ))}
                                        {/* Admission cell */}
                                        <td style={{ ...S.td, width: 60, textAlign: 'center', background: '#fdf2f8', borderRight: '1px solid #e5dab8' }}>
                                            {isTodaySelected ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={getAdmission(c._id) || ''}
                                                    placeholder="—"
                                                    onChange={(e) => handleAdmissionChange(c, e.target.value)}
                                                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', textAlign: 'center', fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 600, color: '#be185d', padding: '0 4px' }}
                                                />
                                            ) : (
                                                <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 600, color: getAdmission(c._id) > 0 ? '#be185d' : '#c5d0df' }}>
                                                    {getAdmission(c._id) || '—'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td style={{ background: '#1a2840', borderBottom: 'none', borderRight: '1px solid rgba(255,255,255,.07)', height: 34, position: 'sticky', left: 0, zIndex: 5 }} />
                                <td style={{ background: '#1a2840', borderBottom: 'none', borderRight: '1px solid rgba(255,255,255,.07)', height: 34, position: 'sticky', left: 34, zIndex: 5 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 6px' }}>TEAM TOTAL</span>
                                </td>
                                {SLOTS.map((s) => {
                                    if (s.isLunch) return <td key={s.id} style={{ background: '#1a2840', borderBottom: 'none', borderRight: '1px solid rgba(255,255,255,.07)', height: 34 }} />;
                                    let cnt = 0;
                                    consultants.forEach((c) => { const d = getAct(c._id, s.id); if (d && !d.isContinuation) cnt++; });
                                    return <td key={s.id} style={{ background: '#1a2840', borderBottom: 'none', borderRight: '1px solid rgba(255,255,255,.07)', height: 34, textAlign: 'center' }}>
                                        <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 13, fontWeight: 600, color: cnt === 0 ? 'rgba(255,255,255,.2)' : '#fff' }}>{cnt || '—'}</span>
                                    </td>;
                                })}
                                {[
                                    { v: teamTotals.calls, c: '#93c5fd' }, { v: teamTotals.followups, c: '#67e8f9' }, { v: teamTotals.noshows, c: '#fca5a5' },
                                    { v: teamTotals.drips, c: '#fcd34d' }, { v: teamTotals.physicalMtgs, c: '#86efac' }, { v: teamTotals.zoomMtgs, c: '#818cf8' }, { v: teamTotals.teamMtgs, c: '#f472b6' },
                                    { v: teamTotals.activeHrs, c: '#94a3b8', suf: 'h' }, { v: teamTotals.meetHrs, c: '#94a3b8', suf: 'h' },
                                ].map((sv, i) => (
                                    <td key={i} style={{ background: '#1a2840', borderBottom: 'none', borderRight: '1px solid rgba(255,255,255,.07)', height: 34, textAlign: 'center' }}>
                                        <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 13, fontWeight: 600, color: sv.v === 0 ? 'rgba(255,255,255,.2)' : sv.c }}>{sv.v === 0 ? '—' : `${sv.v}${sv.suf || ''}`}</span>
                                    </td>
                                ))}
                                {/* Admission total */}
                                <td style={{ background: '#1a2840', borderBottom: 'none', borderRight: '1px solid rgba(255,255,255,.07)', height: 34, textAlign: 'center' }}>
                                    <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 13, fontWeight: 600, color: getTotalAdmissions() === 0 ? 'rgba(255,255,255,.2)' : '#f9a8d4' }}>{getTotalAdmissions() || '—'}</span>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </Box>
            )}

            {/* ── MONTHLY VIEW ── */}
            {currentView === 'monthly' && (() => {
                const { rows, teamTot, daysInMonth } = getMonthlyStats();
                const prd = (r) => { const mx = r.days * 10; return mx > 0 ? Math.min(100, Math.round((r.activeHrs / mx) * 100)) : 0; };
                return (
                    <Box sx={{ flex: 1, overflow: 'auto', p: 2.5, '&::-webkit-scrollbar': { width: 6, height: 6 }, '&::-webkit-scrollbar-track': { background: '#f0f3f8' }, '&::-webkit-scrollbar-thumb': { background: '#c8d0de', borderRadius: 10 } }}>
                        {/* Month header + nav */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                            <Box>
                                <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#0d1520' }}>{MONTH_NAMES[monthReport.m]} {monthReport.y} — Monthly Report</Typography>
                                <Typography sx={{ fontSize: 12, color: '#8a9ab0', mt: 0.2 }}>Productivity summary across all {consultants.length} consultants · {daysInMonth} days tracked</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                                <IconButton size="small" onClick={() => setMonthReport((p) => { let m = p.m - 1, y = p.y; if (m < 0) { m = 11; y--; } return { y, m }; })} sx={{ width: 28, height: 28, borderRadius: '6px', border: '1px solid #c8d0de', background: '#fff', color: '#44556a' }}>
                                    <ChevronLeft fontSize="small" />
                                </IconButton>
                                <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0d1520', minWidth: 130, textAlign: 'center' }}>{MONTH_NAMES[monthReport.m]} {monthReport.y}</Typography>
                                <IconButton size="small" onClick={() => setMonthReport((p) => { let m = p.m + 1, y = p.y; if (m > 11) { m = 0; y++; } return { y, m }; })} sx={{ width: 28, height: 28, borderRadius: '6px', border: '1px solid #c8d0de', background: '#fff', color: '#44556a' }}>
                                    <ChevronRight fontSize="small" />
                                </IconButton>
                            </Box>
                        </Box>

                        {/* Summary cards */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(9,1fr)', gap: 1.2, mb: 2.5 }}>
                            {[
                                { v: teamTot.calls, l: 'Total Calls', sub: `avg ${consultants.length ? Math.round(teamTot.calls / consultants.length) : 0}/consultant`, c: '#2563eb', bc: '#2563eb' },
                                { v: teamTot.physicalMtgs, l: 'Offline Meetings', sub: 'physical + out', c: '#16a34a', bc: '#16a34a' },
                                { v: teamTot.zoomMtgs, l: 'Zoom', sub: 'virtual meetings', c: '#4f46e5', bc: '#4f46e5' },
                                { v: teamTot.teamMtgs, l: 'Team Meeting', sub: 'team meetings', c: '#be185d', bc: '#be185d' },
                                { v: teamTot.noshows, l: 'Operations', sub: 'total logged', c: '#dc2626', bc: '#dc2626' },
                                { v: teamTot.drips, l: 'Drip Steps', sub: 'campaigns executed', c: '#d97706', bc: '#d97706' },
                                { v: teamTot.followups, l: 'Follow-ups', sub: 'total sent', c: '#0891b2', bc: '#0891b2' },
                                { v: teamTot.admissions, l: 'Admissions', sub: 'total', c: '#be185d', bc: '#be185d' },
                                { v: `${teamTot.activeHrs}h`, l: 'Active Hours', sub: `${teamTot.days} consultant-days`, c: '#475569', bc: '#64748b' },
                            ].map((card) => (
                                <Box key={card.l} sx={{ background: '#fff', border: '1px solid #dde3ed', borderRadius: '11px', p: 1.5, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.07),0 2px 8px rgba(0,0,0,.05)', position: 'relative', overflow: 'hidden', '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: card.bc } }}>
                                    <Typography sx={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 26, fontWeight: 600, lineHeight: 1, mb: 0.5, color: card.c }}>{card.v}</Typography>
                                    <Typography sx={{ fontSize: 10, color: '#8a9ab0', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600 }}>{card.l}</Typography>
                                    <Typography sx={{ fontSize: 10, color: '#c5d0df', mt: 0.3, fontFamily: '"JetBrains Mono",monospace' }}>{card.sub}</Typography>
                                </Box>
                            ))}
                        </Box>

                        {/* Monthly table */}
                        <Box sx={{ background: '#fff', border: '1px solid #dde3ed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.07),0 2px 8px rgba(0,0,0,.05)' }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                <thead>
                                    <tr style={{ background: '#1a2840' }}>
                                        {[
                                            { l: '#', c: 'rgba(255,255,255,.3)', align: 'left', w: 40 },
                                            { l: 'Consultant', c: 'rgba(255,255,255,.7)', align: 'left', w: 160 },
                                            { l: 'Calls', c: '#93c5fd' }, { l: 'Follow-ups', c: '#67e8f9' }, { l: 'Operations', c: '#fca5a5' },
                                            { l: 'Drips', c: '#fcd34d' }, { l: 'Offline Meeting', c: '#86efac' }, { l: 'Zoom', c: '#818cf8' }, { l: 'Team Meeting', c: '#f472b6' },
                                            { l: 'Act Hrs', c: '#94a3b8' }, { l: 'Meeting Hrs', c: '#94a3b8' }, { l: 'Admissions', c: '#f9a8d4' }, { l: 'Days Active', c: '#e2e8f0' },
                                            { l: 'Productivity', c: '#c084fc' }, { l: 'Activity Heatmap', c: '#c084fc', w: 140 },
                                        ].map((h) => (
                                            <th key={h.l} style={{ padding: '9px 10px', textAlign: h.align || 'center', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: h.c, borderRight: '1px solid rgba(255,255,255,.07)', whiteSpace: 'nowrap', width: h.w || 'auto' }}>{h.l}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => {
                                        const p = prd(r);
                                        const anyData = r.calls + r.physicalMtgs + r.zoomMtgs + r.teamMtgs + r.noshows + r.drips + r.followups > 0;
                                        return (
                                            <tr key={r.consultant._id} style={{ borderBottom: '1px solid #dde3ed' }}>
                                                <td style={{ padding: '8px 10px', color: '#8a9ab0', fontFamily: '"JetBrains Mono",monospace', fontSize: 10, borderRight: '1px solid #dde3ed' }}>{i + 1}</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#0d1520', borderRight: '1px solid #dde3ed' }}>{r.consultant.name}</td>
                                                {[
                                                    { v: r.calls, c: '#2563eb' }, { v: r.followups, c: '#0891b2' }, { v: r.noshows, c: '#dc2626' },
                                                    { v: r.drips, c: '#d97706' }, { v: r.physicalMtgs, c: '#16a34a' }, { v: r.zoomMtgs, c: '#4f46e5' }, { v: r.teamMtgs, c: '#be185d' },
                                                    { v: r.activeHrs, c: '#44556a', suf: 'h' }, { v: r.meetHrs, c: '#44556a', suf: 'h' }, { v: r.admissions, c: '#be185d' },
                                                    { v: r.days, c: '#44556a' },
                                                ].map((sv, j) => (
                                                    <td key={j} style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, borderRight: '1px solid #dde3ed' }}>
                                                        <span style={{ fontFamily: '"JetBrains Mono",monospace', fontWeight: 600, fontSize: 13, color: sv.v > 0 ? sv.c : '#c5d0df' }}>
                                                            {sv.v > 0 ? `${sv.v}${sv.suf || ''}` : '—'}
                                                        </span>
                                                    </td>
                                                ))}
                                                <td style={{ padding: '8px 10px', borderRight: '1px solid #dde3ed' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <div style={{ flex: 1, height: 6, background: '#eef1f6', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                                                            <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#0ea5e9,#6366f1)', width: `${anyData ? p : 0}%`, transition: 'width .4s' }} />
                                                        </div>
                                                        <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, fontWeight: 600, color: '#44556a', whiteSpace: 'nowrap' }}>{anyData ? `${p}%` : '—'}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '8px 10px' }}>
                                                    <div style={{ display: 'flex', gap: 2, flexWrap: 'nowrap', overflow: 'hidden' }}>
                                                        {r.heatmap.map((v, hi) => (
                                                            <div key={hi} title={`Day ${hi + 1}: ${v} activities`} style={{ width: 10, height: 10, borderRadius: 2, flexShrink: 0, background: heatColor(v) }} />
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: '#1a2840' }}>
                                        <td style={{ padding: '9px 10px', color: '#fff', fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, borderRight: '1px solid rgba(255,255,255,.07)' }}>∑</td>
                                        <td style={{ padding: '9px 10px', textAlign: 'left', color: 'rgba(255,255,255,.6)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,.07)' }}>TEAM TOTAL</td>
                                        {[
                                            { v: teamTot.calls, c: '#93c5fd' }, { v: teamTot.followups, c: '#67e8f9' }, { v: teamTot.noshows, c: '#fca5a5' },
                                            { v: teamTot.drips, c: '#fcd34d' }, { v: teamTot.physicalMtgs, c: '#86efac' }, { v: teamTot.zoomMtgs, c: '#818cf8' }, { v: teamTot.teamMtgs, c: '#f472b6' },
                                            { v: teamTot.activeHrs, c: '#94a3b8', suf: 'h' }, { v: teamTot.meetHrs, c: '#94a3b8', suf: 'h' }, { v: teamTot.admissions, c: '#f9a8d4' },
                                            { v: teamTot.days, c: '#e2e8f0' },
                                        ].map((sv, i) => (
                                            <td key={i} style={{ padding: '9px 10px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.07)', fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: sv.v > 0 ? sv.c : 'rgba(255,255,255,.2)' }}>
                                                {sv.v > 0 ? `${sv.v}${sv.suf || ''}` : '—'}
                                            </td>
                                        ))}
                                        <td colSpan={2} style={{ borderRight: 'none' }} />
                                    </tr>
                                </tfoot>
                            </table>
                        </Box>
                    </Box>
                );
            })()}

            {/* ── PICKER MODAL ── */}
            <Dialog
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                PaperProps={{ sx: { borderRadius: '14px', p: 2, width: 340, maxWidth: '96vw' } }}
            >
                <DialogContent sx={{ p: 0 }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                        <Box>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0d1520' }}>Log Activity</Typography>
                            <Typography sx={{ fontSize: 11, color: '#8a9ab0', mt: 0.2 }}>
                                {pickerTarget?.consultant?.name || ''} · {(() => { const s = SLOTS.find((x) => x.id === pickerTarget?.slotId); return s ? `${s.lbl}–${s.end}` : ''; })()}
                            </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => setPickerOpen(false)} sx={{ width: 26, height: 26, borderRadius: '6px', border: '1px solid #dde3ed' }}>
                            ✕
                        </IconButton>
                    </Box>

                    {/* Activity type grid */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.7, mb: 1.5 }}>
                        {ACTIVITY_TYPES.map((a) => (
                            <Box
                                key={a.id}
                                onClick={() => setPickerType(a.id)}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 1, p: '8px 10px', borderRadius: '9px',
                                    border: `1.5px solid ${a.color}30`, color: a.color, background: a.bg,
                                    cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all .12s',
                                    outline: pickerType === a.id ? `2px solid ${a.color}` : 'none', outlineOffset: 2,
                                    '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 3px 10px rgba(0,0,0,.1)' },
                                }}
                            >
                                <span style={{ fontSize: 16, flexShrink: 0 }}>{a.icon}</span>{a.lbl}
                            </Box>
                        ))}
                    </Box>

                    {/* Count input */}
                    {pickerType && ACTIVITY_TYPES.find((a) => a.id === pickerType)?.hasCount && (
                        <Box sx={{ background: '#f7f9fc', border: '1px solid #dde3ed', borderRadius: '10px', p: 1.5, mb: 1.5 }}>
                            <Typography sx={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8a9ab0', mb: 0.7 }}>
                                Number of {ACTIVITY_TYPES.find((a) => a.id === pickerType)?.lbl}s
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Button size="small" onClick={() => setPickerCount((p) => Math.max(1, p - 1))} sx={{ minWidth: 30, width: 30, height: 30, borderRadius: '7px', border: '1px solid #c8d0de', background: '#fff', color: '#44556a', fontSize: 16, fontWeight: 700, p: 0 }}>−</Button>
                                <TextField
                                    type="number"
                                    value={pickerCount}
                                    onChange={(e) => setPickerCount(Math.max(1, Math.min(999, +e.target.value || 1)))}
                                    size="small"
                                    sx={{ width: 70, '& .MuiInputBase-input': { textAlign: 'center', fontFamily: '"JetBrains Mono",monospace', fontSize: 18, fontWeight: 600, p: '5px' } }}
                                />
                                <Button size="small" onClick={() => setPickerCount((p) => Math.min(999, p + 1))} sx={{ minWidth: 30, width: 30, height: 30, borderRadius: '7px', border: '1px solid #c8d0de', background: '#fff', color: '#44556a', fontSize: 16, fontWeight: 700, p: 0 }}>+</Button>
                                <Typography sx={{ fontSize: 12, color: '#8a9ab0', ml: 0.5 }}>{ACTIVITY_TYPES.find((a) => a.id === pickerType)?.unit || 'count'}</Typography>
                            </Box>
                        </Box>
                    )}

                    {/* Duration picker */}
                    {pickerType && ACTIVITY_TYPES.find((a) => a.id === pickerType)?.hasDur && (
                        <Box sx={{ background: '#f7f9fc', border: '1px solid #dde3ed', borderRadius: '10px', p: 1.5, mb: 1.5 }}>
                            <Typography sx={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8a9ab0', mb: 0.7 }}>Meeting Duration</Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0.5 }}>
                                {DURATIONS.map((d) => (
                                    <Box
                                        key={d.v}
                                        onClick={() => setPickerDur(d.v)}
                                        sx={{
                                            textAlign: 'center', p: '6px 3px', borderRadius: '7px',
                                            border: pickerDur === d.v ? '1.5px solid rgba(79,70,229,.35)' : '1.5px solid #dde3ed',
                                            cursor: 'pointer', fontSize: 11, fontWeight: 600,
                                            color: pickerDur === d.v ? '#4f46e5' : '#44556a',
                                            background: pickerDur === d.v ? '#eef2ff' : '#fff',
                                            transition: 'all .12s',
                                            '&:hover': { background: '#eef1f6', borderColor: '#c8d0de' },
                                        }}
                                    >
                                        {d.lbl}
                                        <span style={{ fontSize: 8.5, opacity: .7, display: 'block', marginTop: 1 }}>{d.sub}</span>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    )}

                    {/* Note */}
                    <Box sx={{ mb: 1.5 }}>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8a9ab0', mb: 0.4 }}>
                            Note <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                        </Typography>
                        <TextField
                            multiline
                            rows={2}
                            fullWidth
                            placeholder="e.g. prospect name, campaign, outcome..."
                            value={pickerNote}
                            onChange={(e) => setPickerNote(e.target.value)}
                            size="small"
                            sx={{ '& .MuiInputBase-root': { fontSize: 12 } }}
                        />
                    </Box>

                    {/* Footer buttons */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button onClick={handleClearSlot} disabled={loading} sx={{ px: 1.5, py: 1, border: '1px solid #c8d0de', borderRadius: '8px', color: '#8a9ab0', textTransform: 'none', fontSize: 13, '&:hover': { background: '#fee2e2', color: '#dc2626', borderColor: 'rgba(220,38,38,.3)' } }}>
                            Clear Slot
                        </Button>
                        <Button onClick={handleSave} disabled={loading || !pickerType} sx={{ flex: 1, py: 1, background: '#0ea5e9', borderRadius: '8px', color: '#fff', textTransform: 'none', fontSize: 13, fontWeight: 700, '&:hover': { background: '#0284c7', transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(14,165,233,.3)' }, '&:disabled': { background: '#c8d0de', color: '#fff' } }}>
                            Save
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>

            {/* ── MANAGE CONSULTANTS DIALOG (admin only) ── */}
            <Dialog
                open={manageOpen}
                onClose={() => setManageOpen(false)}
                PaperProps={{ sx: { borderRadius: '14px', p: 2, width: 420, maxWidth: '96vw', maxHeight: '80vh' } }}
            >
                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#0d1520' }}>Manage Consultants</Typography>
                        <IconButton size="small" onClick={() => setManageOpen(false)} sx={{ width: 26, height: 26, borderRadius: '6px', border: '1px solid #dde3ed' }}>✕</IconButton>
                    </Box>

                    {/* Add new consultant */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <TextField
                            size="small"
                            placeholder="Consultant name"
                            value={newConsultantName}
                            onChange={(e) => setNewConsultantName(e.target.value)}
                            sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 13 } }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddConsultant(); }}
                        />
                        <TextField
                            size="small"
                            placeholder="Team name"
                            value={newConsultantTeam}
                            onChange={(e) => setNewConsultantTeam(e.target.value)}
                            sx={{ width: 120, '& .MuiInputBase-input': { fontSize: 13 } }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddConsultant(); }}
                        />
                        <Button onClick={handleAddConsultant} variant="contained" size="small" sx={{ minWidth: 'auto', px: 1.5, background: '#0ea5e9', textTransform: 'none', fontWeight: 700, '&:hover': { background: '#0284c7' } }}>
                            <AddIcon sx={{ fontSize: 18 }} />
                        </Button>
                    </Box>

                    {/* Consultant list */}
                    <Box sx={{ maxHeight: 400, overflow: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: '#c8d0de', borderRadius: 10 } }}>
                        {consultants.map((c, i) => (
                            <Box key={c._id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.8, px: 1, borderBottom: '1px solid #eef1f6', '&:hover': { background: '#f7f9fc' }, borderRadius: '6px' }}>
                                <Box>
                                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#0d1520' }}>{i + 1}. {c.name}</Typography>
                                    <Typography sx={{ fontSize: 10, color: '#8a9ab0' }}>{c.teamName || c.teamLead?.teamName || ''}</Typography>
                                </Box>
                                <IconButton size="small" onClick={() => handleDeleteConsultant(c)} sx={{ color: '#c5d0df', '&:hover': { color: '#dc2626', background: '#fee2e2' } }}>
                                    <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>
                </DialogContent>
            </Dialog>

            {/* Toast */}
            <Snackbar
                open={toast.open}
                autoHideDuration={3000}
                onClose={() => setToast({ open: false, msg: '' })}
                message={toast.msg}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                ContentProps={{ sx: { background: '#0d1520', borderRadius: '8px', fontSize: 12, fontWeight: 500 } }}
            />
        </Box>
    );
};

export default HourlyTrackerPage;
