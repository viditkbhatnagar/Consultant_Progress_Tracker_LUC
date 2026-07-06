import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Tooltip,
    CircularProgress,
    Alert,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SectionCard from '../dashboard/SectionCard';
import useRealtimeRefresh from '../../hooks/useRealtimeRefresh';
import paymentPlanService from '../../services/paymentPlanService';
import { statusMeta } from '../../utils/paymentPlanDesign';
import { MONTHS } from '../../utils/studentDesign';
import PaymentPlanFilters from './PaymentPlanFilters';
import PaymentPlanFormDialog from './PaymentPlanFormDialog';

const HEAD = ['#', 'Month', 'Student Name', 'Program', 'Consultant', 'Team Leader (TL)', 'Status', 'Remarks / Notes', ''];

const EMPTY_FILTERS = { search: '', status: '', team: '', consultant: '', month: '', program: '' };

const StatusChip = ({ status }) => {
    const meta = statusMeta(status);
    return (
        <Chip
            label={status}
            size="small"
            sx={{ fontSize: 11.5, fontWeight: 700, color: meta.color, backgroundColor: meta.bg }}
        />
    );
};

const PaymentPlanPanel = ({ isAdmin }) => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [toDelete, setToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState(null);

    const load = useCallback(() => {
        paymentPlanService
            .getPaymentPlans()
            .then((res) => {
                setPlans(res.data || []);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.response?.data?.message || err.message || 'Failed to load payment plans');
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        setLoading(true);
        setError(null);
        load();
    }, [load]);

    useRealtimeRefresh(['paymentPlan:created', 'paymentPlan:updated', 'paymentPlan:deleted'], load);

    // Distinct dropdown options from the loaded (scoped) dataset.
    const options = useMemo(() => {
        const uniq = (vals) => [...new Set(vals.filter(Boolean))].sort((a, b) => a.localeCompare(b));
        return {
            teams: uniq(plans.map((p) => p.teamName)),
            consultants: uniq(plans.map((p) => p.consultantName)),
            programs: uniq(plans.map((p) => p.program)),
            months: MONTHS.filter((m) => plans.some((p) => p.month === m)), // calendar order
        };
    }, [plans]);

    // Apply the active filters + free-text search (client-side).
    const filtered = useMemo(() => {
        const q = filters.search.trim().toLowerCase();
        return plans.filter((p) => {
            if (filters.status && p.status !== filters.status) return false;
            if (filters.team && (p.teamName || '') !== filters.team) return false;
            if (filters.consultant && (p.consultantName || '') !== filters.consultant) return false;
            if (filters.month && (p.month || '') !== filters.month) return false;
            if (filters.program && (p.program || '') !== filters.program) return false;
            if (q) {
                const hay = [p.studentName, p.consultantName, p.program, p.remarks, p.teamLeadName]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [plans, filters]);

    // Admin view groups rows by team; team lead sees a single flat list.
    const groups = useMemo(() => {
        if (!isAdmin) return [{ team: null, rows: filtered }];
        const byTeam = new Map();
        for (const p of filtered) {
            const key = p.teamName || p.teamLeadName || 'Unassigned';
            if (!byTeam.has(key)) byTeam.set(key, []);
            byTeam.get(key).push(p);
        }
        return [...byTeam.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([team, rows]) => ({ team, rows }));
    }, [filtered, isAdmin]);

    const openCreate = () => { setEditing(null); setDialogOpen(true); };
    const openEdit = (plan) => { setEditing(plan); setDialogOpen(true); };

    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await paymentPlanService.deletePaymentPlan(toDelete._id);
            setToast({ severity: 'success', message: 'Payment plan deleted' });
            setToDelete(null);
            load();
        } catch (err) {
            setToast({ severity: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setDeleting(false);
        }
    };

    const addButton = (
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
            New Payment Plan
        </Button>
    );

    let rowNumber = 0;
    const renderRow = (p) => {
        rowNumber += 1;
        return (
            <TableRow key={p._id} hover>
                <TableCell sx={{ color: 'var(--d-text-3, #57564E)', fontWeight: 600 }}>{rowNumber}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{p.month || '—'}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{p.studentName}</TableCell>
                <TableCell>{p.program || '—'}</TableCell>
                <TableCell>{p.consultantName || '—'}</TableCell>
                <TableCell>{p.teamLeadName || '—'}</TableCell>
                <TableCell><StatusChip status={p.status} /></TableCell>
                <TableCell sx={{ maxWidth: 260, color: 'var(--d-text-3, #57564E)', fontStyle: p.remarks ? 'italic' : 'normal' }}>
                    {p.remarks || '—'}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => setToDelete(p)}><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip>
                </TableCell>
            </TableRow>
        );
    };

    return (
        <SectionCard title="Payment Plan Tracker" eyebrow="Pending approvals" right={addButton}>
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : plans.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6, color: 'var(--d-text-muted, #8A887E)' }}>
                    <Typography sx={{ mb: 0.5 }}>No payment plans yet.</Typography>
                    <Typography variant="caption">Click “New Payment Plan” to link a student and track its approval.</Typography>
                </Box>
            ) : (
                <>
                    <PaymentPlanFilters
                        filters={filters}
                        setFilters={setFilters}
                        options={options}
                        isAdmin={isAdmin}
                        resultCount={filtered.length}
                        totalCount={plans.length}
                    />
                    {filtered.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 5, color: 'var(--d-text-muted, #8A887E)' }}>
                            <Typography sx={{ mb: 0.5 }}>No payment plans match your filters.</Typography>
                            <Typography variant="caption">Try clearing or widening the filters above.</Typography>
                        </Box>
                    ) : (
                        <TableContainer sx={{ overflowX: 'auto' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'var(--d-surface-muted, #F1EFEA)' }}>
                                        {HEAD.map((h, i) => (
                                            <TableCell key={i} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} align={i === HEAD.length - 1 ? 'right' : 'left'}>
                                                {h}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {groups.map((g) => (
                                        <React.Fragment key={g.team || 'all'}>
                                            {g.team && (
                                                <TableRow>
                                                    <TableCell colSpan={HEAD.length} sx={{ bgcolor: 'rgba(35,131,226,0.06)', fontWeight: 800, color: 'var(--d-text-2, #2A2927)', letterSpacing: '0.02em' }}>
                                                        {g.team}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {g.rows.map(renderRow)}
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </>
            )}

            <PaymentPlanFormDialog
                open={dialogOpen}
                plan={editing}
                onClose={() => setDialogOpen(false)}
                onSaved={() => {
                    setToast({ severity: 'success', message: editing ? 'Payment plan updated' : 'Payment plan created' });
                    load();
                }}
            />

            <Dialog open={!!toDelete} onClose={() => (deleting ? null : setToDelete(null))} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>Delete payment plan?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This removes the payment plan for <strong>{toDelete?.studentName}</strong>. This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setToDelete(null)} disabled={deleting} color="inherit">Cancel</Button>
                    <Button onClick={confirmDelete} disabled={deleting} color="error" variant="contained">
                        {deleting ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={!!toast}
                autoHideDuration={4000}
                onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity={toast?.severity || 'info'} onClose={() => setToast(null)}>{toast?.message}</Alert>
            </Snackbar>
        </SectionCard>
    );
};

export default PaymentPlanPanel;
