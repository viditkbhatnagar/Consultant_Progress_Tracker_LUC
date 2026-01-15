import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    Alert,
    InputAdornment,
    CircularProgress,
    Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// University options
const UNIVERSITIES = [
    'Swiss School of Management (SSM)',
    'Knights College',
    'Malaysia University of Science & Technology (MUST)',
    'AGI – American Global Institute (Certifications)',
    'CMBS',
    'OTHM',
];

// Programs by university
const PROGRAMS_BY_UNIVERSITY = {
    'Swiss School of Management (SSM)': [
        'MBA',
        'DBA',
        'BBA',
        'Ext L5 + BBA',
        'OTHM L7 + MBA',
        'OTHM L7+SSM MBA',
        'MBA General',
        'MBA Others',
        'Top-up MBA Standalone',
        'BBA Level 4 & 5',
        'BBA Extended Level 5',
        'Top-up BBA Standalone',
        'Level 3 Diploma',
        'Level 4 Diploma',
        'Level 5 Diploma',
        'Level 5 Extended Diploma',
        'Level 6 Diploma',
        'Level 7 Diploma',
        'Other',
    ],
    'Knights College': [
        'MBA',
        'BSC',
        'MBA + Premium',
        'OTHM+BSC',
        'MBA OTHM Level 7',
        'Top-up MBA Standalone',
        'BSc OTHM Level 4 & 5',
        'BSc OTHM Extended Level 5',
        'BSc Top-up Standalone',
        'Other',
    ],
    'Malaysia University of Science & Technology (MUST)': [
        'MBA',
        'Other',
    ],
    'AGI – American Global Institute (Certifications)': [
        'Pathway Program Certification',
        'Standalone – Professional Certification',
        'Standalone – Manager Certification',
        'SSM MBA Plus Certification',
        'SSM BBA Plus Certification',
        'CMBS MBA Plus Certification',
        'CMBS BSc Plus Certification',
        'MUST MBA Plus Certification',
        'Other',
    ],
    'CMBS': [
        'MBA',
        'BSC',
        'BSc',
        'B.Sc',
        'BBA',
        'Ext L5 + BBA',
        'Ext L5 + B.Sc',
        'Ext lev 5+ Bsc',
        'OTHM L7 + MBA',
        'Other',
    ],
    'OTHM': [
        'Level 4 & 5',
        'Level 6',
        'Level 7',
        'Level 3 Diploma',
        'Level 4 Diploma',
        'Level 5 Diploma',
        'Level 6 Diploma',
        'Level 7 Diploma',
        'Other',
    ],
};

// Source options
const SOURCES = [
    'Google Ads',
    'Facebook',
    'Tik Tok',
    'Call-In',
    'Old Crm',
    'Linkedin',
    'Whatsapp',
    'Alumni',
    'Seo',
    'B2C',
    'Open Day',
    'Instagram',
    'Reference',
];

// Gender options
const GENDERS = ['Male', 'Female'];

const StudentFormDialog = ({
    open,
    onClose,
    onSave,
    student,
    consultants,
    teamLeads,
    currentUserRole,
    currentUser,
}) => {
    const [formData, setFormData] = useState({
        studentName: '',
        gender: '',
        university: '',
        program: '',
        courseFee: '',
        source: '',
        campaignName: '',
        enquiryDate: null,
        closingDate: null,
        consultantName: '',
        consultantId: '',
        residence: '',
        area: '',
        nationality: '',
        companyName: '',
        designation: '',
        experience: '',
        industryType: '',
        deptType: '',
        teamLeadId: '',
    });

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [availablePrograms, setAvailablePrograms] = useState([]);

    useEffect(() => {
        if (student) {
            setFormData({
                studentName: student.studentName || '',
                gender: student.gender || '',
                university: student.university || '',
                program: student.program || '',
                courseFee: student.courseFee || '',
                source: student.source || '',
                campaignName: student.campaignName || '',
                enquiryDate: student.enquiryDate ? new Date(student.enquiryDate) : null,
                closingDate: student.closingDate ? new Date(student.closingDate) : null,
                consultantName: student.consultantName || '',
                consultantId: student.consultant?._id || '',
                residence: student.residence || '',
                area: student.area || '',
                nationality: student.nationality || '',
                companyName: student.companyName || '',
                designation: student.designation || '',
                experience: student.experience || '',
                industryType: student.industryType || '',
                deptType: student.deptType || '',
                teamLeadId: student.teamLead?._id || '',
            });
            if (student.university) {
                setAvailablePrograms(PROGRAMS_BY_UNIVERSITY[student.university] || []);
            }
        } else {
            setFormData({
                studentName: '',
                gender: '',
                university: '',
                program: '',
                courseFee: '',
                source: '',
                campaignName: '',
                enquiryDate: null,
                closingDate: null,
                consultantName: '',
                consultantId: '',
                residence: '',
                area: '',
                nationality: '',
                companyName: '',
                designation: '',
                experience: '',
                industryType: '',
                deptType: '',
                teamLeadId: currentUserRole === 'team_lead' ? currentUser?._id : '',
            });
            setAvailablePrograms([]);
        }
        setError('');
    }, [student, open, currentUserRole, currentUser]);

    useEffect(() => {
        if (formData.university) {
            setAvailablePrograms(PROGRAMS_BY_UNIVERSITY[formData.university] || []);
            if (!PROGRAMS_BY_UNIVERSITY[formData.university]?.includes(formData.program)) {
                setFormData(prev => ({ ...prev, program: '' }));
            }
        } else {
            setAvailablePrograms([]);
        }
    }, [formData.university]);

    const handleChange = (field) => (event) => {
        const value = event.target.value;
        setFormData(prev => ({ ...prev, [field]: value }));

        if (field === 'consultantName') {
            const selectedConsultant = consultants.find(c => c.name === value);
            if (selectedConsultant) {
                setFormData(prev => ({
                    ...prev,
                    consultantName: value,
                    consultantId: selectedConsultant._id,
                }));
            }
        }
    };

    const handleDateChange = (field) => (date) => {
        setFormData(prev => ({ ...prev, [field]: date }));
    };

    const getConversionTime = () => {
        if (formData.enquiryDate && formData.closingDate) {
            const enquiry = new Date(formData.enquiryDate);
            const closing = new Date(formData.closingDate);
            const diffTime = Math.abs(closing - enquiry);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        }
        return 0;
    };

    const validateForm = () => {
        const requiredFields = [
            'studentName', 'gender', 'university', 'program', 'courseFee',
            'source', 'campaignName', 'enquiryDate', 'closingDate', 'consultantName',
            'residence', 'area', 'nationality', 'companyName', 'designation',
            'experience', 'industryType', 'deptType'
        ];

        for (const field of requiredFields) {
            if (!formData[field] && formData[field] !== 0) {
                return `Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
            }
        }

        if (currentUserRole === 'admin' && !formData.teamLeadId) {
            return 'Please select a team lead';
        }

        return null;
    };

    const handleSubmit = async () => {
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError('');

        try {
            await onSave({
                ...formData,
                courseFee: Number(formData.courseFee),
                experience: Number(formData.experience),
            });
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save student');
        } finally {
            setLoading(false);
        }
    };

    const rowStyle = { display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap' };
    const fieldStyle = { flex: 1, minWidth: 200 };
    const fullWidthStyle = { width: '100%', mb: 2.5 };

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth="md" 
            fullWidth
            PaperProps={{
                sx: {
                    minHeight: '85vh',
                    maxHeight: '95vh',
                }
            }}
        >
            <DialogTitle sx={{ 
                backgroundColor: '#1976d2', 
                color: 'white',
                pb: 2 
            }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {student ? 'Edit Student' : 'Add New Student'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Fill in all the required fields to {student ? 'update' : 'add'} a student record
                </Typography>
            </DialogTitle>
            
            <DialogContent sx={{ p: 4, backgroundColor: '#fafafa', overflowY: 'auto' }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 3, mt: 1 }}>
                            {error}
                        </Alert>
                    )}

                    {/* Section 1: Basic Information */}
                    <Box sx={{ mb: 4, mt: 2 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: '#1976d2', fontWeight: 600 }}>
                            Basic Information
                        </Typography>
                        <Divider sx={{ mb: 3 }} />
                        
                        <Box sx={rowStyle}>
                            <TextField
                                sx={{ flex: 2, minWidth: 250 }}
                                label="Student Name"
                                value={formData.studentName}
                                onChange={handleChange('studentName')}
                                required
                                placeholder="Enter student's full name"
                            />
                            <TextField
                                sx={{ flex: 1, minWidth: 150 }}
                                select
                                label="Gender"
                                value={formData.gender}
                                onChange={handleChange('gender')}
                                required
                                InputLabelProps={{ shrink: true }}
                                SelectProps={{ native: true }}
                            >
                                <option value="">Select Gender</option>
                                {GENDERS.map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </TextField>
                        </Box>

                        <Box sx={rowStyle}>
                            <TextField
                                sx={fieldStyle}
                                label="Nationality"
                                value={formData.nationality}
                                onChange={handleChange('nationality')}
                                required
                                placeholder="e.g., UAE, India"
                            />
                            <TextField
                                sx={fieldStyle}
                                label="Residence"
                                value={formData.residence}
                                onChange={handleChange('residence')}
                                required
                                placeholder="e.g., Dubai, Abu Dhabi"
                            />
                            <TextField
                                sx={fieldStyle}
                                label="Area"
                                value={formData.area}
                                onChange={handleChange('area')}
                                required
                                placeholder="e.g., Downtown, Marina"
                            />
                        </Box>
                    </Box>

                    {/* Section 2: Academic Information */}
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: '#1976d2', fontWeight: 600 }}>
                            Academic Information
                        </Typography>
                        <Divider sx={{ mb: 3 }} />
                        
                        <TextField
                            sx={fullWidthStyle}
                            select
                            label="University"
                            value={formData.university}
                            onChange={handleChange('university')}
                            required
                            InputLabelProps={{ shrink: true }}
                            SelectProps={{ native: true }}
                        >
                            <option value="">Select University</option>
                            {UNIVERSITIES.map(uni => (
                                <option key={uni} value={uni}>{uni}</option>
                            ))}
                        </TextField>

                        <TextField
                            sx={fullWidthStyle}
                            select
                            label="Program"
                            value={formData.program}
                            onChange={handleChange('program')}
                            required
                            disabled={!formData.university}
                            InputLabelProps={{ shrink: true }}
                            SelectProps={{ native: true }}
                        >
                            <option value="">Select Program</option>
                            {availablePrograms.map(prog => (
                                <option key={prog} value={prog}>{prog}</option>
                            ))}
                        </TextField>

                        <TextField
                            sx={{ width: '50%', minWidth: 200 }}
                            label="Course Fee"
                            type="number"
                            value={formData.courseFee}
                            onChange={handleChange('courseFee')}
                            required
                            placeholder="Enter amount"
                            InputProps={{
                                startAdornment: <InputAdornment position="start">AED</InputAdornment>,
                            }}
                        />
                    </Box>

                    {/* Section 3: Lead Source & Campaign */}
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: '#1976d2', fontWeight: 600 }}>
                            Lead Source & Campaign
                        </Typography>
                        <Divider sx={{ mb: 3 }} />
                        
                        <Box sx={rowStyle}>
                            <TextField
                                sx={fieldStyle}
                                select
                                label="Source"
                                value={formData.source}
                                onChange={handleChange('source')}
                                required
                                InputLabelProps={{ shrink: true }}
                                SelectProps={{ native: true }}
                            >
                                <option value="">Select Source</option>
                                {SOURCES.map(src => (
                                    <option key={src} value={src}>{src}</option>
                                ))}
                            </TextField>
                            <TextField
                                sx={fieldStyle}
                                label="Campaign Name"
                                value={formData.campaignName}
                                onChange={handleChange('campaignName')}
                                required
                                placeholder="Enter campaign name"
                            />
                        </Box>
                    </Box>

                    {/* Section 4: Dates & Conversion */}
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: '#1976d2', fontWeight: 600 }}>
                            Dates & Conversion
                        </Typography>
                        <Divider sx={{ mb: 3 }} />
                        
                        <Box sx={rowStyle}>
                            <Box sx={fieldStyle}>
                                <DatePicker
                                    label="Enquiry Date"
                                    value={formData.enquiryDate}
                                    onChange={handleDateChange('enquiryDate')}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            required: true,
                                        },
                                    }}
                                />
                            </Box>
                            <Box sx={fieldStyle}>
                                <DatePicker
                                    label="Closing Date"
                                    value={formData.closingDate}
                                    onChange={handleDateChange('closingDate')}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            required: true,
                                        },
                                    }}
                                />
                            </Box>
                            <TextField
                                sx={fieldStyle}
                                label="Conversion Time"
                                value={`${getConversionTime()} days`}
                                disabled
                                InputProps={{ readOnly: true }}
                                helperText="Auto-calculated"
                            />
                        </Box>
                    </Box>

                    {/* Section 5: Team Assignment */}
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: '#1976d2', fontWeight: 600 }}>
                            Team Assignment
                        </Typography>
                        <Divider sx={{ mb: 3 }} />
                        
                        <Box sx={rowStyle}>
                            <TextField
                                sx={fieldStyle}
                                select
                                label="Consultant"
                                value={formData.consultantName}
                                onChange={handleChange('consultantName')}
                                required
                                InputLabelProps={{ shrink: true }}
                                SelectProps={{ native: true }}
                            >
                                <option value="">Select Consultant</option>
                                {consultants.map(c => (
                                    <option key={c._id || c.name} value={c.name}>{c.name}</option>
                                ))}
                            </TextField>
                            
                            {currentUserRole === 'admin' && (
                                <TextField
                                    sx={fieldStyle}
                                    select
                                    label="Team Lead"
                                    value={formData.teamLeadId}
                                    onChange={handleChange('teamLeadId')}
                                    required
                                    InputLabelProps={{ shrink: true }}
                                    SelectProps={{ native: true }}
                                >
                                    <option value="">Select Team Lead</option>
                                    {teamLeads?.map(tl => (
                                        <option key={tl._id} value={tl._id}>
                                            {tl.name} ({tl.teamName})
                                        </option>
                                    ))}
                                </TextField>
                            )}
                        </Box>
                    </Box>

                    {/* Section 6: Professional Information */}
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: '#1976d2', fontWeight: 600 }}>
                            Professional Information
                        </Typography>
                        <Divider sx={{ mb: 3 }} />
                        
                        <Box sx={rowStyle}>
                            <TextField
                                sx={fieldStyle}
                                label="Company Name"
                                value={formData.companyName}
                                onChange={handleChange('companyName')}
                                required
                                placeholder="Enter company name"
                            />
                            <TextField
                                sx={fieldStyle}
                                label="Designation"
                                value={formData.designation}
                                onChange={handleChange('designation')}
                                required
                                placeholder="Enter job title"
                            />
                        </Box>

                        <Box sx={rowStyle}>
                            <TextField
                                sx={fieldStyle}
                                label="Experience (Years)"
                                type="number"
                                value={formData.experience}
                                onChange={handleChange('experience')}
                                required
                                inputProps={{ min: 0 }}
                                placeholder="e.g., 5"
                            />
                            <TextField
                                sx={fieldStyle}
                                label="Industry Type"
                                value={formData.industryType}
                                onChange={handleChange('industryType')}
                                required
                                placeholder="e.g., IT, Healthcare"
                            />
                            <TextField
                                sx={fieldStyle}
                                label="Department Type"
                                value={formData.deptType}
                                onChange={handleChange('deptType')}
                                required
                                placeholder="e.g., Engineering, HR"
                            />
                        </Box>
                    </Box>
                </LocalizationProvider>
            </DialogContent>
            
            <DialogActions sx={{ 
                p: 3, 
                backgroundColor: '#E5EAF5',
                borderTop: '1px solid #ccc'
            }}>
                <Button 
                    onClick={onClose} 
                    disabled={loading}
                    variant="outlined"
                    size="large"
                    sx={{ minWidth: 120 }}
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={loading}
                    size="large"
                    sx={{ minWidth: 150 }}
                    startIcon={loading && <CircularProgress size={20} color="inherit" />}
                >
                    {student ? 'Update' : 'Add'} Student
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default StudentFormDialog;
