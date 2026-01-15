import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Button,
    TextField,
    MenuItem,
    Chip,
    Alert,
    CircularProgress,
    Menu,
    Tooltip,
    Paper,
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Download as DownloadIcon,
    FilterList as FilterIcon,
    Clear as ClearIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import studentService from '../services/studentService';
import exportService from '../services/exportService';
import StudentFormDialog from './StudentFormDialog';

// University options for filter
const UNIVERSITIES = [
    'Swiss School of Management (SSM)',
    'Knights College',
    'Malaysia University of Science & Technology (MUST)',
    'AGI – American Global Institute (Certifications)',
    'CMBS',
    'OTHM',
];

const StudentTable = ({
    consultants,
    teamLeads,
    currentUserRole,
    currentUser,
}) => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [exportMenuAnchor, setExportMenuAnchor] = useState(null);

    // Filters
    const [filters, setFilters] = useState({
        startDate: startOfMonth(new Date()),
        endDate: endOfMonth(new Date()),
        consultant: '',
        university: '',
        search: '',
    });
    const [showFilters, setShowFilters] = useState(true);

    // Load students
    const loadStudents = useCallback(async () => {
        try {
            setLoading(true);
            const response = await studentService.getStudents({
                startDate: filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : undefined,
                endDate: filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : undefined,
                consultant: filters.consultant || undefined,
                university: filters.university || undefined,
            });
            setStudents(response.data || []);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load students');
        } finally {
            setLoading(false);
        }
    }, [filters.startDate, filters.endDate, filters.consultant, filters.university]);

    useEffect(() => {
        loadStudents();
    }, [loadStudents]);

    // Filter students by search term (client-side)
    const filteredStudents = students.filter(student => {
        if (!filters.search) return true;
        const searchLower = filters.search.toLowerCase();
        return (
            student.studentName?.toLowerCase().includes(searchLower) ||
            student.consultantName?.toLowerCase().includes(searchLower) ||
            student.university?.toLowerCase().includes(searchLower) ||
            student.program?.toLowerCase().includes(searchLower) ||
            student.campaignName?.toLowerCase().includes(searchLower)
        );
    });

    // Handle filter changes
    const handleFilterChange = (field) => (event) => {
        setFilters(prev => ({ ...prev, [field]: event.target.value }));
    };

    const handleDateFilterChange = (field) => (date) => {
        setFilters(prev => ({ ...prev, [field]: date }));
    };

    const clearFilters = () => {
        setFilters({
            startDate: startOfMonth(new Date()),
            endDate: endOfMonth(new Date()),
            consultant: '',
            university: '',
            search: '',
        });
    };

    // CRUD operations
    const handleAddStudent = () => {
        setSelectedStudent(null);
        setDialogOpen(true);
    };

    const handleEditStudent = (student) => {
        setSelectedStudent(student);
        setDialogOpen(true);
    };

    const handleDeleteStudent = async (studentId) => {
        if (!window.confirm('Are you sure you want to delete this student record? This action cannot be undone.')) {
            return;
        }

        try {
            await studentService.deleteStudent(studentId);
            await loadStudents();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete student');
        }
    };

    const handleSaveStudent = async (studentData) => {
        if (selectedStudent) {
            await studentService.updateStudent(selectedStudent._id, studentData);
        } else {
            await studentService.createStudent(studentData);
        }
        await loadStudents();
    };

    // Export functions
    const handleExportExcel = () => {
        const data = filteredStudents.map(student => ({
            'S.No': student.sno,
            'Month': student.month,
            'Student Name': student.studentName,
            'Gender': student.gender,
            'Program': student.program,
            'University': student.university,
            'Course Fee (AED)': student.courseFee,
            'Source': student.source,
            'Campaign Name': student.campaignName,
            'Enquiry Date': student.enquiryDate ? format(new Date(student.enquiryDate), 'yyyy-MM-dd') : '',
            'Closing Date': student.closingDate ? format(new Date(student.closingDate), 'yyyy-MM-dd') : '',
            'Conversion Time (Days)': student.conversionTime,
            'Consultant': student.consultantName,
            'Team Leader': student.teamLeadName,
            'Residence': student.residence,
            'Area': student.area,
            'Nationality': student.nationality,
            'Company Name': student.companyName,
            'Designation': student.designation,
            'Experience (Years)': student.experience,
            'Industry Type': student.industryType,
            'Dept Type': student.deptType,
        }));

        exportService.exportToExcel(data, 'student_database');
        setExportMenuAnchor(null);
    };

    const handleExportCSV = () => {
        const data = filteredStudents.map(student => ({
            'S.No': student.sno,
            'Month': student.month,
            'Student Name': student.studentName,
            'Gender': student.gender,
            'Program': student.program,
            'University': student.university,
            'Course Fee (AED)': student.courseFee,
            'Source': student.source,
            'Campaign Name': student.campaignName,
            'Enquiry Date': student.enquiryDate ? format(new Date(student.enquiryDate), 'yyyy-MM-dd') : '',
            'Closing Date': student.closingDate ? format(new Date(student.closingDate), 'yyyy-MM-dd') : '',
            'Conversion Time (Days)': student.conversionTime,
            'Consultant': student.consultantName,
            'Team Leader': student.teamLeadName,
            'Residence': student.residence,
            'Area': student.area,
            'Nationality': student.nationality,
            'Company Name': student.companyName,
            'Designation': student.designation,
            'Experience (Years)': student.experience,
            'Industry Type': student.industryType,
            'Dept Type': student.deptType,
        }));

        exportService.exportToCSV(data, 'student_database');
        setExportMenuAnchor(null);
    };

    // Calculate totals
    const totalRevenue = filteredStudents.reduce((sum, s) => sum + (s.courseFee || 0), 0);
    const avgConversionTime = filteredStudents.length > 0
        ? Math.round(filteredStudents.reduce((sum, s) => sum + (s.conversionTime || 0), 0) / filteredStudents.length)
        : 0;

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Card sx={{ backgroundColor: '#E5EAF5', borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 600 }}>
                                Student Database
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Manage all admitted students and their records
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="outlined"
                                startIcon={<FilterIcon />}
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                {showFilters ? 'Hide Filters' : 'Show Filters'}
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                            >
                                Export
                            </Button>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={handleAddStudent}
                                size="large"
                            >
                                Add Student
                            </Button>
                        </Box>
                    </Box>

                    {/* Export Menu */}
                    <Menu
                        anchorEl={exportMenuAnchor}
                        open={Boolean(exportMenuAnchor)}
                        onClose={() => setExportMenuAnchor(null)}
                    >
                        <MenuItem onClick={handleExportExcel}>Export to Excel (.xlsx)</MenuItem>
                        <MenuItem onClick={handleExportCSV}>Export to CSV</MenuItem>
                    </Menu>

                    {/* Filters */}
                    {showFilters && (
                        <Paper sx={{ p: 3, mb: 3, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                                Filter Students
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                                <Box sx={{ minWidth: 150 }}>
                                    <DatePicker
                                        label="Start Date"
                                        value={filters.startDate}
                                        onChange={handleDateFilterChange('startDate')}
                                        slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                                    />
                                </Box>
                                <Box sx={{ minWidth: 150 }}>
                                    <DatePicker
                                        label="End Date"
                                        value={filters.endDate}
                                        onChange={handleDateFilterChange('endDate')}
                                        slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                                    />
                                </Box>
                                <TextField
                                    select
                                    label="Consultant"
                                    value={filters.consultant}
                                    onChange={handleFilterChange('consultant')}
                                    size="small"
                                    sx={{ minWidth: 180 }}
                                    InputLabelProps={{ shrink: true }}
                                    SelectProps={{ native: true }}
                                >
                                    <option value="">All Consultants</option>
                                    {consultants.map(c => (
                                        <option key={c._id || c.name} value={c.name}>
                                            {c.name}
                                        </option>
                                    ))}
                                </TextField>
                                <TextField
                                    select
                                    label="University"
                                    value={filters.university}
                                    onChange={handleFilterChange('university')}
                                    size="small"
                                    sx={{ minWidth: 200 }}
                                    InputLabelProps={{ shrink: true }}
                                    SelectProps={{ native: true }}
                                >
                                    <option value="">All Universities</option>
                                    {UNIVERSITIES.map(uni => (
                                        <option key={uni} value={uni}>
                                            {uni}
                                        </option>
                                    ))}
                                </TextField>
                                <TextField
                                    size="small"
                                    label="Search"
                                    placeholder="Search by name, program..."
                                    value={filters.search}
                                    onChange={handleFilterChange('search')}
                                    sx={{ minWidth: 200, flex: 1 }}
                                />
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    onClick={clearFilters}
                                    startIcon={<ClearIcon />}
                                >
                                    Clear
                                </Button>
                            </Box>
                        </Paper>
                    )}

                    {/* Summary Stats */}
                    <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                        <Chip
                            label={`Total Students: ${filteredStudents.length}`}
                            color="primary"
                            sx={{ fontSize: '0.95rem', py: 2.5, px: 1 }}
                        />
                        <Chip
                            label={`Total Revenue: AED ${totalRevenue.toLocaleString()}`}
                            color="success"
                            sx={{ fontSize: '0.95rem', py: 2.5, px: 1 }}
                        />
                        <Chip
                            label={`Avg Conversion: ${avgConversionTime} days`}
                            color="info"
                            sx={{ fontSize: '0.95rem', py: 2.5, px: 1 }}
                        />
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                            {error}
                        </Alert>
                    )}

                    {/* Table */}
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : filteredStudents.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 6 }}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                No students found
                            </Typography>
                            <Typography color="text.secondary">
                                {students.length === 0 ? 'Click "Add Student" to add your first student!' : 'Try adjusting your filters.'}
                            </Typography>
                        </Box>
                    ) : (
                        <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                            <TableContainer sx={{ maxHeight: 'calc(100vh - 450px)', minHeight: 400 }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 60 }}>S.No</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 100 }}>Month</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 180 }}>Student Name</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 80 }}>Gender</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 200 }}>Program</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 150 }}>University</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }} align="right">Course Fee</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Source</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 150 }}>Campaign</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Enquiry Date</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Closing Date</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 100 }} align="center">Conv. Time</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 140 }}>Consultant</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 140 }}>Team Leader</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Residence</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 100 }}>Area</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Nationality</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 150 }}>Company</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 140 }}>Designation</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 80 }} align="center">Exp</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Industry</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Dept</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 100, position: 'sticky', right: 0 }} align="center">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredStudents.map((student, index) => (
                                            <TableRow 
                                                key={student._id} 
                                                hover
                                                sx={{ 
                                                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f5f7fa',
                                                    '&:hover': { backgroundColor: '#e3f2fd' }
                                                }}
                                            >
                                                <TableCell sx={{ fontWeight: 500 }}>{student.sno}</TableCell>
                                                <TableCell>{student.month}</TableCell>
                                                <TableCell sx={{ fontWeight: 500 }}>{student.studentName}</TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={student.gender} 
                                                        size="small" 
                                                        color={student.gender === 'Male' ? 'primary' : 'secondary'}
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Tooltip title={student.program}>
                                                        <Typography noWrap sx={{ maxWidth: 180 }}>
                                                            {student.program}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <Tooltip title={student.university}>
                                                        <Chip
                                                            label={student.university?.split('(')[0]?.trim() || student.university?.split(' ')[0]}
                                                            size="small"
                                                            variant="outlined"
                                                            color="info"
                                                        />
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                                                    AED {student.courseFee?.toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={student.source} size="small" />
                                                </TableCell>
                                                <TableCell>
                                                    <Tooltip title={student.campaignName}>
                                                        <Typography noWrap sx={{ maxWidth: 130 }}>
                                                            {student.campaignName}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    {student.enquiryDate
                                                        ? format(new Date(student.enquiryDate), 'MMM d, yyyy')
                                                        : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {student.closingDate
                                                        ? format(new Date(student.closingDate), 'MMM d, yyyy')
                                                        : '-'}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Chip
                                                        label={`${student.conversionTime}d`}
                                                        size="small"
                                                        color={student.conversionTime <= 7 ? 'success' : student.conversionTime <= 30 ? 'warning' : 'default'}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 500 }}>{student.consultantName}</TableCell>
                                                <TableCell>{student.teamLeadName}</TableCell>
                                                <TableCell>{student.residence}</TableCell>
                                                <TableCell>{student.area}</TableCell>
                                                <TableCell>{student.nationality}</TableCell>
                                                <TableCell>
                                                    <Tooltip title={student.companyName}>
                                                        <Typography noWrap sx={{ maxWidth: 130 }}>
                                                            {student.companyName}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <Tooltip title={student.designation}>
                                                        <Typography noWrap sx={{ maxWidth: 120 }}>
                                                            {student.designation}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell align="center">{student.experience} yrs</TableCell>
                                                <TableCell>
                                                    <Tooltip title={student.industryType}>
                                                        <Typography noWrap sx={{ maxWidth: 100 }}>
                                                            {student.industryType}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <Tooltip title={student.deptType}>
                                                        <Typography noWrap sx={{ maxWidth: 100 }}>
                                                            {student.deptType}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell 
                                                    align="center"
                                                    sx={{ 
                                                        position: 'sticky', 
                                                        right: 0, 
                                                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#f5f7fa',
                                                        borderLeft: '1px solid #e0e0e0'
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                        <Tooltip title="Edit Student">
                                                            <IconButton
                                                                size="small"
                                                                color="primary"
                                                                onClick={() => handleEditStudent(student)}
                                                            >
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Delete Student">
                                                            <IconButton
                                                                size="small"
                                                                color="error"
                                                                onClick={() => handleDeleteStudent(student._id)}
                                                            >
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <StudentFormDialog
                open={dialogOpen}
                onClose={() => {
                    setDialogOpen(false);
                    setSelectedStudent(null);
                }}
                onSave={handleSaveStudent}
                student={selectedStudent}
                consultants={consultants}
                teamLeads={teamLeads}
                currentUserRole={currentUserRole}
                currentUser={currentUser}
            />
        </LocalizationProvider>
    );
};

export default StudentTable;
