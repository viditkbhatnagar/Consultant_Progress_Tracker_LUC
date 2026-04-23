import React from 'react';
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    Chip,
    Button,
    Tooltip,
} from '@mui/material';
import {
    Close as CloseIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import {
    UNIVERSITY_PALETTE,
    SOURCE_PALETTE,
    shortUniversity,
    conversionColor,
} from '../../utils/studentDesign';

const Section = ({ title, children }) => (
    <Box sx={{ mb: 2.5 }}>
        <Typography
            sx={{
                fontSize: 10.5,
                fontWeight: 700,
                color: 'var(--t-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                mb: 0.75,
            }}
        >
            {title}
        </Typography>
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px 16px',
            }}
        >
            {children}
        </Box>
    </Box>
);

const Field = ({ label, value, mono = false, full = false }) => (
    <Box sx={{ gridColumn: full ? '1 / -1' : undefined }}>
        <Typography
            sx={{
                fontSize: 10.5,
                color: 'var(--t-text-muted)',
                fontWeight: 600,
                mb: 0.25,
                textTransform: 'uppercase',
                letterSpacing: '.04em',
            }}
        >
            {label}
        </Typography>
        <Typography
            sx={{
                fontSize: 13,
                color: 'var(--t-text-2)',
                fontWeight: 500,
                fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit',
                wordBreak: 'break-word',
            }}
        >
            {value || '—'}
        </Typography>
    </Box>
);

const LucStudentDetailDrawer = ({
    open,
    onClose,
    student,
    onEdit,
    onDelete,
    canEdit = true,
    canDelete = true,
}) => {
    if (!student) {
        return (
            <Drawer
                anchor="right"
                open={open}
                onClose={onClose}
                PaperProps={{
                    sx: {
                        width: 480,
                        maxWidth: '100vw',
                        backgroundColor: 'var(--t-surface)',
                        color: 'var(--t-text)',
                        borderLeft: '1px solid var(--t-border)',
                    },
                }}
            />
        );
    }

    const uniColor = UNIVERSITY_PALETTE[student.university] || '#64748B';
    const srcColor = SOURCE_PALETTE[student.source] || 'var(--t-text-3)';
    const convColor = conversionColor(student.conversionTime);

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: 480,
                    maxWidth: '100vw',
                    backgroundColor: 'var(--t-surface)',
                    color: 'var(--t-text)',
                    borderLeft: '1px solid var(--t-border)',
                },
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2.5,
                    py: 1.75,
                    borderBottom: '1px solid var(--t-border)',
                    flexShrink: 0,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box
                        sx={{
                            width: 36,
                            height: 36,
                            borderRadius: '10px',
                            backgroundColor: `${uniColor}20`,
                            color: uniColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 15,
                        }}
                    >
                        {(student.studentName || '?').slice(0, 1).toUpperCase()}
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--t-text)' }}>
                            {student.studentName}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
                            #{student.sno} · {student.month}
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {canEdit && (
                        <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => onEdit?.(student)} sx={{ color: 'var(--t-accent-text)' }}>
                                <EditIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {canDelete && (
                        <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => onDelete?.(student)} sx={{ color: 'var(--t-danger-text)' }}>
                                <DeleteIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                    )}
                    <IconButton size="small" onClick={onClose} sx={{ color: 'var(--t-text-3)' }}>
                        <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
                {/* Chips + quick actions */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                    {student.university && (
                        <Tooltip title={student.university}>
                            <Chip
                                label={shortUniversity(student.university)}
                                size="small"
                                sx={{
                                    fontSize: 11,
                                    backgroundColor: `${uniColor}20`,
                                    color: uniColor,
                                    fontWeight: 600,
                                }}
                            />
                        </Tooltip>
                    )}
                    {student.source && (
                        <Chip
                            label={student.source}
                            size="small"
                            sx={{
                                fontSize: 11,
                                backgroundColor: `${srcColor}20`,
                                color: srcColor,
                                fontWeight: 600,
                            }}
                        />
                    )}
                    {student.conversionTime != null && (
                        <Chip
                            label={`${student.conversionTime} day conv.`}
                            size="small"
                            sx={{
                                fontSize: 11,
                                backgroundColor: `${convColor}20`,
                                color: convColor,
                                fontWeight: 600,
                            }}
                        />
                    )}
                    {student.gender && (
                        <Chip
                            label={student.gender}
                            size="small"
                            variant="outlined"
                            sx={{
                                fontSize: 11,
                                color: student.gender === 'Male' ? '#2563EB' : '#BE185D',
                                borderColor: student.gender === 'Male' ? '#2563EB' : '#BE185D',
                            }}
                        />
                    )}
                </Box>

                {(student.phone || student.email) && (
                    <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
                        {student.phone && (
                            <Button
                                size="small"
                                variant="outlined"
                                href={`tel:${student.phone}`}
                                startIcon={<PhoneIcon sx={{ fontSize: 14 }} />}
                                sx={{
                                    textTransform: 'none',
                                    fontSize: 12,
                                    color: 'var(--t-text-3)',
                                    borderColor: 'var(--t-border)',
                                }}
                            >
                                {student.phone}
                            </Button>
                        )}
                        {student.email && (
                            <Button
                                size="small"
                                variant="outlined"
                                href={`mailto:${student.email}`}
                                startIcon={<EmailIcon sx={{ fontSize: 14 }} />}
                                sx={{
                                    textTransform: 'none',
                                    fontSize: 12,
                                    color: 'var(--t-text-3)',
                                    borderColor: 'var(--t-border)',
                                    maxWidth: 220,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {student.email}
                            </Button>
                        )}
                    </Box>
                )}

                <Section title="Enrollment">
                    <Field label="Program" value={student.program} full />
                    <Field label="University" value={student.university} full />
                    <Field
                        label="Course Fee"
                        value={<span style={{ color: '#16A34A', fontWeight: 700 }}>AED {(student.courseFee || 0).toLocaleString()}</span>}
                    />
                    <Field
                        label="Admission Fee"
                        value={<span style={{ color: '#2563EB', fontWeight: 700 }}>AED {(student.admissionFeePaid || 0).toLocaleString()}</span>}
                    />
                    <Field label="Campaign" value={student.campaignName} full />
                </Section>

                <Section title="Timeline">
                    <Field label="Enquiry Date" value={student.enquiryDate ? format(new Date(student.enquiryDate), 'dd/MM/yyyy') : ''} />
                    <Field label="Closing Date" value={student.closingDate ? format(new Date(student.closingDate), 'dd/MM/yyyy') : ''} />
                    <Field label="Conversion" value={student.conversionTime != null ? `${student.conversionTime} days` : ''} />
                    <Field label="Open Day" value={student.openDay} />
                    <Field label="Open Day Location" value={student.openDayLocation} full />
                    <Field label="Referred By" value={student.referredBy} full />
                </Section>

                <Section title="Ownership">
                    <Field label="Consultant" value={student.consultantName} />
                    <Field label="Team Lead" value={student.teamLeadName} />
                    <Field label="Team" value={student.teamName} full />
                </Section>

                <Section title="Demographics">
                    <Field label="Nationality" value={student.nationality} />
                    <Field label="Region" value={student.region} />
                    <Field label="Residence" value={student.residence} />
                    <Field label="Area" value={student.area} />
                </Section>

                <Section title="Employment">
                    <Field label="Company" value={student.companyName} full />
                    <Field label="Designation" value={student.designation} />
                    <Field label="Experience" value={student.experience != null ? `${student.experience} yrs` : ''} />
                    <Field label="Industry" value={student.industryType} />
                    <Field label="Dept" value={student.deptType} />
                </Section>
            </Box>
        </Drawer>
    );
};

export default LucStudentDetailDrawer;
