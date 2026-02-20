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
    Autocomplete,
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

// Common programs available across all universities
const COMMON_PROGRAMS = [
    'MBA',
    'BBA',
    'BSc',
    'DBA',
    'OTHM L7 + MBA',
    'OTHM + BBA',
    'OTHM + BSC',
    'MBA Premium',
    'BSc Premium',
    'BBA Premium',
    'DBA Premium',
    'OTHM Diploma Extended L5',
    'OTHM Diploma Level 3',
    'OTHM Diploma Level 4',
    'OTHM Diploma Level 5',
    'OTHM Diploma Level 6',
    'OTHM Diploma Level 7',
    'IoSCM',
    'UniFash',
    'AGI Standalone Certificate',
    'AGI Standalone Manager',
];

// Programs by university (includes common programs + university-specific ones)
const PROGRAMS_BY_UNIVERSITY = {
    'Swiss School of Management (SSM)': [
        ...COMMON_PROGRAMS,
        'Ext L5 + BBA',
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
        ...COMMON_PROGRAMS,
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
        ...COMMON_PROGRAMS,
        'Other',
    ],
    'AGI – American Global Institute (Certifications)': [
        ...COMMON_PROGRAMS,
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
        ...COMMON_PROGRAMS,
        'BSC',
        'B.Sc',
        'Ext L5 + BBA',
        'Ext L5 + B.Sc',
        'Ext lev 5+ Bsc',
        'Other',
    ],
    'OTHM': [
        ...COMMON_PROGRAMS,
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

// Country codes with names for searchable dropdown
const COUNTRY_CODES = [
    { code: '+971', country: 'UAE', label: '+971 (UAE)' },
    { code: '+966', country: 'Saudi Arabia', label: '+966 (Saudi Arabia)' },
    { code: '+974', country: 'Qatar', label: '+974 (Qatar)' },
    { code: '+965', country: 'Kuwait', label: '+965 (Kuwait)' },
    { code: '+973', country: 'Bahrain', label: '+973 (Bahrain)' },
    { code: '+968', country: 'Oman', label: '+968 (Oman)' },
    { code: '+91', country: 'India', label: '+91 (India)' },
    { code: '+92', country: 'Pakistan', label: '+92 (Pakistan)' },
    { code: '+63', country: 'Philippines', label: '+63 (Philippines)' },
    { code: '+20', country: 'Egypt', label: '+20 (Egypt)' },
    { code: '+962', country: 'Jordan', label: '+962 (Jordan)' },
    { code: '+961', country: 'Lebanon', label: '+961 (Lebanon)' },
    { code: '+964', country: 'Iraq', label: '+964 (Iraq)' },
    { code: '+98', country: 'Iran', label: '+98 (Iran)' },
    { code: '+90', country: 'Turkey', label: '+90 (Turkey)' },
    { code: '+44', country: 'UK', label: '+44 (UK)' },
    { code: '+1', country: 'USA/Canada', label: '+1 (USA/Canada)' },
    { code: '+61', country: 'Australia', label: '+61 (Australia)' },
    { code: '+49', country: 'Germany', label: '+49 (Germany)' },
    { code: '+33', country: 'France', label: '+33 (France)' },
    { code: '+39', country: 'Italy', label: '+39 (Italy)' },
    { code: '+34', country: 'Spain', label: '+34 (Spain)' },
    { code: '+31', country: 'Netherlands', label: '+31 (Netherlands)' },
    { code: '+32', country: 'Belgium', label: '+32 (Belgium)' },
    { code: '+41', country: 'Switzerland', label: '+41 (Switzerland)' },
    { code: '+43', country: 'Austria', label: '+43 (Austria)' },
    { code: '+46', country: 'Sweden', label: '+46 (Sweden)' },
    { code: '+47', country: 'Norway', label: '+47 (Norway)' },
    { code: '+45', country: 'Denmark', label: '+45 (Denmark)' },
    { code: '+358', country: 'Finland', label: '+358 (Finland)' },
    { code: '+48', country: 'Poland', label: '+48 (Poland)' },
    { code: '+7', country: 'Russia', label: '+7 (Russia)' },
    { code: '+86', country: 'China', label: '+86 (China)' },
    { code: '+81', country: 'Japan', label: '+81 (Japan)' },
    { code: '+82', country: 'South Korea', label: '+82 (South Korea)' },
    { code: '+65', country: 'Singapore', label: '+65 (Singapore)' },
    { code: '+60', country: 'Malaysia', label: '+60 (Malaysia)' },
    { code: '+62', country: 'Indonesia', label: '+62 (Indonesia)' },
    { code: '+66', country: 'Thailand', label: '+66 (Thailand)' },
    { code: '+84', country: 'Vietnam', label: '+84 (Vietnam)' },
    { code: '+94', country: 'Sri Lanka', label: '+94 (Sri Lanka)' },
    { code: '+880', country: 'Bangladesh', label: '+880 (Bangladesh)' },
    { code: '+977', country: 'Nepal', label: '+977 (Nepal)' },
    { code: '+27', country: 'South Africa', label: '+27 (South Africa)' },
    { code: '+234', country: 'Nigeria', label: '+234 (Nigeria)' },
    { code: '+254', country: 'Kenya', label: '+254 (Kenya)' },
    { code: '+255', country: 'Tanzania', label: '+255 (Tanzania)' },
    { code: '+256', country: 'Uganda', label: '+256 (Uganda)' },
    { code: '+251', country: 'Ethiopia', label: '+251 (Ethiopia)' },
    { code: '+212', country: 'Morocco', label: '+212 (Morocco)' },
    { code: '+213', country: 'Algeria', label: '+213 (Algeria)' },
    { code: '+216', country: 'Tunisia', label: '+216 (Tunisia)' },
    { code: '+55', country: 'Brazil', label: '+55 (Brazil)' },
    { code: '+52', country: 'Mexico', label: '+52 (Mexico)' },
    { code: '+54', country: 'Argentina', label: '+54 (Argentina)' },
    { code: '+57', country: 'Colombia', label: '+57 (Colombia)' },
    { code: '+56', country: 'Chile', label: '+56 (Chile)' },
    { code: '+51', country: 'Peru', label: '+51 (Peru)' },
    { code: '+64', country: 'New Zealand', label: '+64 (New Zealand)' },
    { code: '+353', country: 'Ireland', label: '+353 (Ireland)' },
    { code: '+351', country: 'Portugal', label: '+351 (Portugal)' },
    { code: '+30', country: 'Greece', label: '+30 (Greece)' },
    { code: '+36', country: 'Hungary', label: '+36 (Hungary)' },
    { code: '+420', country: 'Czech Republic', label: '+420 (Czech Republic)' },
    { code: '+40', country: 'Romania', label: '+40 (Romania)' },
    { code: '+380', country: 'Ukraine', label: '+380 (Ukraine)' },
    { code: '+375', country: 'Belarus', label: '+375 (Belarus)' },
    { code: '+370', country: 'Lithuania', label: '+370 (Lithuania)' },
    { code: '+371', country: 'Latvia', label: '+371 (Latvia)' },
    { code: '+372', country: 'Estonia', label: '+372 (Estonia)' },
];

// Countries list
const COUNTRIES = [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia',
    'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium',
    'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei',
    'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde',
    'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica',
    'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
    'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia',
    'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada',
    'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India',
    'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan',
    'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho',
    'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia',
    'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia',
    'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru',
    'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia',
    'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
    'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis',
    'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
    'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
    'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka',
    'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand',
    'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu',
    'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
    'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
];

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
        phone: '',
        email: '',
        university: '',
        program: '',
        courseFee: '',
        admissionFeePaid: '',
        source: '',
        referredBy: '',
        openDay: '',
        openDayLocation: '',
        campaignName: '',
        enquiryDate: null,
        closingDate: null,
        consultantName: '',
        consultantId: '',
        residence: '',
        area: '',
        nationality: '',
        region: '',
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
                phone: student.phone || '',
                email: student.email || '',
                university: student.university || '',
                program: student.program || '',
                courseFee: student.courseFee || '',
                admissionFeePaid: student.admissionFeePaid || '',
                source: student.source || '',
                referredBy: student.referredBy || '',
                openDay: student.openDay || '',
                openDayLocation: student.openDayLocation || '',
                campaignName: student.campaignName || '',
                enquiryDate: student.enquiryDate ? new Date(student.enquiryDate) : null,
                closingDate: student.closingDate ? new Date(student.closingDate) : null,
                consultantName: student.consultantName || '',
                consultantId: student.consultant?._id || '',
                residence: student.residence || '',
                area: student.area || '',
                nationality: student.nationality || '',
                region: student.region || '',
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
                phone: '',
                email: '',
                university: '',
                program: '',
                courseFee: '',
                admissionFeePaid: '',
                source: '',
                referredBy: '',
                openDay: '',
                openDayLocation: '',
                campaignName: '',
                enquiryDate: null,
                closingDate: null,
                consultantName: '',
                consultantId: '',
                residence: '',
                area: '',
                nationality: '',
                region: '',
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

    // Fields that should be auto-capitalized
    const textFieldsToCapitalize = [
        'studentName',
        'nationality',
        'residence',
        'area',
        'referredBy',
        'openDay',
        'openDayLocation',
        'campaignName',
        'companyName',
        'designation',
        'industryType',
        'deptType',
    ];

    const handleChange = (field) => (event) => {
        let value = event.target.value;
        
        // Auto-capitalize text fields
        if (textFieldsToCapitalize.includes(field)) {
            value = value.toUpperCase();
        }
        
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
            'studentName', 'gender', 'phone', 'email', 'university', 'program', 'courseFee',
            'source', 'campaignName', 'enquiryDate', 'closingDate', 'consultantName',
            'residence', 'area', 'nationality', 'region', 'companyName', 'designation',
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
                admissionFeePaid: Number(formData.admissionFeePaid) || 0,
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
                            <Box sx={{ display: 'flex', gap: 1, flex: 1, minWidth: 200 }}>
                                <Autocomplete
                                    sx={{ width: 180 }}
                                    options={COUNTRY_CODES}
                                    getOptionLabel={(option) => option.label || ''}
                                    value={COUNTRY_CODES.find(c => formData.phone?.startsWith(c.code)) || COUNTRY_CODES[0]}
                                    onChange={(event, newValue) => {
                                        const currentNumber = formData.phone?.replace(/^\+\d+\s*/, '') || '';
                                        setFormData(prev => ({
                                            ...prev,
                                            phone: newValue ? `${newValue.code} ${currentNumber}` : currentNumber
                                        }));
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Code"
                                            required
                                            placeholder="Search..."
                                        />
                                    )}
                                    isOptionEqualToValue={(option, value) => option.code === value?.code}
                                    autoHighlight
                                    openOnFocus
                                    filterOptions={(options, { inputValue }) => {
                                        const filterValue = inputValue.toLowerCase();
                                        return options.filter(
                                            option =>
                                                option.code.includes(filterValue) ||
                                                option.country.toLowerCase().includes(filterValue)
                                        );
                                    }}
                                />
                                <TextField
                                    sx={{ flex: 1 }}
                                    label="Phone Number"
                                    value={formData.phone?.replace(/^\+\d+\s*/, '') || ''}
                                    onChange={(e) => {
                                        const countryCode = COUNTRY_CODES.find(c => formData.phone?.startsWith(c.code))?.code || '+971';
                                        setFormData(prev => ({
                                            ...prev,
                                            phone: `${countryCode} ${e.target.value}`
                                        }));
                                    }}
                                    required
                                    placeholder="50 123 4567"
                                />
                            </Box>
                            <TextField
                                sx={fieldStyle}
                                label="Email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange('email')}
                                required
                                placeholder="e.g., student@example.com"
                            />
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
                            <Autocomplete
                                sx={fieldStyle}
                                options={COUNTRIES}
                                value={formData.region || null}
                                onChange={(event, newValue) => {
                                    setFormData(prev => ({ ...prev, region: newValue || '' }));
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Region/Country"
                                        required
                                        placeholder="Search country..."
                                    />
                                )}
                                isOptionEqualToValue={(option, value) => option === value}
                                autoHighlight
                                openOnFocus
                            />
                        </Box>

                        <Box sx={rowStyle}>
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

                        <Box sx={rowStyle}>
                            <TextField
                                sx={fieldStyle}
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
                            <TextField
                                sx={fieldStyle}
                                label="Admission Fee Paid"
                                type="number"
                                value={formData.admissionFeePaid}
                                onChange={handleChange('admissionFeePaid')}
                                placeholder="Enter amount paid"
                                InputProps={{
                                    startAdornment: <InputAdornment position="start">AED</InputAdornment>,
                                }}
                            />
                        </Box>
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
                                label="Referred By"
                                value={formData.referredBy}
                                onChange={handleChange('referredBy')}
                                placeholder="Enter referrer name"
                            />
                        </Box>
                        <Box sx={rowStyle}>
                            <TextField
                                sx={fieldStyle}
                                label="Open Day"
                                value={formData.openDay}
                                onChange={handleChange('openDay')}
                                placeholder="e.g., Open Day Feb 2026"
                            />
                            <TextField
                                sx={fieldStyle}
                                label="Open Day Location"
                                value={formData.openDayLocation}
                                onChange={handleChange('openDayLocation')}
                                placeholder="e.g., Dubai Mall"
                            />
                        </Box>
                        <TextField
                            sx={fullWidthStyle}
                            label="Campaign Name"
                            value={formData.campaignName}
                            onChange={handleChange('campaignName')}
                            required
                            placeholder="Enter campaign name"
                        />
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
                                onChange={(e) => {
                                    const selectedName = e.target.value;
                                    const selectedConsultant = consultants.find(c => c.name === selectedName);
                                    const selectedTeamLead = teamLeads?.find(tl => tl.name === selectedName);

                                    if (selectedTeamLead) {
                                        // If a team lead is selected, auto-fill teamLeadId, consultant stays null
                                        setFormData(prev => ({
                                            ...prev,
                                            consultantName: selectedName,
                                            consultantId: '', // TL is not a consultant, so no consultantId
                                            teamLeadId: selectedTeamLead._id,
                                        }));
                                    } else if (selectedConsultant) {
                                        setFormData(prev => ({
                                            ...prev,
                                            consultantName: selectedName,
                                            consultantId: selectedConsultant._id,
                                        }));
                                    } else {
                                        setFormData(prev => ({
                                            ...prev,
                                            consultantName: selectedName,
                                            consultantId: '',
                                        }));
                                    }
                                }}
                                required
                                InputLabelProps={{ shrink: true }}
                                SelectProps={{ native: true }}
                            >
                                <option value="">Select Consultant</option>
                                {consultants.map(c => (
                                    <option key={c._id || c.name} value={c.name}>{c.name}</option>
                                ))}
                                {teamLeads?.length > 0 && (
                                    <option disabled>── Team Leads ──</option>
                                )}
                                {teamLeads?.map(tl => (
                                    <option key={`tl-${tl._id}`} value={tl.name}>{tl.name} (TL)</option>
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
