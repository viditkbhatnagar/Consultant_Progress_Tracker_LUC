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
    Autocomplete,
    Checkbox,
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

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const SOURCES = [
    'Google Ads', 'Facebook', 'Tik Tok', 'Call-In', 'Old Crm',
    'Linkedin', 'Whatsapp', 'Alumni', 'Seo', 'B2C', 'Open Day',
    'Instagram', 'Reference',
];

const COMMON_PROGRAMS = [
    'MBA', 'BBA', 'BSc', 'DBA', 'OTHM L7 + MBA', 'OTHM + BBA',
    'OTHM + BSC', 'MBA Premium', 'BSc Premium', 'BBA Premium',
    'DBA Premium', 'OTHM Diploma Extended L5', 'OTHM Diploma Level 3',
    'OTHM Diploma Level 4', 'OTHM Diploma Level 5', 'OTHM Diploma Level 6',
    'OTHM Diploma Level 7', 'IoSCM', 'UniFash',
    'AGI Standalone Certificate', 'AGI Standalone Manager',
];

const PROGRAMS_BY_UNIVERSITY = {
    'Swiss School of Management (SSM)': [
        ...COMMON_PROGRAMS, 'Ext L5 + BBA', 'OTHM L7+SSM MBA', 'MBA General',
        'MBA Others', 'Top-up MBA Standalone', 'BBA Level 4 & 5',
        'BBA Extended Level 5', 'Top-up BBA Standalone', 'Level 3 Diploma',
        'Level 4 Diploma', 'Level 5 Diploma', 'Level 5 Extended Diploma',
        'Level 6 Diploma', 'Level 7 Diploma', 'Other',
    ],
    'Knights College': [
        ...COMMON_PROGRAMS, 'MBA + Premium', 'OTHM+BSC', 'MBA OTHM Level 7',
        'Top-up MBA Standalone', 'BSc OTHM Level 4 & 5',
        'BSc OTHM Extended Level 5', 'BSc Top-up Standalone', 'Other',
    ],
    'Malaysia University of Science & Technology (MUST)': [
        ...COMMON_PROGRAMS, 'Other',
    ],
    'AGI – American Global Institute (Certifications)': [
        ...COMMON_PROGRAMS, 'Pathway Program Certification',
        'Standalone – Professional Certification',
        'Standalone – Manager Certification', 'SSM MBA Plus Certification',
        'SSM BBA Plus Certification', 'CMBS MBA Plus Certification',
        'CMBS BSc Plus Certification', 'MUST MBA Plus Certification', 'Other',
    ],
    'CMBS': [
        ...COMMON_PROGRAMS, 'BSC', 'B.Sc', 'Ext L5 + BBA',
        'Ext L5 + B.Sc', 'Ext lev 5+ Bsc', 'Other',
    ],
    'OTHM': [
        ...COMMON_PROGRAMS, 'Level 4 & 5', 'Level 6', 'Level 7',
        'Level 3 Diploma', 'Level 4 Diploma', 'Level 5 Diploma',
        'Level 6 Diploma', 'Level 7 Diploma', 'Other',
    ],
};

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
        team: '',
        month: [],
        program: '',
        source: '',
        conversionOperator: '',
        conversionDays: '',
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
                team: filters.team || undefined,
                month: filters.month.length > 0 ? filters.month : undefined,
                program: filters.program || undefined,
                source: filters.source || undefined,
                conversionOperator: filters.conversionOperator || undefined,
                conversionDays: filters.conversionDays || undefined,
            });
            setStudents(response.data || []);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load students');
        } finally {
            setLoading(false);
        }
    }, [filters.startDate, filters.endDate, filters.consultant, filters.university, filters.team, filters.month, filters.program, filters.source, filters.conversionOperator, filters.conversionDays]);

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
            team: '',
            month: [],
            program: '',
            source: '',
            conversionOperator: '',
            conversionDays: '',
            search: '',
        });
    };

    // Get available programs based on selected university filter
    const getFilterPrograms = () => {
        if (filters.university) {
            return PROGRAMS_BY_UNIVERSITY[filters.university] || [];
        }
        const allPrograms = new Set();
        Object.values(PROGRAMS_BY_UNIVERSITY).forEach(programs => {
            programs.forEach(p => allPrograms.add(p));
        });
        return [...allPrograms].sort();
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
            'Phone': student.phone,
            'Email': student.email,
            'Program': student.program,
            'University': student.university,
            'Course Fee (AED)': student.courseFee,
            'Admission Fee Paid (AED)': student.admissionFeePaid || 0,
            'Source': student.source,
            'Open Day': student.openDay || '',
            'Open Day Location': student.openDayLocation || '',
            'Referred By': student.referredBy || '',
            'Campaign Name': student.campaignName,
            'Enquiry Date': student.enquiryDate ? format(new Date(student.enquiryDate), 'yyyy-MM-dd') : '',
            'Closing Date': student.closingDate ? format(new Date(student.closingDate), 'yyyy-MM-dd') : '',
            'Conversion Time (Days)': student.conversionTime,
            'Consultant': student.consultantName,
            'Team Leader': student.teamLeadName,
            'Residence': student.residence,
            'Area': student.area,
            'Nationality': student.nationality,
            'Region/Country': student.region,
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
            'Phone': student.phone,
            'Email': student.email,
            'Program': student.program,
            'University': student.university,
            'Course Fee (AED)': student.courseFee,
            'Admission Fee Paid (AED)': student.admissionFeePaid || 0,
            'Source': student.source,
            'Open Day': student.openDay || '',
            'Open Day Location': student.openDayLocation || '',
            'Referred By': student.referredBy || '',
            'Campaign Name': student.campaignName,
            'Enquiry Date': student.enquiryDate ? format(new Date(student.enquiryDate), 'yyyy-MM-dd') : '',
            'Closing Date': student.closingDate ? format(new Date(student.closingDate), 'yyyy-MM-dd') : '',
            'Conversion Time (Days)': student.conversionTime,
            'Consultant': student.consultantName,
            'Team Leader': student.teamLeadName,
            'Residence': student.residence,
            'Area': student.area,
            'Nationality': student.nationality,
            'Region/Country': student.region,
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
                                {currentUserRole === 'admin' && (
                                    <TextField
                                        select
                                        label="Team"
                                        value={filters.team}
                                        onChange={handleFilterChange('team')}
                                        size="small"
                                        sx={{ minWidth: 180 }}
                                        InputLabelProps={{ shrink: true }}
                                        SelectProps={{ native: true }}
                                    >
                                        <option value="">All Teams</option>
                                        {teamLeads.map(tl => (
                                            <option key={tl._id} value={tl.teamName}>
                                                {tl.teamName}
                                            </option>
                                        ))}
                                    </TextField>
                                )}
                                <TextField
                                    select
                                    label="University"
                                    value={filters.university}
                                    onChange={(e) => {
                                        const newUniversity = e.target.value;
                                        setFilters(prev => {
                                            const updated = { ...prev, university: newUniversity };
                                            // Reset program if not available in new university
                                            if (newUniversity && prev.program) {
                                                const available = PROGRAMS_BY_UNIVERSITY[newUniversity] || [];
                                                if (!available.includes(prev.program)) {
                                                    updated.program = '';
                                                }
                                            }
                                            return updated;
                                        });
                                    }}
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
                                <Autocomplete
                                    multiple
                                    size="small"
                                    options={MONTHS}
                                    value={filters.month}
                                    onChange={(e, value) => setFilters(prev => ({ ...prev, month: value }))}
                                    disableCloseOnSelect
                                    renderOption={(props, option, { selected }) => (
                                        <li {...props}>
                                            <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                                            {option}
                                        </li>
                                    )}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Month" placeholder={filters.month.length === 0 ? 'All Months' : ''} InputLabelProps={{ shrink: true }} />
                                    )}
                                    sx={{ minWidth: 250 }}
                                />
                                <TextField
                                    select
                                    label="Program"
                                    value={filters.program}
                                    onChange={handleFilterChange('program')}
                                    size="small"
                                    sx={{ minWidth: 200 }}
                                    InputLabelProps={{ shrink: true }}
                                    SelectProps={{ native: true }}
                                >
                                    <option value="">All Programs</option>
                                    {getFilterPrograms().map(prog => (
                                        <option key={prog} value={prog}>
                                            {prog}
                                        </option>
                                    ))}
                                </TextField>
                                <TextField
                                    select
                                    label="Source"
                                    value={filters.source}
                                    onChange={handleFilterChange('source')}
                                    size="small"
                                    sx={{ minWidth: 160 }}
                                    InputLabelProps={{ shrink: true }}
                                    SelectProps={{ native: true }}
                                >
                                    <option value="">All Sources</option>
                                    {SOURCES.map(src => (
                                        <option key={src} value={src}>
                                            {src}
                                        </option>
                                    ))}
                                </TextField>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    <TextField
                                        select
                                        label="Conv. Time"
                                        value={filters.conversionOperator}
                                        onChange={handleFilterChange('conversionOperator')}
                                        size="small"
                                        sx={{ minWidth: 140 }}
                                        InputLabelProps={{ shrink: true }}
                                        SelectProps={{ native: true }}
                                    >
                                        <option value="">Any</option>
                                        <option value="gt">Greater than</option>
                                        <option value="lt">Less than</option>
                                    </TextField>
                                    <TextField
                                        size="small"
                                        label="Days"
                                        type="number"
                                        value={filters.conversionDays}
                                        onChange={handleFilterChange('conversionDays')}
                                        sx={{ width: 90 }}
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ min: 0 }}
                                        disabled={!filters.conversionOperator}
                                    />
                                </Box>
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
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 140 }}>Phone</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 200 }}>Email</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 200 }}>Program</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 150 }}>University</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }} align="right">Course Fee</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 130 }} align="right">Admission Fee</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Source</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Open Day</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 150 }}>Open Day Location</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 150 }}>Referred By</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 200 }}>Campaign</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Enquiry Date</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Closing Date</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 100 }} align="center">Conv. Time</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 140 }}>Consultant</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 140 }}>Team Leader</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Residence</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 100 }}>Area</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Nationality</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 150 }}>Region/Country</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 200 }}>Company</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 180 }}>Designation</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 80 }} align="center">Exp</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 120 }}>Industry</TableCell>
                                            <TableCell sx={{ fontWeight: 700, backgroundColor: '#1976d2', color: 'white', whiteSpace: 'nowrap', minWidth: 150 }}>Dept</TableCell>
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
                                                <TableCell sx={{ fontWeight: 500 }}>{index + 1}</TableCell>
                                                <TableCell>{student.month}</TableCell>
                                                <TableCell sx={{ fontWeight: 600, fontFamily: '"Georgia", "Times New Roman", serif', fontSize: '0.95rem' }}>{student.studentName}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={student.gender}
                                                        size="small"
                                                        color={student.gender === 'Male' ? 'primary' : 'secondary'}
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                                <TableCell>{student.phone}</TableCell>
                                                <TableCell>
                                                    <Tooltip title={student.email || ''}>
                                                        <Typography noWrap sx={{ maxWidth: 180 }}>
                                                            {student.email}
                                                        </Typography>
                                                    </Tooltip>
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
                                                            label={student.university?.match(/\(([^)]+)\)/)?.[1] || student.university?.split(' ')[0]}
                                                            size="small"
                                                            variant="outlined"
                                                            color="info"
                                                        />
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                                                    AED {student.courseFee?.toLocaleString()}
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600, color: '#1565c0' }}>
                                                    AED {student.admissionFeePaid?.toLocaleString() || 0}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={student.source} size="small" />
                                                </TableCell>
                                                <TableCell>{student.openDay || '-'}</TableCell>
                                                <TableCell>{student.openDayLocation || '-'}</TableCell>
                                                <TableCell>{student.referredBy || '-'}</TableCell>
                                                <TableCell>
                                                    <Tooltip title={student.campaignName}>
                                                        <Typography noWrap sx={{ maxWidth: 180 }}>
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
                                                <TableCell>{student.region}</TableCell>
                                                <TableCell>
                                                    <Tooltip title={student.companyName}>
                                                        <Typography noWrap sx={{ maxWidth: 180 }}>
                                                            {student.companyName}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <Tooltip title={student.designation}>
                                                        <Typography noWrap sx={{ maxWidth: 160 }}>
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
                                                        <Typography noWrap sx={{ maxWidth: 130 }}>
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
