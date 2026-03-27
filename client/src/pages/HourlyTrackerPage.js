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
    MenuItem,
    Select,
    FormControl,
    CircularProgress,
    Drawer,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    ChevronLeft,
    ChevronRight,
    Add as AddIcon,
    Delete as DeleteIcon,
    PersonAdd as PersonAddIcon,
    Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import hourlyService from '../services/hourlyService';
import consultantService from '../services/consultantService';
import { exportToExcel, exportToCSV } from '../services/exportService';

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
    { id: 'call', icon: '📞', lbl: 'Call', hasCount: true, hasDur: false, color: '#2563eb', bg: '#eff6ff', unit: 'calls', multiWith: 'followup' },
    { id: 'followup', icon: '↩️', lbl: 'Follow-up', hasCount: true, hasDur: false, color: '#0891b2', bg: '#ecfeff', unit: 'follow-ups', multiWith: 'call' },
    { id: 'noshow', icon: '⚙️', lbl: 'Operations', hasCount: false, hasDur: false, color: '#dc2626', bg: '#fef2f2', noteRequired: true },
    { id: 'drip', icon: '📧', lbl: 'Drip', hasCount: false, hasDur: false, color: '#d97706', bg: '#fffbeb' },
    { id: 'meeting', icon: '🤝', lbl: 'Offline Meeting', hasCount: false, hasDur: true, color: '#16a34a', bg: '#f0fdf4' },
    { id: 'zoom', icon: '💻', lbl: 'Zoom', hasCount: false, hasDur: true, color: '#4f46e5', bg: '#eef2ff' },
    { id: 'outmeet', icon: '🚗', lbl: 'Out Meeting', hasCount: false, hasDur: true, color: '#7c3aed', bg: '#f5f3ff' },
    { id: 'teammeet', icon: '👥', lbl: 'Team Meeting', hasCount: false, hasDur: true, color: '#be185d', bg: '#fdf2f8' },
    { id: 'tlmeet', icon: '👔', lbl: "TL's Team Meeting", hasCount: false, hasDur: true, color: '#0d9488', bg: '#f0fdfa' },
];

// Display info for combined type (not shown in picker grid)
const COMBINED_TYPES = {
    call_followup: { icon: '📞↩️', lbl: 'Call+F/Up', color: '#2563eb', bg: '#eff6ff' },
};

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
    const [pickerTypes, setPickerTypes] = useState([]);
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
    const [selectedTeamLead, setSelectedTeamLead] = useState('');
    const [teamLeads, setTeamLeads] = useState([]);

    // Admin team & consultant filter
    const [teamFilter, setTeamFilter] = useState('all');
    const [consultantFilter, setConsultantFilter] = useState('all');

    // Org view drawer
    const [orgViewOpen, setOrgViewOpen] = useState(false);
    const [orgConsultants, setOrgConsultants] = useState([]);
    const [orgActivities, setOrgActivities] = useState(new Map());
    const [orgLoading, setOrgLoading] = useState(false);

    // Ops note viewer
    const [opsNoteOpen, setOpsNoteOpen] = useState(false);
    const [opsNoteContent, setOpsNoteContent] = useState({ name: '', notes: [] });

    // AI Analysis
    const [aiOpen, setAiOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState('');

    // Leaderboard
    const [lbOpen, setLbOpen] = useState(false);
    const [lbLoading, setLbLoading] = useState(false);
    const [lbData, setLbData] = useState('');

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

    const loadTeamLeads = useCallback(async () => {
        if (!isAdmin) return;
        try {
            const res = await hourlyService.getTeamLeads();
            const leads = (res.data || []).filter((u) => u.role === 'team_lead' && u.isActive);
            setTeamLeads(leads);
        } catch (err) {
            console.error('Failed to load team leads:', err);
        }
    }, [isAdmin]);

    useEffect(() => {
        loadConsultants();
        loadTeamLeads();
    }, [loadConsultants, loadTeamLeads]);

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
        let calls = 0, followups = 0, noshows = 0, drips = 0, offlineMtgs = 0, zoomMtgs = 0, outMtgs = 0, teamMtgs = 0, tlMtgs = 0, meetHrs = 0;
        WORK_SLOTS.forEach((s) => {
            const d = getAct(consultantId, s.id);
            if (!d || d.isContinuation) return;
            const mins = d.duration || s.mins;
            const hrs = mins / 60;
            if (d.activityType === 'call' || d.activityType === 'call_followup') calls += d.count || 1;
            if (d.activityType === 'followup' || d.activityType === 'call_followup') followups += d.count || 1;
            if (d.activityType === 'noshow') noshows++;
            if (d.activityType === 'drip') drips++;
            if (d.activityType === 'meeting') { offlineMtgs++; meetHrs += hrs; }
            if (d.activityType === 'outmeet') { outMtgs++; meetHrs += hrs; }
            if (d.activityType === 'zoom') { zoomMtgs++; meetHrs += hrs; }
            if (d.activityType === 'teammeet') { teamMtgs++; meetHrs += hrs; }
            if (d.activityType === 'tlmeet') { tlMtgs++; meetHrs += hrs; }
        });
        return { calls, followups, noshows, drips, offlineMtgs, zoomMtgs, outMtgs, teamMtgs, tlMtgs, meetHrs: +meetHrs.toFixed(1) };
    };

    const getTeamTotals = () => {
        const t = { calls: 0, followups: 0, noshows: 0, drips: 0, offlineMtgs: 0, zoomMtgs: 0, outMtgs: 0, teamMtgs: 0, tlMtgs: 0, meetHrs: 0 };
        consultants.forEach((c) => {
            const s = getStats(c._id);
            Object.keys(t).forEach((k) => (t[k] += s[k]));
        });
        t.meetHrs = +t.meetHrs.toFixed(1);
        return t;
    };

    // ─── ACTIONS ─────────────────────────────────────
    const isTodaySelected = isToday(currentDate);
    const canEdit = isTodaySelected || isAdmin; // Admins can edit any date

    const LOCKED_TYPES = ['call', 'followup', 'call_followup'];

    const handleCellClick = (consultant, slotId) => {
        if (!canEdit) { showToast('Entries can only be made for today'); return; }
        const existing = getAct(consultant._id, slotId);
        // Check if entry is locked (call/followup cannot be changed — admin can override)
        if (!isAdmin && existing && !existing.isContinuation && LOCKED_TYPES.includes(existing.activityType)) {
            showToast('Call and Follow-up entries cannot be modified once logged');
            return;
        }
        if (!isAdmin && existing && existing.isContinuation && existing.parentSlotId) {
            const parent = getAct(consultant._id, existing.parentSlotId);
            if (parent && LOCKED_TYPES.includes(parent.activityType)) {
                showToast('Call and Follow-up entries cannot be modified once logged');
                return;
            }
        }
        // If it's a continuation, open the parent
        const initFromActivity = (act) => {
            if (!act?.activityType) { setPickerTypes([]); return; }
            // Expand combined type back to array
            if (act.activityType === 'call_followup') setPickerTypes(['call', 'followup']);
            else setPickerTypes([act.activityType]);
        };
        if (existing && existing.isContinuation && existing.parentSlotId) {
            setPickerTarget({ consultant, slotId: existing.parentSlotId });
            const parent = getAct(consultant._id, existing.parentSlotId);
            initFromActivity(parent);
            setPickerDur(parent?.duration || 60);
            setPickerCount(parent?.count || 1);
            setPickerNote(parent?.note || '');
        } else {
            setPickerTarget({ consultant, slotId });
            initFromActivity(existing);
            setPickerDur(existing?.duration || 60);
            setPickerCount(existing?.count || 1);
            setPickerNote(existing?.note || '');
        }
        setPickerOpen(true);
    };

    const handleSave = async () => {
        if (!pickerTarget || pickerTypes.length === 0) { showToast('Select an activity type'); return; }
        // Check if operations is selected and note is required
        if (pickerTypes.includes('noshow') && !pickerNote.trim()) { showToast('Note is required for Operations'); return; }
        const { consultant, slotId } = pickerTarget;
        // Determine the stored activity type
        const isCallFollowup = pickerTypes.includes('call') && pickerTypes.includes('followup');
        const storedType = isCallFollowup ? 'call_followup' : pickerTypes[0];
        const act = ACTIVITY_TYPES.find((a) => a.id === pickerTypes[0]);
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
                activityType: storedType,
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
            showToast(err.response?.data?.message || err.message || 'Failed to save');
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

    const getNotesForType = (consultantId, actTypes) => {
        const notes = [];
        WORK_SLOTS.forEach((s) => {
            const d = getAct(consultantId, s.id);
            if (d && d.note && actTypes.includes(d.activityType)) {
                const act = ACTIVITY_TYPES.find((a) => a.id === d.activityType) || COMBINED_TYPES[d.activityType];
                notes.push({ slot: `${s.lbl}–${s.end}`, note: d.note, icon: act?.icon || '', lbl: act?.lbl || d.activityType });
            }
        });
        return notes;
    };

    const hasNotesForType = (consultantId, actTypes) => {
        return WORK_SLOTS.some((s) => {
            const d = getAct(consultantId, s.id);
            return d && d.note && actTypes.includes(d.activityType);
        });
    };

    const handleViewNotes = (consultant, actTypes, title) => {
        const notes = getNotesForType(consultant._id, actTypes);
        setOpsNoteContent({ name: `${consultant.name} — ${title}`, notes });
        setOpsNoteOpen(true);
    };

    const getAdmission = (consultantId) => admissions.get(consultantId) || 0;

    const handleAdmissionChange = async (consultant, value) => {
        if (!canEdit) return;
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
        if (!selectedTeamLead) { showToast('Select a team lead'); return; }
        const lead = teamLeads.find((l) => l._id === selectedTeamLead);
        try {
            await consultantService.createConsultant({
                name: newConsultantName.trim(),
                teamLead: selectedTeamLead,
                teamName: lead?.teamName || '',
            });
            setNewConsultantName('');
            setSelectedTeamLead('');
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
        if (!canEdit) { showToast('Can only clear today\'s data'); return; }
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

    // ─── EXPORT ──────────────────────────────────────
    const handleExport = (type) => {
        const dateStr = formatDateStr(currentDate);
        const dayLabel = currentDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

        if (currentView === 'daily') {
            const data = consultants.map((c, i) => {
                const st = getStats(c._id);
                const row = { '#': i + 1, 'Consultant': c.name };
                SLOTS.filter(s => !s.isLunch).forEach(s => {
                    const d = activities.get(`${c._id}_${s.id}`);
                    if (d && !d.isContinuation) {
                        const act = ACTIVITY_TYPES.find(a => a.id === d.activityType) || COMBINED_TYPES[d.activityType];
                        row[`${s.lbl}-${s.end}`] = act ? `${act.lbl}${d.count > 1 ? ` (${d.count})` : ''}${d.note ? ` [${d.note}]` : ''}` : '';
                    } else {
                        row[`${s.lbl}-${s.end}`] = '';
                    }
                });
                row['Calls'] = st.calls || '';
                row['Follow-Ups'] = st.followups || '';
                row['Operations'] = st.noshows || '';
                row['Drips'] = st.drips || '';
                row['Offline Meeting'] = st.offlineMtgs || '';
                row['Zoom'] = st.zoomMtgs || '';
                row['Out Meeting'] = st.outMtgs || '';
                row['Team Meeting'] = st.teamMtgs || '';
                row["TL's Team Meeting"] = st.tlMtgs || '';
                row['Meeting Hours'] = st.meetHrs ? `${st.meetHrs}h` : '';
                row['Admissions'] = getAdmission(c._id) || '';
                return row;
            });
            const filename = `Hourly_Tracker_${dateStr}`;
            type === 'xlsx' ? exportToExcel(data, filename) : exportToCSV(data, filename);
            showToast(`Exported ${type.toUpperCase()} — ${dayLabel}`);
        } else {
            const { rows } = getMonthlyStats();
            const data = rows.map((r, i) => ({
                '#': i + 1,
                'Consultant': r.consultant.name,
                'Calls': r.calls || '',
                'Follow-Ups': r.followups || '',
                'Operations': r.noshows || '',
                'Drips': r.drips || '',
                'Offline Meeting': r.offlineMtgs || '',
                'Zoom': r.zoomMtgs || '',
                'Out Meeting': r.outMtgs || '',
                'Team Meeting': r.teamMtgs || '',
                "TL's Team Meeting": r.tlMtgs || '',
                'Meeting Hours': r.meetHrs ? `${r.meetHrs}h` : '',
                'Admissions': r.admissions || '',
                'Days Active': r.days || '',
            }));
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const filename = `Hourly_Tracker_${monthNames[monthReport.m]}_${monthReport.y}`;
            type === 'xlsx' ? exportToExcel(data, filename) : exportToCSV(data, filename);
            showToast(`Exported ${type.toUpperCase()} — ${monthNames[monthReport.m]} ${monthReport.y}`);
        }
    };

    // ─── ORG VIEW ─────────────────────────────────────
    const openOrgView = async () => {
        setOrgViewOpen(true);
        setOrgLoading(true);
        try {
            const [cRes, aRes] = await Promise.all([
                hourlyService.getConsultants('org'),
                hourlyService.getDayActivities(formatDateStr(currentDate)),
            ]);
            setOrgConsultants(cRes.data || []);
            const m = new Map();
            (aRes.data || []).forEach((a) => m.set(`${a.consultant}_${a.slotId}`, a));
            setOrgActivities(m);
        } catch (err) {
            showToast('Failed to load organization data');
        }
        setOrgLoading(false);
    };

    const getOrgAct = (cId, slotId) => orgActivities.get(`${cId}_${slotId}`);

    const hasOrgNotesForType = (consultantId, actTypes) => {
        return WORK_SLOTS.some((s) => {
            const d = getOrgAct(consultantId, s.id);
            return d && d.note && actTypes.includes(d.activityType);
        });
    };

    const handleOrgViewNotes = (consultant, actTypes, title) => {
        const notes = [];
        WORK_SLOTS.forEach((s) => {
            const d = getOrgAct(consultant._id, s.id);
            if (d && d.note && actTypes.includes(d.activityType)) {
                const slot = SLOTS.find((x) => x.id === s.id);
                notes.push({ slot: slot ? `${slot.lbl}–${slot.end}` : s.id, note: d.note });
            }
        });
        setOpsNoteContent({ name: `${consultant.name} — ${title}`, notes });
        setOpsNoteOpen(true);
    };

    const getOrgStats = (consultantId) => {
        let calls = 0, followups = 0, noshows = 0, drips = 0, offlineMtgs = 0, zoomMtgs = 0, outMtgs = 0, teamMtgs = 0, tlMtgs = 0, meetHrs = 0;
        orgActivities.forEach((d) => {
            if (String(d.consultant) !== String(consultantId) || d.isContinuation) return;
            const hrs = (d.duration || 60) / 60;
            if (d.activityType === 'call' || d.activityType === 'call_followup') calls += d.count || 1;
            if (d.activityType === 'followup' || d.activityType === 'call_followup') followups += d.count || 1;
            if (d.activityType === 'noshow') noshows++;
            if (d.activityType === 'drip') drips++;
            if (d.activityType === 'meeting') { offlineMtgs++; meetHrs += hrs; }
            if (d.activityType === 'outmeet') { outMtgs++; meetHrs += hrs; }
            if (d.activityType === 'zoom') { zoomMtgs++; meetHrs += hrs; }
            if (d.activityType === 'teammeet') { teamMtgs++; meetHrs += hrs; }
            if (d.activityType === 'tlmeet') { tlMtgs++; meetHrs += hrs; }
        });
        return { calls, followups, noshows, drips, offlineMtgs, zoomMtgs, outMtgs, teamMtgs, tlMtgs, meetHrs: +meetHrs.toFixed(1) };
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

    const handleAIAnalysis = async () => {
        setAiLoading(true);
        setAiOpen(true);
        setAiAnalysis('');
        try {
            const res = await hourlyService.getAIAnalysis(formatDateStr(currentDate));
            setAiAnalysis(res.data || 'No analysis available');
        } catch (err) {
            setAiAnalysis(err.response?.data?.message || 'Failed to generate analysis');
        }
        setAiLoading(false);
    };

    const handleLeaderboard = async () => {
        setLbLoading(true);
        setLbOpen(true);
        setLbData('');
        try {
            const res = await hourlyService.getLeaderboard(formatDateStr(currentDate));
            setLbData(res.data || 'No data available');
        } catch (err) {
            setLbData(err.response?.data?.message || 'Failed to generate leaderboard');
        }
        setLbLoading(false);
    };

    // Admin team filter — derived list
    const displayConsultants = (() => {
        let list = consultants;
        if (isAdmin && teamFilter !== 'all') list = list.filter((c) => String(c.teamLead?._id) === teamFilter);
        if (isAdmin && consultantFilter !== 'all') list = list.filter((c) => String(c._id) === consultantFilter);
        return list;
    })();

    // ─── MONTHLY STATS ──────────────────────────────
    const getMonthlyStats = () => {
        const { y, m } = monthReport;
        const daysInMonth = new Date(y, m + 1, 0).getDate();

        const rows = displayConsultants.map((c) => {
            const r = { consultant: c, calls: 0, followups: 0, noshows: 0, drips: 0, offlineMtgs: 0, zoomMtgs: 0, outMtgs: 0, teamMtgs: 0, tlMtgs: 0, meetHrs: 0, admissions: 0, days: 0, heatmap: [], activeHrs: 0 };
            // Sum admissions for this consultant across the month
            monthAdmissions.filter((a) => String(a.consultant) === String(c._id)).forEach((a) => { r.admissions += a.count || 0; });
            for (let d = 1; d <= daysInMonth; d++) {
                let dayCalls = 0, dayOffline = 0, dayZoom = 0, dayOut = 0, dayTeam = 0, dayTlMeet = 0, dayFollowups = 0, dayNoshows = 0, dayDrips = 0, dayActiveHrs = 0, dayMeetHrs = 0;
                const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                monthActivities.filter((a) => String(a.consultant) === String(c._id) && a.date && a.date.startsWith(dateStr) && !a.isContinuation).forEach((a) => {
                    const mins = a.duration || 60;
                    const hrs = mins / 60;
                    dayActiveHrs += hrs;
                    if (a.activityType === 'call' || a.activityType === 'call_followup') dayCalls += a.count || 1;
                    if (a.activityType === 'followup' || a.activityType === 'call_followup') dayFollowups += a.count || 1;
                    if (a.activityType === 'noshow') dayNoshows++;
                    if (a.activityType === 'drip') dayDrips++;
                    if (a.activityType === 'meeting') { dayOffline++; dayMeetHrs += hrs; }
                    if (a.activityType === 'outmeet') { dayOut++; dayMeetHrs += hrs; }
                    if (a.activityType === 'zoom') { dayZoom++; dayMeetHrs += hrs; }
                    if (a.activityType === 'teammeet') { dayTeam++; dayMeetHrs += hrs; }
                    if (a.activityType === 'tlmeet') { dayTlMeet++; dayMeetHrs += hrs; }
                });
                r.calls += dayCalls; r.followups += dayFollowups; r.noshows += dayNoshows;
                r.drips += dayDrips; r.offlineMtgs += dayOffline; r.zoomMtgs += dayZoom; r.outMtgs += dayOut; r.teamMtgs += dayTeam; r.tlMtgs += dayTlMeet;
                r.activeHrs += dayActiveHrs; r.meetHrs += dayMeetHrs;
                const dayMeetings = dayOffline + dayZoom + dayOut + dayTeam + dayTlMeet;
                if (dayCalls + dayMeetings + dayFollowups + dayNoshows + dayDrips > 0) r.days++;
                r.heatmap.push(dayCalls + dayMeetings + dayDrips + dayFollowups);
            }
            r.activeHrs = +r.activeHrs.toFixed(1);
            r.meetHrs = +r.meetHrs.toFixed(1);
            return r;
        });

        const teamTot = { calls: 0, followups: 0, noshows: 0, drips: 0, offlineMtgs: 0, zoomMtgs: 0, outMtgs: 0, teamMtgs: 0, tlMtgs: 0, activeHrs: 0, meetHrs: 0, admissions: 0, days: 0 };
        rows.forEach((r) => {
            teamTot.calls += r.calls; teamTot.followups += r.followups; teamTot.noshows += r.noshows;
            teamTot.drips += r.drips; teamTot.offlineMtgs += r.offlineMtgs; teamTot.zoomMtgs += r.zoomMtgs; teamTot.outMtgs += r.outMtgs; teamTot.teamMtgs += r.teamMtgs; teamTot.tlMtgs += r.tlMtgs;
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
        hdrWrap: { background: '#faf8f5', position: 'relative', zIndex: 50, boxShadow: '0 2px 8px rgba(0,0,0,.08)', flexShrink: 0, borderBottom: '1px solid #e8e2d9' },
        hdr: { display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.8, flexWrap: 'wrap' },
        brand: { display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, mr: 0.5 },
        brandMark: { width: 30, height: 30, borderRadius: '7px', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff' },
        vtab: (active) => ({ px: 1.5, py: 0.5, borderRadius: '5px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: active ? 'rgba(0,0,0,.08)' : 'none', color: active ? '#1a1a1a' : '#8a8a8a', transition: 'all .15s', '&:hover': { background: 'rgba(0,0,0,.05)' }, minWidth: 'auto' }),
        kpi: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 90, minWidth: 90, maxWidth: 90, height: 56, px: 0.5, py: 0.4, borderRadius: '6px', background: 'rgba(0,0,0,.03)', border: '1px solid rgba(0,0,0,.06)', flexShrink: 0 },
        th: { background: '#243348', color: 'rgba(255,255,255,.7)', fontFamily: '"JetBrains Mono",monospace', fontSize: 10, fontWeight: 500, p: '5px 2px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.07)', whiteSpace: 'nowrap' },
        td: { borderRight: '1px solid #dde3ed', borderBottom: '1px solid #dde3ed', height: displayConsultants.length <= 3 ? 80 : displayConsultants.length <= 6 ? 64 : 52, verticalAlign: 'middle', p: 0 },
    };

    const teamTotals = currentView === 'daily' ? (() => {
        const t = { calls: 0, followups: 0, noshows: 0, drips: 0, offlineMtgs: 0, zoomMtgs: 0, outMtgs: 0, teamMtgs: 0, tlMtgs: 0, meetHrs: 0 };
        displayConsultants.forEach((c) => {
            const s = getStats(c._id);
            Object.keys(t).forEach((k) => (t[k] += s[k]));
        });
        t.meetHrs = +t.meetHrs.toFixed(1);
        return t;
    })() : {};

    // ─── RENDER ──────────────────────────────────────
    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f0f3f8', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
            {/* ── HEADER ── */}
            <Box sx={S.hdrWrap}>
                {/* Row 1: brand, tabs, date nav */}
                <Box sx={S.hdr}>
                    <Tooltip title="Back to Dashboard">
                        <IconButton size="small" onClick={() => navigate(user?.role === 'admin' ? '/admin/dashboard' : '/team-lead/dashboard')} sx={{ color: '#6b7280', p: 0.5 }}>
                            <ArrowBackIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>
                    <Box sx={S.brand}>
                        <img src="/LUC-new-logo-svg-1.svg" alt="Logo" style={{ height: 32, width: 'auto' }} />
                        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a', whiteSpace: 'nowrap' }}>
                            Hourly Tracker
                        </Typography>
                    </Box>

                    <Box sx={{ width: '1px', height: 24, background: 'rgba(0,0,0,.1)', flexShrink: 0 }} />

                    {/* View tabs */}
                    <Box sx={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,.04)', border: '1px solid rgba(0,0,0,.08)', borderRadius: '8px', p: '3px', flexShrink: 0 }}>
                        <Button sx={S.vtab(currentView === 'daily')} onClick={() => setCurrentView('daily')}>📅 Daily</Button>
                        <Button sx={S.vtab(currentView === 'monthly')} onClick={() => setCurrentView('monthly')}>📊 Monthly</Button>
                    </Box>
                    <Button
                        onClick={openOrgView}
                        sx={{ px: 1.5, py: 0.5, borderRadius: '8px', fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', textTransform: 'none', minWidth: 'auto', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(99,102,241,.3)', '&:hover': { background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 3px 10px rgba(99,102,241,.4)' } }}
                    >
                        🏢 View Organization
                    </Button>

                    <Box sx={{ width: '1px', height: 24, background: 'rgba(0,0,0,.1)', flexShrink: 0 }} />

                    {/* Date nav */}
                    {currentView === 'daily' && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            <IconButton size="small" onClick={() => shiftDate(-1)} sx={{ width: 26, height: 26, borderRadius: '6px', border: '1px solid rgba(0,0,0,.12)', background: 'rgba(0,0,0,.04)', color: '#6b7280', '&:hover': { background: 'rgba(0,0,0,.08)', color: '#1a1a1a' } }}>
                                <ChevronLeft sx={{ fontSize: 16 }} />
                            </IconButton>
                            <Box onClick={() => dateInputRef.current?.showPicker()} sx={{ px: '10px', py: '4px', borderRadius: '6px', background: 'rgba(0,0,0,.05)', border: '1px solid rgba(0,0,0,.1)', fontSize: 12, fontWeight: 600, color: '#1a1a1a', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { background: 'rgba(0,0,0,.08)' } }}>
                                {`${DAYS[currentDate.getDay()]}, ${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
                            </Box>
                            <input
                                type="date"
                                ref={dateInputRef}
                                value={formatDateStr(currentDate)}
                                onChange={(e) => { if (e.target.value) { const [y, m, d] = e.target.value.split('-').map(Number); setCurrentDate(new Date(y, m - 1, d)); } }}
                                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
                            />
                            <IconButton size="small" onClick={() => shiftDate(1)} sx={{ width: 26, height: 26, borderRadius: '6px', border: '1px solid rgba(0,0,0,.12)', background: 'rgba(0,0,0,.04)', color: '#6b7280', '&:hover': { background: 'rgba(0,0,0,.08)', color: '#1a1a1a' } }}>
                                <ChevronRight sx={{ fontSize: 16 }} />
                            </IconButton>
                            <Button size="small" onClick={goToday} sx={{ px: '10px', py: '4px', borderRadius: '6px', border: '1px solid rgba(0,0,0,.12)', color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'none', minWidth: 'auto', lineHeight: 1, '&:hover': { background: 'rgba(0,0,0,.06)', color: '#1a1a1a' } }}>
                                Today
                            </Button>
                        </Box>
                    )}

                    {/* Admin team filter */}
                    {isAdmin && (
                        <>
                            <Box sx={{ width: '1px', height: 24, background: 'rgba(0,0,0,.1)', flexShrink: 0 }} />
                            <FormControl size="small" sx={{ minWidth: 140, flexShrink: 0 }}>
                                <Select
                                    value={teamFilter}
                                    onChange={(e) => { setTeamFilter(e.target.value); setConsultantFilter('all'); }}
                                    sx={{ fontSize: 12, fontWeight: 600, borderRadius: '8px', height: 32, '& .MuiSelect-select': { py: '4px', px: '10px' } }}
                                >
                                    <MenuItem value="all" sx={{ fontSize: 12 }}>All Teams</MenuItem>
                                    {teamLeads.map((tl) => (
                                        <MenuItem key={tl._id} value={tl._id} sx={{ fontSize: 12 }}>{tl.teamName || tl.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ minWidth: 150, flexShrink: 0 }}>
                                <Select
                                    value={consultantFilter}
                                    onChange={(e) => setConsultantFilter(e.target.value)}
                                    sx={{ fontSize: 12, fontWeight: 600, borderRadius: '8px', height: 32, '& .MuiSelect-select': { py: '4px', px: '10px' } }}
                                >
                                    <MenuItem value="all" sx={{ fontSize: 12 }}>All Consultants</MenuItem>
                                    {(teamFilter !== 'all' ? consultants.filter((c) => String(c.teamLead?._id) === teamFilter) : consultants).map((c) => (
                                        <MenuItem key={c._id} value={c._id} sx={{ fontSize: 12 }}>{c.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </>
                    )}

                    <Box sx={{ flex: 1 }} />

                    {currentView === 'daily' && !canEdit && (
                        <Box sx={{ px: '11px', py: '4px', borderRadius: '6px', border: '1px solid #f59e0b', background: '#fffbeb', fontSize: 10, fontWeight: 600, color: '#b45309', flexShrink: 0 }}>
                            View Only
                        </Box>
                    )}

                </Box>

                {/* Row 2: Action buttons — full width */}
                <Box sx={{ display: 'flex', gap: '6px', px: 2, pb: 0.8, flexWrap: 'wrap' }}>
                    {[
                        { label: '🤖 AI Analysis', onClick: handleAIAnalysis },
                        { label: '🏆 Leaderboard', onClick: handleLeaderboard },
                        { label: '📥 Export XLSX', onClick: () => handleExport('xlsx') },
                        { label: '📄 Export CSV', onClick: () => handleExport('csv') },
                        ...(isAdmin ? [{ label: '👥 Manage Consultants', onClick: () => setManageOpen(true) }] : []),
                        ...(currentView === 'daily' && canEdit && isAdmin ? [{ label: '✕ Clear Day', onClick: handleClearDay, danger: true }] : []),
                    ].map((btn) => (
                        <Button
                            key={btn.label}
                            size="small"
                            onClick={btn.onClick}
                            sx={{
                                flex: 1, px: 1.5, py: 0.7, borderRadius: '8px',
                                border: btn.danger ? '1px solid #fca5a5' : '1px solid rgba(0,0,0,.1)',
                                background: btn.danger ? '#fff5f5' : 'rgba(0,0,0,.03)',
                                color: btn.danger ? '#dc2626' : '#4b5563', fontSize: 12, fontWeight: 600,
                                textTransform: 'none', minWidth: 0, lineHeight: 1.3,
                                '&:hover': btn.danger
                                    ? { background: '#fee2e2', borderColor: '#f87171' }
                                    : { background: 'rgba(0,0,0,.07)', color: '#1a1a1a' },
                            }}
                        >
                            {btn.label}
                        </Button>
                    ))}
                    <Tooltip
                        title={
                            <Box sx={{ p: 1, maxWidth: 320, fontSize: 11, lineHeight: 1.6 }}>
                                <Box sx={{ fontWeight: 700, fontSize: 12, mb: 0.5 }}>How Leaderboard Rankings Work</Box>
                                <Box sx={{ mb: 0.5 }}>AI calculates a score out of 100 using weighted criteria:</Box>
                                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                    <li><b>Admissions</b> — Highest weight</li>
                                    <li><b>Meetings</b> — High weight</li>
                                    <li><b>Follow-ups / Calls</b> — Medium weight</li>
                                    <li><b>Drips</b> — Lower weight</li>
                                    <li><b>Operations</b> — Penalty</li>
                                </Box>
                            </Box>
                        }
                        arrow
                        placement="bottom"
                    >
                        <Button size="small" sx={{ px: 1.5, py: 0.7, borderRadius: '8px', border: '1px solid rgba(0,0,0,.1)', background: 'rgba(0,0,0,.03)', color: '#4b5563', fontSize: 12, fontWeight: 600, textTransform: 'none', minWidth: 0, lineHeight: 1.3, '&:hover': { background: 'rgba(0,0,0,.07)', color: '#1a1a1a' } }}>
                            ℹ️ Ranking Info
                        </Button>
                    </Tooltip>
                </Box>

                {/* Bottom row: KPIs */}
                {currentView === 'daily' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', px: 2, pb: 1, pt: 0.3 }}>
                        {[
                            { v: teamTotals.calls, l: 'Calls', c: '#2563eb' },
                            { v: teamTotals.followups, l: 'Follow-ups', c: '#0891b2' },
                            { v: teamTotals.noshows, l: 'Operations', c: '#dc2626' },
                            { v: teamTotals.drips, l: 'Drips', c: '#d97706' },
                            { v: teamTotals.offlineMtgs, l: 'Offline Meeting', c: '#16a34a' },
                            { v: teamTotals.zoomMtgs, l: 'Zoom', c: '#4f46e5' },
                            { v: teamTotals.outMtgs, l: 'Out Meeting', c: '#7c3aed' },
                            { v: teamTotals.tlMtgs, l: "TL's Team Mtg", c: '#0d9488' },
                            { v: getTotalAdmissions(), l: 'Admissions', c: '#be185d' },
                        ].map((kpi) => (
                            <Box key={kpi.l} sx={{ ...S.kpi, flex: 1, width: 'auto', minWidth: 0, maxWidth: 'none' }}>
                                <Typography sx={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 18, fontWeight: 700, color: kpi.c, lineHeight: 1.2 }}>{kpi.v}</Typography>
                                <Typography sx={{ fontSize: 8, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{kpi.l}</Typography>
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>

            {/* ── DAILY VIEW ── */}
            {currentView === 'daily' && (
                <Box sx={{ flex: 1, overflow: 'auto', '&::-webkit-scrollbar': { width: 10, height: 12 }, '&::-webkit-scrollbar-track': { background: '#e8ecf2' }, '&::-webkit-scrollbar-thumb': { background: '#9aa5b8', borderRadius: 10, '&:hover': { background: '#7a8598' } } }}>
                    <table style={{ borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 30 }}>
                            {/* Group header */}
                            <tr>
                                <th style={{ width: 34, minWidth: 34, background: '#1a2840', border: 'none', position: 'sticky', left: 0, zIndex: 40 }} />
                                <th style={{ width: 160, minWidth: 160, background: '#1a2840', border: 'none', position: 'sticky', left: 34, zIndex: 40 }} />
                                <th colSpan={AM_SLOTS.length} style={{ background: '#1e3055', color: '#93c5fd', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '5px 3px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.06)' }}>
                                    MORNING 9:30-1:00
                                </th>
                                <th colSpan={1} style={{ background: '#1c1c28', color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '5px 3px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.06)' }}>
                                    LUNCH
                                </th>
                                <th colSpan={PM_SLOTS.length} style={{ background: '#1a3328', color: '#86efac', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '5px 3px', textAlign: 'center' }}>
                                    AFTERNOON 2:00-7:30
                                </th>
                                <th colSpan={11} style={{ background: '#2a2010', color: '#fcd34d', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '5px 3px', textAlign: 'center', borderLeft: '2px solid #dfd08a' }}>
                                    DAILY SUMMARY
                                </th>
                            </tr>
                            {/* Slot header */}
                            <tr>
                                <th style={{ width: 34, minWidth: 34, background: '#1a2535', color: 'rgba(255,255,255,.3)', fontSize: 9, padding: '5px 2px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.07)', position: 'sticky', left: 0, zIndex: 40 }}>#</th>
                                <th style={{ width: 160, minWidth: 160, background: '#1a2535', color: 'rgba(255,255,255,.6)', fontSize: 10, padding: '0 8px', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,.07)', position: 'sticky', left: 34, zIndex: 40 }}>CONSULTANT</th>
                                {SLOTS.map((s) => {
                                    const isCur = s.id === curSlot;
                                    if (s.isLunch) {
                                        return <th key={s.id} style={{ minWidth: 58, background: isCur ? '#1a3a52' : '#1e1e2e', color: isCur ? '#7dd3fc' : '#fff', fontSize: 14, fontWeight: 700, padding: '8px 2px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.07)', boxShadow: isCur ? 'inset 0 -2px 0 #38bdf8' : 'none' }}>1:00<br /><span style={{ fontSize: 13, fontWeight: 600 }}>2:00</span></th>;
                                    }
                                    return <th key={s.id} style={{ minWidth: 125, background: isCur ? '#1a3a52' : '#243348', color: isCur ? '#7dd3fc' : '#fff', fontFamily: '"JetBrains Mono",monospace', fontSize: 14, fontWeight: 700, padding: '8px 2px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.07)', boxShadow: isCur ? 'inset 0 -2px 0 #38bdf8' : 'none' }}>{s.lbl}<br /><span style={{ fontSize: 13, fontWeight: 600 }}>{s.end}</span></th>;
                                })}
                                {[
                                    { l: 'CALLS', c: '#93c5fd' }, { l: 'FOLLOW-UPS', c: '#67e8f9' }, { l: 'OPERATIONS', c: '#fca5a5' },
                                    { l: 'DRIPS', c: '#fcd34d' }, { l: 'OFFLINE MEETING', c: '#86efac' }, { l: 'ZOOM', c: '#818cf8' }, { l: 'OUT MEETING', c: '#a78bfa' }, { l: 'TEAM MEETING', c: '#f472b6' }, { l: "TL'S TEAM MTG", c: '#5eead4' },
                                    { l: 'MEETING HOURS', c: '#94a3b8' }, { l: 'ADMISSIONS', c: '#f9a8d4' },
                                ].map((h) => (
                                    <th key={h.l} style={{ minWidth: 80, background: '#2a2010', color: h.c, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', padding: '8px 10px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.07)', whiteSpace: 'nowrap' }}>{h.l}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayConsultants.map((c, idx) => {
                                const st = getStats(c._id);
                                return (
                                    <tr key={c._id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfd' }}>
                                        <td style={{ ...S.td, width: 34, minWidth: 34, textAlign: 'center', fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: '#8a9ab0', background: '#f6f8fc', borderRight: '1px solid #c8d0de', position: 'sticky', left: 0, zIndex: 5 }}>{idx + 1}</td>
                                        <td style={{ ...S.td, width: 160, minWidth: 160, background: '#f6f8fc', borderRight: '2px solid #c8d0de', padding: '0 7px', position: 'sticky', left: 34, zIndex: 5 }}>
                                            <Tooltip title={c.teamLead?.name ? `Team: ${c.teamName || c.teamLead.teamName || ''}` : ''} placement="right">
                                                <div style={{ fontSize: displayConsultants.length <= 3 ? 17 : 15, fontWeight: 600, color: '#0d1520', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {c.name}
                                                </div>
                                            </Tooltip>
                                        </td>
                                        {SLOTS.map((s) => {
                                            if (s.isLunch) {
                                                return (
                                                    <td key={s.id} style={{ ...S.td, width: 58, textAlign: 'center', background: '#fef9ec', cursor: 'default' }}>
                                                        <span style={{ fontSize: 18 }}>🍽</span>
                                                    </td>
                                                );
                                            }
                                            const d = getAct(c._id, s.id);
                                            const act = d && !d.isContinuation ? (ACTIVITY_TYPES.find((a) => a.id === d.activityType) || COMBINED_TYPES[d.activityType] || null) : null;
                                            const isCur = s.id === curSlot;
                                            const isAM = ['s0930','s1030','s1130','s1230'].includes(s.id);
                                            const emptyBg = isAM ? '#f0f5ff' : '#fffdf0';
                                            const isLocked = !isAdmin && d && !d.isContinuation && LOCKED_TYPES.includes(d.activityType);
                                            return (
                                                <td
                                                    key={s.id}
                                                    onClick={() => handleCellClick(c, s.id)}
                                                    style={{
                                                        ...S.td,
                                                        minWidth: 125,
                                                        textAlign: 'center',
                                                        cursor: isLocked ? 'not-allowed' : (canEdit ? 'pointer' : 'default'),
                                                        position: 'relative',
                                                        overflow: 'hidden',
                                                        background: d ? (act ? act.bg : emptyBg) : emptyBg,
                                                        boxShadow: isCur ? 'inset 0 0 0 2px rgba(14,165,233,.35)' : 'none',
                                                        opacity: d && d.isContinuation ? 0.85 : 1,
                                                    }}
                                                >
                                                    {d && d.isContinuation && (() => {
                                                        const pAct = ACTIVITY_TYPES.find((a) => a.id === d.activityType) || COMBINED_TYPES[d.activityType];
                                                        return pAct ? (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px 5px', borderRadius: 4, fontSize: 8.5, fontWeight: 700, fontStyle: 'italic', color: pAct.color, background: pAct.bg, borderLeft: `2px solid ${pAct.color}`, opacity: .65 }}>
                                                                {pAct.icon}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                    {act && (
                                                        <>
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: displayConsultants.length <= 3 ? '5px 10px' : '3px 7px', borderRadius: 5, fontSize: displayConsultants.length <= 3 ? 13 : displayConsultants.length <= 6 ? 12 : 11, fontWeight: 700, color: act.color, background: act.bg, borderLeft: `2px solid ${act.color}`, whiteSpace: 'nowrap' }}>
                                                                {act.icon} {act.lbl}
                                                            </span>
                                                            {isLocked && (
                                                                <span style={{ position: 'absolute', top: 2, left: 3, fontSize: 8, opacity: 0.5 }}>🔒</span>
                                                            )}
                                                            {d.count > 1 && (
                                                                <span style={{ position: 'absolute', top: 2, right: 3, fontFamily: '"JetBrains Mono",monospace', fontSize: 11, fontWeight: 800, background: '#334155', color: '#fff', borderRadius: 4, padding: '1px 5px', lineHeight: 1.4, boxShadow: '0 1px 3px rgba(0,0,0,.25)' }}>{d.count}</span>
                                                            )}
                                                            {d.duration > 60 && (
                                                                <span style={{ position: 'absolute', bottom: 2, right: 3, fontFamily: '"JetBrains Mono",monospace', fontSize: 11, fontWeight: 800, background: '#334155', color: '#fff', borderRadius: 4, padding: '1px 5px', lineHeight: 1.4, boxShadow: '0 1px 3px rgba(0,0,0,.25)' }}>{d.duration / 60}h</span>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        {[
                                            { v: st.calls, cls: '#2563eb', types: ['call', 'call_followup'], title: 'Calls' },
                                            { v: st.followups, cls: '#0891b2', types: ['followup', 'call_followup'], title: 'Follow-ups' },
                                            { v: st.noshows, cls: '#dc2626', types: ['noshow'], title: 'Operations' },
                                            { v: st.drips, cls: '#d97706', types: ['drip'], title: 'Drips' },
                                            { v: st.offlineMtgs, cls: '#16a34a', types: ['meeting'], title: 'Offline Meeting' },
                                            { v: st.zoomMtgs, cls: '#4f46e5', types: ['zoom'], title: 'Zoom' },
                                            { v: st.outMtgs, cls: '#7c3aed', types: ['outmeet'], title: 'Out Meeting' },
                                            { v: st.teamMtgs, cls: '#be185d', types: ['teammeet'], title: 'Team Meeting' },
                                            { v: st.tlMtgs, cls: '#0d9488', types: ['tlmeet'], title: "TL's Team Meeting" },
                                            { v: st.meetHrs, cls: '#44556a', suf: 'h' },
                                        ].map((sv, i) => (
                                            <td key={i} style={{ minWidth: 80, padding: '8px 10px', textAlign: 'center', borderRight: '1px solid #e5dab8', borderBottom: '1px solid #efe6cc' }}>
                                                <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 15, fontWeight: 600, color: sv.v === 0 ? '#d4c9a8' : sv.cls }}>
                                                    {sv.v === 0 ? '—' : `${sv.v}${sv.suf || ''}`}
                                                </span>
                                                {sv.types && hasNotesForType(c._id, sv.types) && (
                                                    <VisibilityIcon
                                                        onClick={() => handleViewNotes(c, sv.types, sv.title)}
                                                        sx={{ fontSize: 14, color: sv.cls, ml: 0.4, cursor: 'pointer', verticalAlign: 'middle', opacity: 0.5, '&:hover': { opacity: 1 } }}
                                                    />
                                                )}
                                            </td>
                                        ))}
                                        <td style={{ minWidth: 80, width: 80, padding: '8px 10px', textAlign: 'center', borderRight: '1px solid #e5dab8', borderBottom: '1px solid #efe6cc', background: '#fdf2f8', verticalAlign: 'middle' }}>
                                            {canEdit ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={getAdmission(c._id) || ''}
                                                    placeholder="—"
                                                    onChange={(e) => handleAdmissionChange(c, e.target.value)}
                                                    style={{ width: 50, border: 'none', outline: 'none', background: 'transparent', textAlign: 'center', fontFamily: '"JetBrains Mono",monospace', fontSize: 15, fontWeight: 600, color: '#be185d' }}
                                                />
                                            ) : (
                                                <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 15, fontWeight: 600, color: getAdmission(c._id) > 0 ? '#be185d' : '#d4c9a8' }}>
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
                                    displayConsultants.forEach((c) => { const d = getAct(c._id, s.id); if (d && !d.isContinuation) cnt++; });
                                    return <td key={s.id} style={{ background: '#1a2840', borderBottom: 'none', borderRight: '1px solid rgba(255,255,255,.07)', height: 34, textAlign: 'center' }}>
                                        <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 13, fontWeight: 600, color: cnt === 0 ? 'rgba(255,255,255,.2)' : '#fff' }}>{cnt || '—'}</span>
                                    </td>;
                                })}
                                {[
                                    { v: teamTotals.calls, c: '#93c5fd' }, { v: teamTotals.followups, c: '#67e8f9' }, { v: teamTotals.noshows, c: '#fca5a5' },
                                    { v: teamTotals.drips, c: '#fcd34d' }, { v: teamTotals.offlineMtgs, c: '#86efac' }, { v: teamTotals.zoomMtgs, c: '#818cf8' }, { v: teamTotals.outMtgs, c: '#a78bfa' }, { v: 0, c: '#f472b6', hide: true }, { v: 0, c: '#5eead4', hide: true },
                                    { v: teamTotals.meetHrs, c: '#94a3b8', suf: 'h' },
                                ].map((sv, i) => (
                                    <td key={i} style={{ minWidth: 80, background: '#1a2840', borderBottom: 'none', height: 40, textAlign: 'center' }}>
                                        <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 16, fontWeight: 700, color: sv.v === 0 ? 'rgba(255,255,255,.2)' : sv.c }}>{sv.v === 0 ? '—' : `${sv.v}${sv.suf || ''}`}</span>
                                    </td>
                                ))}
                                <td style={{ minWidth: 80, background: '#1a2840', borderBottom: 'none', height: 40, textAlign: 'center' }}>
                                    <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 16, fontWeight: 700, color: getTotalAdmissions() === 0 ? 'rgba(255,255,255,.2)' : '#f9a8d4' }}>{getTotalAdmissions() || '—'}</span>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </Box>
            )}

            {/* ── MONTHLY VIEW ── */}
            {currentView === 'monthly' && (() => {
                const { rows, teamTot, daysInMonth } = getMonthlyStats();
                return (
                    <Box sx={{ flex: 1, overflow: 'auto', p: 2.5, '&::-webkit-scrollbar': { width: 10, height: 12 }, '&::-webkit-scrollbar-track': { background: '#e8ecf2' }, '&::-webkit-scrollbar-thumb': { background: '#9aa5b8', borderRadius: 10, '&:hover': { background: '#7a8598' } } }}>
                        {/* Month header + nav */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                            <Box>
                                <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#0d1520' }}>{MONTH_NAMES[monthReport.m]} {monthReport.y} — Monthly Report</Typography>
                                <Typography sx={{ fontSize: 12, color: '#8a9ab0', mt: 0.2 }}>Productivity summary across all {displayConsultants.length} consultants · {daysInMonth} days tracked</Typography>
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
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 1.2, mb: 2.5 }}>
                            {[
                                { v: teamTot.calls, l: 'Total Calls', sub: `Average ${displayConsultants.length ? Math.round(teamTot.calls / displayConsultants.length) : 0} / Consultant`, c: '#2563eb', bc: '#2563eb' },
                                { v: teamTot.followups, l: 'Follow-Ups', sub: `Average ${displayConsultants.length ? Math.round(teamTot.followups / displayConsultants.length) : 0} / Consultant`, c: '#0891b2', bc: '#0891b2' },
                                { v: teamTot.offlineMtgs, l: 'Offline Meetings', sub: 'Physical Meetings', c: '#16a34a', bc: '#16a34a' },
                                { v: teamTot.zoomMtgs, l: 'Zoom', sub: 'Virtual Meetings', c: '#4f46e5', bc: '#4f46e5' },
                                { v: teamTot.outMtgs, l: 'Out Meetings', sub: 'Outside Meetings', c: '#7c3aed', bc: '#7c3aed' },
                                { v: teamTot.noshows, l: 'Operations', sub: 'Total Logged', c: '#dc2626', bc: '#dc2626' },
                                { v: teamTot.drips, l: 'Drip Steps', sub: 'Campaigns Executed', c: '#d97706', bc: '#d97706' },
                                { v: teamTot.tlMtgs, l: "TL's Team Meeting", sub: 'Team Lead Meetings', c: '#0d9488', bc: '#0d9488' },
                                { v: teamTot.admissions, l: 'Admissions', sub: 'Total', c: '#be185d', bc: '#be185d' },
                            ].map((card) => (
                                <Box key={card.l} sx={{ background: '#fff', border: '1px solid #dde3ed', borderRadius: '11px', p: 1.5, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.07),0 2px 8px rgba(0,0,0,.05)', position: 'relative', overflow: 'hidden', '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: card.bc } }}>
                                    <Typography sx={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 26, fontWeight: 600, lineHeight: 1, mb: 0.5, color: card.c }}>{card.v}</Typography>
                                    <Typography sx={{ fontSize: 10, color: '#8a9ab0', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600 }}>{card.l}</Typography>
                                    <Typography sx={{ fontSize: 12, color: '#1a1a1a', mt: 0.3, fontWeight: 600, fontFamily: '"JetBrains Mono",monospace' }}>{card.sub}</Typography>
                                </Box>
                            ))}
                        </Box>

                        {/* Monthly table */}
                        <Box sx={{ background: '#fff', border: '1px solid #dde3ed', borderRadius: '12px', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,.07),0 2px 8px rgba(0,0,0,.05)', '&::-webkit-scrollbar': { height: 12 }, '&::-webkit-scrollbar-track': { background: '#e8ecf2' }, '&::-webkit-scrollbar-thumb': { background: '#9aa5b8', borderRadius: 10, '&:hover': { background: '#7a8598' } } }}>
                            <table style={{ borderCollapse: 'collapse', minWidth: 1200 }}>
                                <thead>
                                    <tr style={{ background: '#1a2840' }}>
                                        {[
                                            { l: '#', c: 'rgba(255,255,255,.3)', align: 'left', w: 40 },
                                            { l: 'Consultant', c: 'rgba(255,255,255,.7)', align: 'left', w: 160 },
                                            { l: 'Calls', c: '#93c5fd' }, { l: 'Follow-ups', c: '#67e8f9' }, { l: 'Operations', c: '#fca5a5' },
                                            { l: 'Drips', c: '#fcd34d' }, { l: 'Offline Meeting', c: '#86efac' }, { l: 'Zoom', c: '#818cf8' }, { l: 'Out Meeting', c: '#a78bfa' }, { l: 'Team Meeting', c: '#f472b6' }, { l: "TL's Team Mtg", c: '#5eead4' },
                                            { l: 'Meeting Hrs', c: '#94a3b8' }, { l: 'Admissions', c: '#f9a8d4' }, { l: 'Days Active', c: '#e2e8f0' },
                                            { l: 'Activity Heatmap', c: '#c084fc', w: 140 },
                                        ].map((h) => (
                                            <th key={h.l} style={{ padding: '9px 10px', textAlign: h.align || 'center', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: h.c, borderRight: '1px solid rgba(255,255,255,.07)', whiteSpace: 'nowrap', width: h.w || 'auto' }}>{h.l}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => {
                                        return (
                                            <tr key={r.consultant._id} style={{ borderBottom: '1px solid #dde3ed' }}>
                                                <td style={{ padding: '8px 10px', color: '#8a9ab0', fontFamily: '"JetBrains Mono",monospace', fontSize: 10, borderRight: '1px solid #dde3ed' }}>{i + 1}</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#0d1520', borderRight: '1px solid #dde3ed' }}>{r.consultant.name}</td>
                                                {[
                                                    { v: r.calls, c: '#2563eb' }, { v: r.followups, c: '#0891b2' }, { v: r.noshows, c: '#dc2626' },
                                                    { v: r.drips, c: '#d97706' }, { v: r.offlineMtgs, c: '#16a34a' }, { v: r.zoomMtgs, c: '#4f46e5' }, { v: r.outMtgs, c: '#7c3aed' }, { v: r.teamMtgs, c: '#be185d' }, { v: r.tlMtgs, c: '#0d9488' },
                                                    { v: r.meetHrs, c: '#44556a', suf: 'h' }, { v: r.admissions, c: '#be185d' },
                                                    { v: r.days, c: '#44556a' },
                                                ].map((sv, j) => (
                                                    <td key={j} style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, borderRight: '1px solid #dde3ed' }}>
                                                        <span style={{ fontFamily: '"JetBrains Mono",monospace', fontWeight: 600, fontSize: 13, color: sv.v > 0 ? sv.c : '#c5d0df' }}>
                                                            {sv.v > 0 ? `${sv.v}${sv.suf || ''}` : '—'}
                                                        </span>
                                                    </td>
                                                ))}
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
                                            { v: teamTot.drips, c: '#fcd34d' }, { v: teamTot.offlineMtgs, c: '#86efac' }, { v: teamTot.zoomMtgs, c: '#818cf8' }, { v: teamTot.outMtgs, c: '#a78bfa' }, { v: 0, c: '#f472b6', hide: true }, { v: 0, c: '#5eead4', hide: true },
                                            { v: teamTot.meetHrs, c: '#94a3b8', suf: 'h' }, { v: teamTot.admissions, c: '#f9a8d4' },
                                            { v: teamTot.days, c: '#e2e8f0' },
                                        ].map((sv, i) => (
                                            <td key={i} style={{ padding: '9px 10px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,.07)', fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: sv.v > 0 ? sv.c : 'rgba(255,255,255,.2)' }}>
                                                {sv.v > 0 ? `${sv.v}${sv.suf || ''}` : '—'}
                                            </td>
                                        ))}
                                        <td style={{ borderRight: 'none' }} />
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
                PaperProps={{ sx: { borderRadius: '16px', p: 3.5, width: 620, maxWidth: '96vw', minHeight: 580 } }}
            >
                <DialogContent sx={{ p: 0 }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                        <Box>
                            <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#0d1520' }}>Log Activity</Typography>
                            <Typography sx={{ fontSize: 13, color: '#8a9ab0', mt: 0.3 }}>
                                {pickerTarget?.consultant?.name || ''} · {(() => { const s = SLOTS.find((x) => x.id === pickerTarget?.slotId); return s ? `${s.lbl}–${s.end}` : ''; })()}
                            </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => setPickerOpen(false)} sx={{ width: 26, height: 26, borderRadius: '6px', border: '1px solid #dde3ed' }}>
                            ✕
                        </IconButton>
                    </Box>

                    {/* Activity type grid */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
                        {ACTIVITY_TYPES.map((a) => {
                            const isSelected = pickerTypes.includes(a.id);
                            const handleTypeClick = () => {
                                if (a.multiWith) {
                                    setPickerTypes((prev) => {
                                        const has = prev.includes(a.id);
                                        if (has) return prev.filter((t) => t !== a.id);
                                        return [...prev.filter((t) => t === a.multiWith), a.id];
                                    });
                                } else {
                                    setPickerTypes(isSelected ? [] : [a.id]);
                                }
                            };
                            return (
                                <Box
                                    key={a.id}
                                    onClick={handleTypeClick}
                                    sx={{
                                        display: 'flex', alignItems: 'center', gap: 1.2, p: '12px 14px', borderRadius: '10px',
                                        border: `1.5px solid ${a.color}30`, color: a.color, background: a.bg,
                                        cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all .12s',
                                        outline: isSelected ? `2.5px solid ${a.color}` : 'none', outlineOffset: 2,
                                        '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 3px 10px rgba(0,0,0,.1)' },
                                    }}
                                >
                                    <span style={{ fontSize: 20, flexShrink: 0 }}>{a.icon}</span>{a.lbl}
                                </Box>
                            );
                        })}
                    </Box>

                    <Typography sx={{ fontSize: 13, color: '#1a1a1a', fontStyle: 'italic', mb: 0.8, textAlign: 'center', fontWeight: 600 }}>
                        Call and Follow-up can be selected together
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#dc2626', fontWeight: 700, mb: 1.5, textAlign: 'center', lineHeight: 1.4 }}>
                        ⚠️ Once you enter Call, Follow-up, or both together, it cannot be deleted. Contact admin if you need it removed.
                    </Typography>

                    {/* Count input */}
                    {pickerTypes.length > 0 && pickerTypes.some((t) => ACTIVITY_TYPES.find((a) => a.id === t)?.hasCount) && (
                        <Box sx={{ background: '#f7f9fc', border: '1px solid #dde3ed', borderRadius: '10px', p: 1.5, mb: 1.5 }}>
                            <Typography sx={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8a9ab0', mb: 0.7 }}>
                                Count
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
                                <Typography sx={{ fontSize: 12, color: '#8a9ab0', ml: 0.5 }}>{pickerTypes.length === 1 ? (ACTIVITY_TYPES.find((a) => a.id === pickerTypes[0])?.unit || 'count') : 'count'}</Typography>
                            </Box>
                        </Box>
                    )}

                    {/* Duration picker */}
                    {pickerTypes.length > 0 && pickerTypes.some((t) => ACTIVITY_TYPES.find((a) => a.id === t)?.hasDur) && (
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
                            Note {pickerTypes.includes('noshow') ? <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0, color: '#dc2626' }}>(required)</span> : <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>}
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
                        <Button onClick={handleSave} disabled={loading || pickerTypes.length === 0} sx={{ flex: 1, py: 1, background: '#0ea5e9', borderRadius: '8px', color: '#fff', textTransform: 'none', fontSize: 13, fontWeight: 700, '&:hover': { background: '#0284c7', transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(14,165,233,.3)' }, '&:disabled': { background: '#c8d0de', color: '#fff' } }}>
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
                    <Box sx={{ mb: 2 }}>
                        <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                            <Select
                                value={selectedTeamLead}
                                onChange={(e) => setSelectedTeamLead(e.target.value)}
                                displayEmpty
                                sx={{ fontSize: 13 }}
                            >
                                <MenuItem value="" disabled><em>Select Team Lead</em></MenuItem>
                                {teamLeads.map((tl) => (
                                    <MenuItem key={tl._id} value={tl._id}>
                                        {tl.name} {tl.teamName ? `(${tl.teamName})` : ''}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <TextField
                                size="small"
                                placeholder="Consultant name"
                                value={newConsultantName}
                                onChange={(e) => setNewConsultantName(e.target.value)}
                                sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 13 } }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddConsultant(); }}
                            />
                            <Button onClick={handleAddConsultant} variant="contained" size="small" sx={{ minWidth: 'auto', px: 1.5, background: '#0ea5e9', textTransform: 'none', fontWeight: 700, '&:hover': { background: '#0284c7' } }}>
                                <AddIcon sx={{ fontSize: 18 }} />
                            </Button>
                        </Box>
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

            {/* ── OPS NOTES DIALOG ── */}
            <Dialog
                open={opsNoteOpen}
                onClose={() => setOpsNoteOpen(false)}
                PaperProps={{ sx: { borderRadius: '14px', p: 2, width: 380, maxWidth: '96vw' } }}
            >
                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                        <Box>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0d1520' }}>Activity Notes</Typography>
                            <Typography sx={{ fontSize: 11, color: '#8a9ab0', mt: 0.2 }}>{opsNoteContent.name}</Typography>
                        </Box>
                        <IconButton size="small" onClick={() => setOpsNoteOpen(false)} sx={{ width: 26, height: 26, borderRadius: '6px', border: '1px solid #dde3ed' }}>✕</IconButton>
                    </Box>
                    {opsNoteContent.notes.length === 0 ? (
                        <Typography sx={{ fontSize: 12, color: '#8a9ab0', textAlign: 'center', py: 2 }}>No notes found</Typography>
                    ) : (
                        opsNoteContent.notes.map((n, i) => (
                            <Box key={i} sx={{ background: '#f7f9fc', border: '1px solid #dde3ed', borderRadius: '8px', p: 1.2, mb: 1, borderLeft: '3px solid #6366f1' }}>
                                <Typography sx={{ fontSize: 10, fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '.06em', mb: 0.3 }}>{n.icon} {n.lbl} · {n.slot}</Typography>
                                <Typography sx={{ fontSize: 12, color: '#44556a' }}>{n.note}</Typography>
                            </Box>
                        ))
                    )}
                </DialogContent>
            </Dialog>

            {/* AI Analysis Dialog */}
            <Dialog
                open={aiOpen}
                onClose={() => setAiOpen(false)}
                PaperProps={{ sx: { borderRadius: '16px', p: 3, width: 700, maxWidth: '96vw', maxHeight: '85vh' } }}
            >
                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</Box>
                            <Box>
                                <Typography sx={{ fontSize: 17, fontWeight: 700, color: '#0d1520' }}>AI Performance Analysis</Typography>
                                <Typography sx={{ fontSize: 11, color: '#8a9ab0', mt: 0.2 }}>
                                    {`${DAYS[currentDate.getDay()]}, ${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`} · gpt-4o-mini
                                </Typography>
                            </Box>
                        </Box>
                        <IconButton size="small" onClick={() => setAiOpen(false)} sx={{ width: 28, height: 28, borderRadius: '6px', border: '1px solid #dde3ed' }}>✕</IconButton>
                    </Box>
                    {aiLoading ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
                            <CircularProgress size={36} sx={{ color: '#6366f1' }} />
                            <Typography sx={{ fontSize: 13, color: '#8a9ab0' }}>Analyzing team performance...</Typography>
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                fontSize: 13, color: '#44556a', lineHeight: 1.8,
                                '& h2': { fontSize: 16, fontWeight: 700, color: '#0d1520', mt: 2.5, mb: 1, pb: 0.5, borderBottom: '2px solid #e5e7eb' },
                                '& h3': { fontSize: 14, fontWeight: 600, color: '#1e293b', mt: 2, mb: 0.5 },
                                '& strong': { color: '#0d1520' },
                                '& ul': { pl: 2.5, my: 0.5 },
                                '& li': { mb: 0.3 },
                                '& p': { my: 0.5 },
                            }}
                            dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/### (.*)/g, '<h3>$1</h3>').replace(/## (.*)/g, '<h2>$1</h2>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/Needs Improvement/g, '<span style="color:#dc2626;font-weight:700">Needs Improvement</span>').replace(/Average/g, '<span style="color:#d97706;font-weight:700">Average</span>').replace(/\bGood\b/g, '<span style="color:#16a34a;font-weight:700">Good</span>').replace(/Excellent/g, '<span style="color:#059669;font-weight:700">Excellent</span>').replace(/^- (.*)/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>').replace(/^\d+\. (.*)/gm, '<li>$1</li>').replace(/\n{2,}/g, '<br/>') }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Leaderboard Dialog */}
            <Dialog
                open={lbOpen}
                onClose={() => setLbOpen(false)}
                PaperProps={{ sx: { borderRadius: '16px', p: 3, width: 650, maxWidth: '96vw', maxHeight: '85vh' } }}
            >
                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏆</Box>
                            <Box>
                                <Typography sx={{ fontSize: 17, fontWeight: 700, color: '#0d1520' }}>Daily Leaderboard</Typography>
                                <Typography sx={{ fontSize: 11, color: '#8a9ab0', mt: 0.2 }}>
                                    {`${DAYS[currentDate.getDay()]}, ${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`} · AI-powered ranking
                                </Typography>
                            </Box>
                        </Box>
                        <IconButton size="small" onClick={() => setLbOpen(false)} sx={{ width: 28, height: 28, borderRadius: '6px', border: '1px solid #dde3ed' }}>✕</IconButton>
                    </Box>
                    {lbLoading ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
                            <CircularProgress size={36} sx={{ color: '#f59e0b' }} />
                            <Typography sx={{ fontSize: 13, color: '#8a9ab0' }}>Calculating rankings...</Typography>
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                fontSize: 13, color: '#44556a', lineHeight: 1.8,
                                '& h2': { fontSize: 16, fontWeight: 700, color: '#0d1520', mt: 2.5, mb: 1, pb: 0.5, borderBottom: '2px solid #e5e7eb' },
                                '& h3': { fontSize: 14, fontWeight: 600, color: '#1e293b', mt: 2, mb: 0.5 },
                                '& strong': { color: '#0d1520' },
                                '& ul': { pl: 2.5, my: 0.5 },
                                '& li': { mb: 0.3 },
                                '& .rank-1': { color: '#f59e0b', fontSize: 18, fontWeight: 800 },
                                '& .rank-2': { color: '#94a3b8', fontSize: 16, fontWeight: 700 },
                                '& .rank-3': { color: '#b45309', fontSize: 15, fontWeight: 700 },
                            }}
                            dangerouslySetInnerHTML={{ __html: lbData.replace(/### (.*)/g, '<h3>$1</h3>').replace(/## (.*)/g, '<h2>$1</h2>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/^- (.*)/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>').replace(/^\d+\. (.*)/gm, '<li>$1</li>').replace(/\n{2,}/g, '<br/>') }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* ── ORG VIEW DRAWER ── */}
            <Drawer
                anchor="right"
                open={orgViewOpen}
                onClose={() => setOrgViewOpen(false)}
                PaperProps={{ sx: { width: '92vw', maxWidth: 1600, background: '#f8f9fc' } }}
            >
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Drawer header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 1.5, background: '#fff', borderBottom: '1px solid #dde3ed', flexShrink: 0 }}>
                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#0d1520' }}>
                                🏢 Organization Hourly Tracker
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: '#8a9ab0', mt: 0.3 }}>
                                {currentDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })} · {orgConsultants.length} consultants · <span style={{ color: '#6366f1', fontWeight: 600 }}>View Only</span>
                            </Typography>
                        </Box>
                        <Button
                            onClick={() => setOrgViewOpen(false)}
                            sx={{ px: 2, py: 0.7, borderRadius: '8px', border: '1px solid #dde3ed', background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 600, textTransform: 'none', '&:hover': { background: '#f3f4f6' } }}
                        >
                            ✕ Close
                        </Button>
                    </Box>

                    {/* Drawer body */}
                    {orgLoading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                            <CircularProgress size={40} />
                        </Box>
                    ) : (
                        <Box sx={{ flex: 1, overflow: 'auto' }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...S.th, position: 'sticky', top: 0, left: 0, zIndex: 10, width: 34, minWidth: 34, background: '#243348' }}>#</th>
                                        <th style={{ ...S.th, position: 'sticky', top: 0, left: 34, zIndex: 10, width: 160, minWidth: 160, textAlign: 'left', background: '#243348' }}>CONSULTANT</th>
                                        <th style={{ ...S.th, position: 'sticky', top: 0, zIndex: 8, width: 100, minWidth: 100, textAlign: 'left', background: '#1e3a5f', color: '#93c5fd' }}>TEAM</th>
                                        {SLOTS.map((s) => (
                                            <th key={s.id} style={{ ...S.th, position: 'sticky', top: 0, zIndex: 7, minWidth: s.isLunch ? 50 : 120, background: s.isLunch ? '#3d3520' : '#243348', color: s.isLunch ? '#fcd34d' : 'rgba(255,255,255,.7)' }}>
                                                {s.isLunch ? '🍽' : <>{s.lbl}<br />{s.end}</>}
                                            </th>
                                        ))}
                                        {[
                                            { l: 'CALLS', c: '#93c5fd' }, { l: 'FOLLOW-UPS', c: '#67e8f9' }, { l: 'OPERATIONS', c: '#fca5a5' },
                                            { l: 'DRIPS', c: '#fcd34d' }, { l: 'OFFLINE MTG', c: '#86efac' }, { l: 'ZOOM', c: '#818cf8' },
                                            { l: 'OUT MTG', c: '#a78bfa' }, { l: 'TEAM MTG', c: '#f472b6' }, { l: "TL'S MTG", c: '#5eead4' },
                                            { l: 'MTG HOURS', c: '#94a3b8' },
                                        ].map((h) => (
                                            <th key={h.l} style={{ ...S.th, position: 'sticky', top: 0, zIndex: 7, minWidth: 75, background: '#2a2010', color: h.c, fontSize: 9, fontWeight: 700, letterSpacing: '.04em' }}>{h.l}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {orgConsultants.map((c, idx) => {
                                        const teamName = c.teamLead?.teamName || c.teamLead?.name || '';
                                        return (
                                            <tr key={c._id} style={{ borderBottom: '1px solid #dde3ed' }}>
                                                <td style={{ ...S.td, width: 34, minWidth: 34, textAlign: 'center', fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: '#8a9ab0', background: '#f6f8fc', position: 'sticky', left: 0, zIndex: 5 }}>{idx + 1}</td>
                                                <td style={{ ...S.td, width: 160, minWidth: 160, background: '#f6f8fc', padding: '0 7px', position: 'sticky', left: 34, zIndex: 5, borderRight: '1px solid #c8d0de' }}>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0d1520', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                                                </td>
                                                <td style={{ ...S.td, width: 100, minWidth: 100, background: '#f0f4ff', padding: '0 6px' }}>
                                                    <div style={{ fontSize: 10, fontWeight: 600, color: '#4f46e5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{teamName}</div>
                                                </td>
                                                {SLOTS.map((s) => {
                                                    if (s.isLunch) {
                                                        return <td key={s.id} style={{ ...S.td, minWidth: 50, textAlign: 'center', background: '#fef9ec' }}><span style={{ fontSize: 16 }}>🍽</span></td>;
                                                    }
                                                    const d = getOrgAct(c._id, s.id);
                                                    const act = d && !d.isContinuation ? (ACTIVITY_TYPES.find((a) => a.id === d.activityType) || COMBINED_TYPES[d.activityType] || null) : null;
                                                    const isAM = ['s0930', 's1030', 's1130', 's1230'].includes(s.id);
                                                    return (
                                                        <td key={s.id} style={{ ...S.td, minWidth: 120, textAlign: 'center', background: d ? (act ? act.bg : (isAM ? '#f0f5ff' : '#fffdf0')) : (isAM ? '#f0f5ff' : '#fffdf0'), cursor: 'default' }}>
                                                            {d && d.isContinuation && (() => {
                                                                const pAct = ACTIVITY_TYPES.find((a) => a.id === d.activityType) || COMBINED_TYPES[d.activityType];
                                                                return pAct ? <span style={{ fontSize: 8, fontWeight: 700, fontStyle: 'italic', color: pAct.color, opacity: .5 }}>{pAct.icon}</span> : null;
                                                            })()}
                                                            {act && (
                                                                <>
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '2px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700, color: act.color, background: act.bg, borderLeft: `2px solid ${act.color}`, whiteSpace: 'nowrap' }}>
                                                                        {act.icon} {act.lbl}
                                                                    </span>
                                                                    {d.count > 1 && (
                                                                        <span style={{ position: 'relative', top: -4, marginLeft: 3, fontFamily: '"JetBrains Mono",monospace', fontSize: 11, fontWeight: 800, background: '#334155', color: '#fff', borderRadius: 4, padding: '1px 5px', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }}>{d.count}</span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                {(() => {
                                                    const os = getOrgStats(c._id);
                                                    return [
                                                        { v: os.calls, c: '#2563eb', types: ['call', 'call_followup'], title: 'Calls' },
                                                        { v: os.followups, c: '#0891b2', types: ['followup', 'call_followup'], title: 'Follow-ups' },
                                                        { v: os.noshows, c: '#dc2626', types: ['noshow'], title: 'Operations' },
                                                        { v: os.drips, c: '#d97706', types: ['drip'], title: 'Drips' },
                                                        { v: os.offlineMtgs, c: '#16a34a', types: ['meeting'], title: 'Offline Meeting' },
                                                        { v: os.zoomMtgs, c: '#4f46e5', types: ['zoom'], title: 'Zoom' },
                                                        { v: os.outMtgs, c: '#7c3aed', types: ['outmeet'], title: 'Out Meeting' },
                                                        { v: os.teamMtgs, c: '#be185d', types: ['teammeet'], title: 'Team Meeting' },
                                                        { v: os.tlMtgs, c: '#0d9488', types: ['tlmeet'], title: "TL's Team Meeting" },
                                                        { v: os.meetHrs, c: '#44556a', suf: 'h' },
                                                    ].map((sv, i) => (
                                                        <td key={`s${i}`} style={{ minWidth: 75, padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #e5dab8', borderBottom: '1px solid #efe6cc' }}>
                                                            <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 13, fontWeight: 600, color: sv.v === 0 ? '#d4c9a8' : sv.c }}>
                                                                {sv.v === 0 ? '—' : `${sv.v}${sv.suf || ''}`}
                                                            </span>
                                                            {sv.types && hasOrgNotesForType(c._id, sv.types) && (
                                                                <VisibilityIcon
                                                                    onClick={() => handleOrgViewNotes(c, sv.types, sv.title)}
                                                                    sx={{ fontSize: 14, color: sv.c, ml: 0.4, cursor: 'pointer', verticalAlign: 'middle', opacity: 0.5, '&:hover': { opacity: 1 } }}
                                                                />
                                                            )}
                                                        </td>
                                                    ));
                                                })()}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </Box>
                    )}
                </Box>
            </Drawer>

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
