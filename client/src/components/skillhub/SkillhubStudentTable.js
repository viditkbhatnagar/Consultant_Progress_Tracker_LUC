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
    Typography,
    TextField,
    InputAdornment,
    CircularProgress,
    Alert,
    Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import studentService from '../../services/studentService';
import SkillhubStudentFormDialog from './SkillhubStudentFormDialog';
import ActivateStudentDialog from './ActivateStudentDialog';

const SkillhubStudentTable = ({ counselors, onChange }) => {
    const [statusTab, setStatusTab] = useState('new_admission');
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [activateOpen, setActivateOpen] = useState(false);
    const [activatingStudent, setActivatingStudent] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await studentService.getStudents({ studentStatus: statusTab });
            setStudents(res.data || []);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load students');
        } finally {
            setLoading(false);
        }
    }, [statusTab]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = () => {
        setEditingStudent(null);
        setFormOpen(true);
    };

    const handleEdit = (student) => {
        setEditingStudent(student);
        setFormOpen(true);
    };

    const handleSave = async (formData) => {
        if (editingStudent) {
            await studentService.updateStudent(editingStudent._id, formData);
        } else {
            await studentService.createStudent(formData);
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

    const handleActivateClick = (student) => {
        setActivatingStudent(student);
        setActivateOpen(true);
    };

    const handleActivate = async (payload) => {
        await studentService.activateStudent(activatingStudent._id, payload);
        await load();
        onChange?.();
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
            <Tabs
                value={statusTab}
                onChange={(_, v) => setStatusTab(v)}
                sx={{ mb: 2 }}
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
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreate}
                >
                    New Admission
                </Button>
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
                                <TableCell>Counselor</TableCell>
                                <TableCell>Mode</TableCell>
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
                                    <TableCell>{s.consultantName || '-'}</TableCell>
                                    <TableCell>{s.mode || '-'}</TableCell>
                                    <TableCell align="right">
                                        {(s.courseFee || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell align="right">
                                        {(s.outstandingAmount ?? 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell align="center">
                                        {statusTab === 'new_admission' && (
                                            <Tooltip title="Mark as Active">
                                                <IconButton
                                                    size="small"
                                                    color="success"
                                                    onClick={() => handleActivateClick(s)}
                                                >
                                                    <CheckCircleIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
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
            />
            <ActivateStudentDialog
                open={activateOpen}
                onClose={() => setActivateOpen(false)}
                onConfirm={handleActivate}
                student={activatingStudent}
            />
        </Paper>
    );
};

export default SkillhubStudentTable;
