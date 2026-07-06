import React, { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Autocomplete,
    Box,
    Typography,
    Alert,
    CircularProgress,
    InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import studentService from '../../services/studentService';
import paymentPlanService from '../../services/paymentPlanService';
import { PAYMENT_PLAN_STATUSES } from '../../utils/paymentPlanDesign';

// Read-only auto-filled field pulled from the linked student.
const InfoField = ({ label, value }) => (
    <Box sx={{ flex: 1, minWidth: 160 }}>
        <Typography sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--d-text-muted, #8A887E)', fontWeight: 600 }}>
            {label}
        </Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--d-text, #191918)' }}>
            {value || '—'}
        </Typography>
    </Box>
);

// Create or edit a Payment Plan. On create, an async LUC-student search
// picker links a student and auto-fills Program / Month / Consultant / TL.
// On edit, the linked student is fixed and only Status / Remarks change.
const PaymentPlanFormDialog = ({ open, onClose, onSaved, plan }) => {
    const isEdit = !!plan;

    const [query, setQuery] = useState('');
    const [options, setOptions] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selected, setSelected] = useState(null);
    const [status, setStatus] = useState('Pending from TL');
    const [remarks, setRemarks] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // (Re)initialize when the dialog opens or the edited plan changes.
    useEffect(() => {
        if (!open) return;
        if (plan) {
            setSelected({
                _id: plan.student,
                studentName: plan.studentName,
                program: plan.program,
                month: plan.month,
                consultantName: plan.consultantName,
                teamLeadName: plan.teamLeadName,
            });
            setStatus(plan.status || 'Pending from TL');
            setRemarks(plan.remarks || '');
        } else {
            setSelected(null);
            setStatus('Pending from TL');
            setRemarks('');
        }
        setQuery('');
        setOptions([]);
        setError('');
    }, [open, plan]);

    // Debounced async LUC-student search (create mode only). The server scopes
    // results to the caller (team_lead → own team; admin → all LUC).
    useEffect(() => {
        if (!open || isEdit) return undefined;
        const q = query.trim();
        if (q.length < 2) {
            setOptions([]);
            return undefined;
        }
        let active = true;
        setSearching(true);
        const t = setTimeout(async () => {
            try {
                const res = await studentService.getStudents({ organization: 'luc', search: q, limit: 25 });
                if (active) setOptions(res.data || []);
            } catch {
                if (active) setOptions([]);
            } finally {
                if (active) setSearching(false);
            }
        }, 300);
        return () => {
            active = false;
            clearTimeout(t);
        };
    }, [query, open, isEdit]);

    const canSave = useMemo(() => !!selected && !!status, [selected, status]);

    const handleSave = async () => {
        if (!canSave) {
            setError('Select a student and a status.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            if (isEdit) {
                await paymentPlanService.updatePaymentPlan(plan._id, { status, remarks });
            } else {
                await paymentPlanService.createPaymentPlan({ studentId: selected._id, status, remarks });
            }
            onSaved?.();
            onClose?.();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to save payment plan');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>
                {isEdit ? 'Edit Payment Plan' : 'New Payment Plan'}
            </DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {/* Student picker (create) or locked student name (edit) */}
                {isEdit ? (
                    <TextField
                        label="Student"
                        value={selected?.studentName || ''}
                        fullWidth
                        InputProps={{ readOnly: true }}
                        sx={{ mb: 2 }}
                    />
                ) : (
                    <Autocomplete
                        options={options}
                        value={selected}
                        loading={searching}
                        filterOptions={(x) => x}
                        getOptionLabel={(o) => o?.studentName || ''}
                        isOptionEqualToValue={(o, v) => o._id === v?._id}
                        onInputChange={(e, val, reason) => {
                            if (reason === 'input') setQuery(val);
                        }}
                        onChange={(e, val) => setSelected(val)}
                        noOptionsText={query.trim().length < 2 ? 'Type at least 2 letters…' : 'No LUC students found'}
                        renderOption={(props, o) => (
                            <li {...props} key={o._id}>
                                <Box>
                                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{o.studentName}</Typography>
                                    <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted, #8A887E)' }}>
                                        {[o.program, o.teamLeadName].filter(Boolean).join(' · ') || 'LUC admission'}
                                    </Typography>
                                </Box>
                            </li>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Link a LUC student"
                                placeholder="Search by student name…"
                                InputProps={{
                                    ...params.InputProps,
                                    startAdornment: (
                                        <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                                    ),
                                    endAdornment: (
                                        <>
                                            {searching ? <CircularProgress size={16} /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                        sx={{ mb: 2 }}
                    />
                )}

                {/* Auto-filled read-only fields from the linked student */}
                {selected && (
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 2,
                            mb: 2.5,
                            p: 1.75,
                            borderRadius: '10px',
                            backgroundColor: 'var(--d-surface-muted, #F1EFEA)',
                        }}
                    >
                        <InfoField label="Month" value={selected.month} />
                        <InfoField label="Program" value={selected.program} />
                        <InfoField label="Consultant" value={selected.consultantName} />
                        <InfoField label="Team Leader" value={selected.teamLeadName} />
                    </Box>
                )}

                <TextField
                    select
                    label="Status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    fullWidth
                    SelectProps={{ native: true }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ mb: 2 }}
                >
                    {PAYMENT_PLAN_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </TextField>

                <TextField
                    label="Remarks / Notes"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="e.g. Awaiting TL signature"
                />
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={saving} color="inherit">Cancel</Button>
                <Button onClick={handleSave} disabled={saving || !canSave} variant="contained">
                    {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Plan'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PaymentPlanFormDialog;
