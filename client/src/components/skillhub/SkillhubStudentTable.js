import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Tabs,
    Tab,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TableContainer,
    IconButton,
    Button,
    Chip,
    Menu,
    MenuItem,
    Typography,
    TextField,
    InputAdornment,
    CircularProgress,
    Alert,
    Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import studentService from '../../services/studentService';
import SkillhubStudentFormDialog from './SkillhubStudentFormDialog';
import ActivateStudentDialog from './ActivateStudentDialog';

// `organization` prop is used when this table is rendered by the admin inside
// the Skillhub view — it forces the read/write scope to the selected branch
// (skillhub_training or skillhub_institute) regardless of the admin's global
// LUC/Skillhub scope. When the table is rendered on a skillhub user's own
// dashboard, the prop is omitted and the server scopes to their organization
// implicitly.
const SkillhubStudentTable = ({ counselors, onChange, organization }) => {
    const [curriculumTab, setCurriculumTab] = useState('CBSE');
    const [statusTab, setStatusTab] = useState('new_admission');
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    // studentStatus the current create flow will save with — set by whichever
    // of the three "new" buttons the counselor clicked.
    const [createStatus, setCreateStatus] = useState('new_admission');
    const [activateOpen, setActivateOpen] = useState(false);
    const [activatingStudent, setActivatingStudent] = useState(null);
    // Row-level "Move to..." menu state.
    const [moveAnchor, setMoveAnchor] = useState(null);
    const [movingStudent, setMovingStudent] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await studentService.getStudents({
                studentStatus: statusTab,
                curriculumSlug: curriculumTab,
                ...(organization ? { organization } : {}),
            });
            setStudents(res.data || []);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load students');
        } finally {
            setLoading(false);
        }
    }, [statusTab, curriculumTab, organization]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = (status) => {
        setEditingStudent(null);
        setCreateStatus(status);
        setFormOpen(true);
    };

    const handleEdit = (student) => {
        setEditingStudent(student);
        setFormOpen(true);
    };

    const handleSave = async (formData) => {
        // When admin creates from inside a branch, the backend requires a
        // teamLeadId. Derive it from the chosen counselor (whose teamLead FK
        // points to the branch's skillhub login). Skillhub users don't need
        // to send this — the server uses req.user.id.
        let payload = formData;
        if (organization && !editingStudent) {
            const chosen = counselors.find((c) => c._id === formData.consultantId);
            const teamLeadId =
                chosen?.teamLead?._id || chosen?.teamLead || undefined;
            payload = {
                ...formData,
                organization,
                ...(teamLeadId ? { teamLeadId } : {}),
            };
        }
        if (editingStudent) {
            await studentService.updateStudent(editingStudent._id, payload);
        } else {
            await studentService.createStudent(payload);
        }
        await load();
        onChange?.();
    };

    const handleDelete = async (student) => {
        if (!window.confirm(`Delete student "${student.studentName}"?`)) return;
        try {
            await studentService.deleteStudent(student._id);
            await load();
            onChange?.();
        } catch (e) {
            alert(e.response?.data?.message || 'Delete failed');
        }
    };

    const handleActivate = async (payload) => {
        await studentService.activateStudent(activatingStudent._id, payload);
        await load();
        onChange?.();
    };

    const openMoveMenu = (event, student) => {
        setMovingStudent(student);
        setMoveAnchor(event.currentTarget);
    };

    const closeMoveMenu = () => {
        setMoveAnchor(null);
        setMovingStudent(null);
    };

    const handleMove = async (targetStatus) => {
        if (!movingStudent) return closeMoveMenu();
        // new_admission → active keeps the rich activation dialog so we can
        // capture emirate / registrationFee / dateOfEnrollment / EMIs. Every
        // other transition is a silent one-click update.
        if (movingStudent.studentStatus === 'new_admission' && targetStatus === 'active') {
            setActivatingStudent(movingStudent);
            setActivateOpen(true);
            closeMoveMenu();
            return;
        }
        try {
            await studentService.changeStudentStatus(movingStudent._id, targetStatus);
            await load();
            onChange?.();
        } catch (e) {
            alert(e.response?.data?.message || 'Move failed');
        } finally {
            closeMoveMenu();
        }
    };

    const STATUS_LABELS = {
        new_admission: 'New Admission',
        active: 'Active Student',
        inactive: 'Inactive Student',
    };

    const filtered = students.filter((s) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return [s.studentName, s.enrollmentNumber, s.school, s.consultantName, s.phones?.student]
            .filter(Boolean)
            .some((f) => String(f).toLowerCase().includes(q));
    });

    return (
        <Paper sx={{ p: 2 }}>
            {/* Top-level: curriculum filter. Manager wants CBSE and IGCSE
                students listed strictly separately. */}
            <Tabs
                value={curriculumTab}
                onChange={(_, v) => setCurriculumTab(v)}
                sx={{
                    mb: 1,
                    borderBottom: '1px solid rgba(0,0,0,0.08)',
                    '& .MuiTab-root': {
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        textTransform: 'none',
                        minWidth: 120,
                    },
                }}
            >
                <Tab label="CBSE" value="CBSE" />
                <Tab label="IGCSE" value="IGCSE" />
            </Tabs>

            {/* Secondary: status filter within the selected curriculum. */}
            <Tabs
                value={statusTab}
                onChange={(_, v) => setStatusTab(v)}
                sx={{ mb: 2 }}
                textColor="secondary"
                indicatorColor="secondary"
            >
                <Tab label="New Admissions" value="new_admission" />
                <Tab label="Active Students" value="active" />
                <Tab label="Inactive" value="inactive" />
            </Tabs>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <TextField
                    size="small"
                    placeholder="Search name, enrollment #, school…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ flexGrow: 1 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {[
                        { key: 'new_admission', label: 'New Admission', bg: '#FF9800', hover: '#F57C00' },
                        { key: 'active', label: 'New Active', bg: '#4CAF50', hover: '#388E3C' },
                        { key: 'inactive', label: 'New Inactive', bg: '#9E9E9E', hover: '#616161' },
                    ].map((b) => (
                        <Button
                            key={b.key}
                            variant="contained"
                            size="medium"
                            startIcon={<AddIcon />}
                            onClick={() => handleCreate(b.key)}
                            // Solid status-coded colors (matching the status tabs) with
                            // `background` explicitly overridden to defeat the app-wide
                            // gradient on contained buttons, which was washing out the
                            // label and making the text hard to read.
                            sx={{
                                bgcolor: b.bg,
                                background: b.bg,
                                color: '#fff',
                                fontWeight: 600,
                                textTransform: 'none',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                                '&:hover': {
                                    bgcolor: b.hover,
                                    background: b.hover,
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.18)',
                                },
                            }}
                        >
                            {b.label}
                        </Button>
                    ))}
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            ) : filtered.length === 0 ? (
                <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                    No students in this tab yet.
                </Typography>
            ) : (
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Enrollment #</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell>Curriculum</TableCell>
                                <TableCell>Year/Grade</TableCell>
                                <TableCell>Acad. Year</TableCell>
                                <TableCell>Counselor</TableCell>
                                <TableCell>Mode</TableCell>
                                <TableCell>Date of Enrollment</TableCell>
                                <TableCell align="right">Course Fee</TableCell>
                                <TableCell align="right">Outstanding</TableCell>
                                <TableCell align="center">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.map((s) => (
                                <TableRow hover key={s._id}>
                                    <TableCell sx={{ fontFamily: 'monospace' }}>
                                        {s.enrollmentNumber || '-'}
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {s.studentName}
                                        </Typography>
                                        {s.school && (
                                            <Typography variant="caption" color="text.secondary">
                                                {s.school}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={s.curriculum || '-'} size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell>{s.yearOrGrade || '-'}</TableCell>
                                    <TableCell>{s.academicYear || '-'}</TableCell>
                                    <TableCell>{s.consultantName || '-'}</TableCell>
                                    <TableCell>{s.mode || '-'}</TableCell>
                                    <TableCell>
                                        {s.dateOfEnrollment
                                            ? new Date(s.dateOfEnrollment).toLocaleDateString([], { year: '2-digit', month: 'short', day: 'numeric' })
                                            : '-'}
                                    </TableCell>
                                    <TableCell align="right">
                                        {(s.courseFee || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell align="right">
                                        {(s.outstandingAmount ?? 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell align="center">
                                        <Tooltip title="Move to…">
                                            <IconButton
                                                size="small"
                                                color="primary"
                                                onClick={(e) => openMoveMenu(e, s)}
                                            >
                                                <SwapHorizIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => handleEdit(s)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" color="error" onClick={() => handleDelete(s)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <SkillhubStudentFormDialog
                open={formOpen}
                onClose={() => setFormOpen(false)}
                onSave={handleSave}
                student={editingStudent}
                counselors={counselors}
                initialStatus={createStatus}
            />
            <ActivateStudentDialog
                open={activateOpen}
                onClose={() => setActivateOpen(false)}
                onConfirm={handleActivate}
                student={activatingStudent}
            />
            <Menu
                anchorEl={moveAnchor}
                open={Boolean(moveAnchor)}
                onClose={closeMoveMenu}
            >
                {['new_admission', 'active', 'inactive']
                    .filter((s) => s !== movingStudent?.studentStatus)
                    .map((s) => (
                        <MenuItem key={s} onClick={() => handleMove(s)}>
                            Move to {STATUS_LABELS[s]}
                        </MenuItem>
                    ))}
            </Menu>
        </Paper>
    );
};

export default SkillhubStudentTable;
