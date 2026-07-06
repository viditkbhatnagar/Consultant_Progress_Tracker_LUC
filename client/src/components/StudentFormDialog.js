import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Chip,
    TextField,
    Typography,
    Box,
    Alert,
    InputAdornment,
    CircularProgress,
    Divider,
    Autocomplete,
    FormControlLabel,
    Switch,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format as formatDate } from 'date-fns';
import commitmentService from '../services/commitmentService';
import { compareNames } from '../utils/nameSimilarity';
import { LUC_FEES_PAID_OPTIONS, MODE_OF_PAYMENT_OPTIONS } from '../utils/studentDesign';
import PhoneFieldWithCode from './PhoneFieldWithCode';

// Quick-pick tier chips shown below "Admission Fee Paid". Derived from the
// most-frequent round-hundred values actually in the LUC database (profiled
// 2026-04-23) — 2500 and 1500 account for >60% of entries, so they're
// first. The TL can still type any custom amount in the field itself.
const LUC_ADMISSION_FEE_TIERS = [2500, 1500, 4000, 2000, 1000, 3000];

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
    'Re-Registration',
];

// Gender options
const GENDERS = ['Male', 'Female'];

// COUNTRY_CODES list moved to ../utils/countryCodes.js (shared with Skillhub).

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
        feesPaid: '',
        modeOfPayment: '',
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
        // LUC commitment-link spine. Mandatory for new LUC students unless
        // admin opts into manualEntry with a reason.
        commitmentId: '',
        manualEntry: false,
        manualEntryReason: '',
    });

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [availablePrograms, setAvailablePrograms] = useState([]);
    // Linkable commitments for the picker. Loaded once on dialog open
    // (not on every keystroke). Empty list = no orphans pending — admin
    // gets the manualEntry switch instead.
    const [linkableCommits, setLinkableCommits] = useState([]);
    const [linkLoading, setLinkLoading] = useState(false);
    const [selectedCommit, setSelectedCommit] = useState(null);

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
                feesPaid: student.feesPaid || '',
                modeOfPayment: student.modeOfPayment || '',
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
                commitmentId: student.commitmentId || '',
                manualEntry: !!student.manualEntry,
                manualEntryReason: student.manualEntryReason || '',
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
                feesPaid: '',
                modeOfPayment: '',
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
                commitmentId: '',
                manualEntry: false,
                manualEntryReason: '',
            });
            setAvailablePrograms([]);
        }
        setSelectedCommit(null);
        setError('');
    }, [student, open, currentUserRole, currentUser]);

    // Load linkable LUC commitments when the dialog opens for a new
    // student (not edit). Limited to the caller's scope by the server.
    useEffect(() => {
        if (!open || student) return;
        let cancelled = false;
        (async () => {
            try {
                setLinkLoading(true);
                const res = await commitmentService.getLinkableCommitments({ limit: 200 });
                if (!cancelled) setLinkableCommits(res?.data || []);
            } catch (err) {
                // Picker is optional UX — failures don't block the form.
                // Admin still has the Manual Entry switch.
                if (!cancelled) setLinkableCommits([]);
            } finally {
                if (!cancelled) setLinkLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open, student]);

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

        // Switching TL invalidates the previously-picked consultant if they
        // belong to the old team. Clearing avoids saving a row with a
        // consultant who isn't actually on the new TL's team.
        if (field === 'teamLeadId' && value) {
            const stillValid =
                !formData.consultantName ||
                (() => {
                    const tl = teamLeads?.find((t) => t._id === value);
                    if (tl && tl.name === formData.consultantName) return true;
                    const c = consultants.find((c) => c.name === formData.consultantName);
                    if (!c) return false;
                    const t = c.teamLead?._id || c.teamLead;
                    return t && String(t) === String(value);
                })();
            if (!stillValid) {
                setFormData(prev => ({
                    ...prev,
                    teamLeadId: value,
                    consultantName: '',
                    consultantId: '',
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
            'source', 'enquiryDate', 'closingDate', 'consultantName',
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

        // LUC commitment-link gate. Only enforced on NEW student creation
        // (editing existing rows is handled by the reconciliation page).
        if (!student) {
            if (formData.manualEntry) {
                if (!formData.manualEntryReason || !formData.manualEntryReason.trim()) {
                    return 'Manual entry requires a reason';
                }
            } else if (!formData.commitmentId) {
                return 'Pick a linked commitment for this admission (or admin can opt into Manual Entry)';
            }
        }

        // Date sanity — today as an end-of-day boundary so picking "today"
        // is still allowed but anything dated tomorrow+ is rejected.
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        if (formData.enquiryDate && new Date(formData.enquiryDate) > todayEnd) {
            return 'Enquiry date cannot be in the future.';
        }
        if (formData.closingDate && new Date(formData.closingDate) > todayEnd) {
            return 'Closing date cannot be in the future.';
        }
        if (
            formData.enquiryDate &&
            formData.closingDate &&
            new Date(formData.closingDate) < new Date(formData.enquiryDate)
        ) {
            return 'Closing date cannot be earlier than the enquiry date.';
        }

        // Fee sanity — admission fee paid should never exceed the course fee.
        // Catches the decimal-typo / extra-zero class of data-entry errors.
        const course = Number(formData.courseFee) || 0;
        const paid = Number(formData.admissionFeePaid) || 0;
        if (paid > course && course > 0) {
            return `Admission fee paid (AED ${paid.toLocaleString()}) cannot exceed course fee (AED ${course.toLocaleString()}).`;
        }

        return null;
    };

    // The MUI DatePicker hands us Date objects in the user's local timezone.
    // JSON.stringify -> toISOString() shifts those to UTC, so a user picking
    // "1 May 2026" in UAE (UTC+4) ends up persisted as 2026-04-30T20:00:00Z.
    // The server's pre-validate hook then computes month via getMonth() and
    // labels the row "April" — and any closingDate filter `>= 2026-05-01Z`
    // wrongly excludes the row. We normalize to UTC midnight of the user's
    // intended day so the stored instant matches what they see in the picker
    // regardless of timezone.
    const toUtcMidnight = (d) => {
        if (!d) return d;
        const date = d instanceof Date ? d : new Date(d);
        if (Number.isNaN(date.getTime())) return d;
        return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
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
                enquiryDate: toUtcMidnight(formData.enquiryDate),
                closingDate: toUtcMidnight(formData.closingDate),
                dateOfEnrollment: toUtcMidnight(formData.dateOfEnrollment),
                courseFee: Number(formData.courseFee),
                admissionFeePaid: Number(formData.admissionFeePaid) || 0,
                feesPaid: formData.feesPaid || undefined,
                modeOfPayment: formData.modeOfPayment || undefined,
                experience: Number(formData.experience),
                // Strip empty commitmentId so the server doesn't try to
                // ObjectId-cast an empty string. Pass manualEntry only when
                // the admin explicitly opted in.
                commitmentId: formData.commitmentId || undefined,
                manualEntry: formData.manualEntry === true,
                manualEntryReason: formData.manualEntry ? formData.manualEntryReason : '',
            });
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save student');
        } finally {
            setLoading(false);
        }
    };

    // Pick a commitment from the picker → auto-populate name + consultant +
    // team lead so the rest of the form just needs program/fees/etc.
    const handleCommitmentPick = (commit) => {
        setSelectedCommit(commit);
        if (!commit) {
            setFormData((prev) => ({ ...prev, commitmentId: '' }));
            return;
        }
        setFormData((prev) => ({
            ...prev,
            commitmentId: commit._id,
            // Don't overwrite if user has already typed the name; otherwise
            // pre-fill so the legal-name vs nickname mismatch surfaces here
            // and the admin can correct on the spot.
            studentName: prev.studentName || (commit.studentName || '').toUpperCase(),
            consultantName: commit.consultantName || prev.consultantName,
        }));
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
                    backgroundColor: 'var(--t-surface)',
                    color: 'var(--t-text)',
                    border: '1px solid var(--t-border)',
                }
            }}
        >
            <DialogTitle sx={{
                backgroundColor: '#1976d2',
                color: '#fff',
                pb: 2
            }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {student ? 'Edit Student' : 'Add New Student'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Fill in all the required fields to {student ? 'update' : 'add'} a student record
                </Typography>
            </DialogTitle>
            
            <DialogContent
                sx={{
                    p: 4,
                    backgroundColor: 'var(--t-surface-muted)',
                    color: 'var(--t-text)',
                    overflowY: 'auto',
                    // Scope input styling so dark mode is legible. MUI's own
                    // Typography palette applies, but we retune the field
                    // chrome: input text, labels, borders, and the background
                    // of the text field itself.
                    '& .MuiInputBase-input': { color: 'var(--t-text)' },
                    '& .MuiInputLabel-root': { color: 'var(--t-text-muted)' },
                    '& .MuiOutlinedInput-root': { backgroundColor: 'var(--t-surface)' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--t-border)' },
                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'var(--t-text-muted)',
                    },
                    '& .MuiTypography-root': { color: 'var(--t-text)' },
                    '& .MuiDivider-root': { borderColor: 'var(--t-border)' },
                }}
            >
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 3, mt: 1 }}>
                            {error}
                        </Alert>
                    )}

                    {/* Linked Commitment — LUC drift-prevention spine.
                        Only shown on new-student creation; editing keeps
                        the existing link untouched (use the reconciliation
                        page to retroactively pair). */}
                    {!student && (
                        <Box sx={{ mb: 3, mt: 1 }}>
                            <Typography variant="overline" sx={{ display: 'block', color: 'var(--t-accent)', fontWeight: 600, mb: 1 }}>
                                Linked Commitment
                            </Typography>
                            <Autocomplete
                                size="small"
                                fullWidth
                                options={linkableCommits}
                                loading={linkLoading}
                                value={selectedCommit}
                                onChange={(_e, v) => handleCommitmentPick(v)}
                                disabled={formData.manualEntry}
                                getOptionLabel={(o) =>
                                    o ? `${o.studentName || '(no name)'} — ${o.consultantName}` : ''
                                }
                                isOptionEqualToValue={(a, b) => a?._id === b?._id}
                                renderOption={(props, opt) => (
                                    <li {...props} key={opt._id}>
                                        <Box>
                                            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                                                {opt.studentName || '(no name)'}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                                                {opt.consultantName} · {opt.teamName} ·{' '}
                                                {opt.commitmentDate
                                                    ? formatDate(new Date(opt.commitmentDate), 'd MMM yyyy')
                                                    : ''}
                                            </Typography>
                                        </Box>
                                    </li>
                                )}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder={
                                            formData.manualEntry
                                                ? 'Manual entry — no commitment linked'
                                                : 'Pick the commitment this admission belongs to…'
                                        }
                                        helperText={
                                            !formData.manualEntry &&
                                            linkableCommits.length === 0 &&
                                            !linkLoading
                                                ? 'No unlinked commitments in your scope. Log one first or enable Manual Entry.'
                                                : ' '
                                        }
                                    />
                                )}
                            />
                            {(() => {
                                if (formData.manualEntry || !selectedCommit || !formData.studentName) return null;
                                const { score, warn } = compareNames(formData.studentName, selectedCommit.studentName);
                                if (!warn) return null;
                                return (
                                    <Alert severity="warning" sx={{ mt: 1, py: 0.25, fontSize: 12 }}>
                                        Student name on the form ("{formData.studentName.trim()}") doesn't closely match the linked commitment ("{selectedCommit.studentName || '(no name)'}"). Similarity {Math.round(score * 100)}%. Double-check this is the right commitment.
                                    </Alert>
                                );
                            })()}
                            <Box sx={{ mt: 1.5 }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            size="small"
                                            checked={formData.manualEntry}
                                            onChange={(e) => {
                                                const next = e.target.checked;
                                                setFormData((p) => ({
                                                    ...p,
                                                    manualEntry: next,
                                                    commitmentId: next ? '' : p.commitmentId,
                                                }));
                                                if (next) setSelectedCommit(null);
                                            }}
                                        />
                                    }
                                    label={
                                        <Typography sx={{ fontSize: 13 }}>
                                            Manual entry (no commitment exists for this student)
                                        </Typography>
                                    }
                                />
                                {formData.manualEntry && (
                                    <TextField
                                        fullWidth
                                        size="small"
                                        sx={{ mt: 1 }}
                                        label="Reason (required)"
                                        value={formData.manualEntryReason}
                                        onChange={handleChange('manualEntryReason')}
                                        placeholder="e.g. Legacy import / pre-tracker record"
                                    />
                                )}
                            </Box>
                        </Box>
                    )}

                    {/* Section 1: Basic Information */}
                    <Box sx={{ mb: 4, mt: 2 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'var(--t-accent)', fontWeight: 600 }}>
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
                            <Box sx={{ display: 'flex', flex: 1, minWidth: 200 }}>
                                <PhoneFieldWithCode
                                    value={formData.phone}
                                    onChange={(next) => setFormData(prev => ({ ...prev, phone: next }))}
                                    required
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
                        <Typography variant="h6" sx={{ mb: 2, color: 'var(--t-accent)', fontWeight: 600 }}>
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
                                inputProps={{ min: 0 }}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start">AED</InputAdornment>,
                                }}
                            />
                            <Box sx={fieldStyle}>
                                <TextField
                                    fullWidth
                                    label="Admission Fee Paid"
                                    type="number"
                                    value={formData.admissionFeePaid}
                                    onChange={handleChange('admissionFeePaid')}
                                    placeholder="Enter amount paid"
                                    inputProps={{ min: 0, max: Number(formData.courseFee) || undefined }}
                                    error={
                                        Number(formData.admissionFeePaid) > Number(formData.courseFee) &&
                                        Number(formData.courseFee) > 0
                                    }
                                    helperText={
                                        Number(formData.admissionFeePaid) > Number(formData.courseFee) &&
                                        Number(formData.courseFee) > 0
                                            ? 'Cannot exceed the course fee.'
                                            : ' '
                                    }
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start">AED</InputAdornment>,
                                    }}
                                />
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 0.75,
                                        mt: -0.5,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: 'text.secondary',
                                            fontSize: 11,
                                            letterSpacing: '0.02em',
                                            mr: 0.5,
                                        }}
                                    >
                                        Common:
                                    </Typography>
                                    {LUC_ADMISSION_FEE_TIERS.map((v) => {
                                        const selected =
                                            Number(formData.admissionFeePaid) === v;
                                        return (
                                            <Chip
                                                key={v}
                                                size="small"
                                                label={`AED ${v.toLocaleString()}`}
                                                clickable
                                                variant={selected ? 'filled' : 'outlined'}
                                                color={selected ? 'primary' : 'default'}
                                                onClick={() =>
                                                    handleChange('admissionFeePaid')({
                                                        target: { value: String(v) },
                                                    })
                                                }
                                                sx={{
                                                    height: 24,
                                                    fontSize: 11.5,
                                                    fontWeight: selected ? 600 : 500,
                                                }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Box>
                        </Box>
                        <Box sx={rowStyle}>
                            <TextField
                                sx={fieldStyle}
                                select
                                label="Fees Paid"
                                value={formData.feesPaid}
                                onChange={handleChange('feesPaid')}
                                InputLabelProps={{ shrink: true }}
                                SelectProps={{ native: true }}
                            >
                                <option value="">Select Fees Paid</option>
                                {LUC_FEES_PAID_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </TextField>
                            <TextField
                                sx={fieldStyle}
                                select
                                label="Mode of Payment"
                                value={formData.modeOfPayment}
                                onChange={handleChange('modeOfPayment')}
                                InputLabelProps={{ shrink: true }}
                                SelectProps={{ native: true }}
                            >
                                <option value="">Select Mode of Payment</option>
                                {MODE_OF_PAYMENT_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </TextField>
                        </Box>
                    </Box>

                    {/* Section 3: Lead Source & Campaign */}
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'var(--t-accent)', fontWeight: 600 }}>
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
                            placeholder="Enter campaign name"
                        />
                    </Box>

                    {/* Section 4: Dates & Conversion */}
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'var(--t-accent)', fontWeight: 600 }}>
                            Dates & Conversion
                        </Typography>
                        <Divider sx={{ mb: 3 }} />
                        
                        <Box sx={rowStyle}>
                            <Box sx={fieldStyle}>
                                <DatePicker
                                    label="Enquiry Date"
                                    value={formData.enquiryDate}
                                    onChange={handleDateChange('enquiryDate')}
                                    format="dd/MM/yyyy"
                                    maxDate={new Date()}
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
                                    format="dd/MM/yyyy"
                                    maxDate={new Date()}
                                    minDate={formData.enquiryDate || undefined}
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
                        <Typography variant="h6" sx={{ mb: 2, color: 'var(--t-accent)', fontWeight: 600 }}>
                            Team Assignment
                        </Typography>
                        <Divider sx={{ mb: 3 }} />
                        
                        <Box sx={rowStyle}>
                            {(() => {
                                // Scope the consultant picker to the selected TL's team.
                                // Admin sees a global consultant list; without scoping the
                                // dropdown surfaces every consultant in the org which made
                                // it easy to pick someone from a different team. Team Leads
                                // already arrive here scoped to their own team via the
                                // server, so the filter is a no-op for them.
                                const tlId = formData.teamLeadId;
                                const teamConsultants = tlId
                                    ? consultants.filter((c) => {
                                        const t = c.teamLead?._id || c.teamLead;
                                        return t && String(t) === String(tlId);
                                    })
                                    : consultants;
                                // Surface the selected TL in the same dropdown — TLs sometimes
                                // close their own admissions and need to appear as the
                                // "consultant" on the row. Mirrors the Meeting form pattern.
                                const selectedTl = tlId
                                    ? (teamLeads || []).find((t) => t._id === tlId)
                                    : null;

                                return (
                                    <TextField
                                        sx={fieldStyle}
                                        select
                                        label="Consultant"
                                        value={formData.consultantName}
                                        onChange={(e) => {
                                            const selectedName = e.target.value;
                                            const selectedConsultant = teamConsultants.find(c => c.name === selectedName);
                                            const tlMatch = selectedTl && selectedTl.name === selectedName;

                                            if (tlMatch) {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    consultantName: selectedName,
                                                    consultantId: '',
                                                    teamLeadId: selectedTl._id,
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
                                        helperText={
                                            currentUserRole === 'admin' && !tlId
                                                ? 'Pick a team lead first'
                                                : ' '
                                        }
                                        disabled={currentUserRole === 'admin' && !tlId}
                                    >
                                        <option value="">Select Consultant</option>
                                        {selectedTl && (
                                            <option key={`tl-${selectedTl._id}`} value={selectedTl.name}>
                                                {selectedTl.name} (Team Lead)
                                            </option>
                                        )}
                                        {teamConsultants.map(c => (
                                            <option key={c._id || c.name} value={c.name}>{c.name}</option>
                                        ))}
                                    </TextField>
                                );
                            })()}

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
                                    helperText={
                                        (() => {
                                            const current = teamLeads?.find(
                                                (t) => t._id === formData.teamLeadId
                                            );
                                            return current && current.isActive === false
                                                ? 'Current team lead is inactive — pick an active one or leave as-is.'
                                                : ' ';
                                        })()
                                    }
                                >
                                    <option value="">Select Team Lead</option>
                                    {[...(teamLeads || [])]
                                        // Sort active first, then by name, so the list
                                        // defaults to active team leads at the top.
                                        .sort((a, b) => {
                                            const aActive = a.isActive !== false ? 0 : 1;
                                            const bActive = b.isActive !== false ? 0 : 1;
                                            if (aActive !== bActive) return aActive - bActive;
                                            return (a.name || '').localeCompare(b.name || '');
                                        })
                                        .map((tl) => (
                                            <option key={tl._id} value={tl._id}>
                                                {tl.name} ({tl.teamName})
                                                {tl.isActive === false ? ' — inactive' : ''}
                                            </option>
                                        ))}
                                </TextField>
                            )}
                        </Box>
                    </Box>

                    {/* Section 6: Professional Information */}
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'var(--t-accent)', fontWeight: 600 }}>
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
                backgroundColor: 'var(--t-surface-elev)',
                borderTop: '1px solid var(--t-border)'
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
