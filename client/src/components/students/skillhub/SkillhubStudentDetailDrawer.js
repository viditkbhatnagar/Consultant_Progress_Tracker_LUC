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
    SwapHoriz as SwapIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
} from '@mui/icons-material';
import { SKILLHUB_STATUS_META } from '../../../utils/studentDesign';

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

const SkillhubStudentDetailDrawer = ({
    open,
    onClose,
    student,
    onEdit,
    onDelete,
    onMove,
    canEdit = true,
    canDelete = true,
    canMove = true,
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

    const status = SKILLHUB_STATUS_META[student.studentStatus] || {
        lbl: student.studentStatus || '—',
        color: 'var(--t-text-3)',
        bg: 'var(--t-surface-muted)',
    };

    const totalEmiPaid = Array.isArray(student.emis)
        ? student.emis.reduce((sum, e) => sum + (e.paidAmount || 0), 0)
        : 0;
    const phones = student.phones || {};
    const emails = student.emails || {};

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
                            backgroundColor: status.bg,
                            color: status.color,
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
                        <Typography
                            sx={{
                                fontSize: 11,
                                color: 'var(--t-text-muted)',
                                fontFamily: '"JetBrains Mono", monospace',
                            }}
                        >
                            {student.enrollmentNumber || '—'}
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {canMove && (
                        <Tooltip title="Move to…">
                            <IconButton
                                size="small"
                                onClick={(e) => onMove?.(e, student)}
                                sx={{ color: 'var(--t-accent-text)' }}
                            >
                                <SwapIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {canEdit && (
                        <Tooltip title="Edit">
                            <IconButton
                                size="small"
                                onClick={() => onEdit?.(student)}
                                sx={{ color: 'var(--t-accent-text)' }}
                            >
                                <EditIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {canDelete && (
                        <Tooltip title="Delete">
                            <IconButton
                                size="small"
                                onClick={() => onDelete?.(student)}
                                sx={{ color: 'var(--t-danger-text)' }}
                            >
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
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                    <Chip
                        label={status.lbl}
                        size="small"
                        sx={{
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: status.bg,
                            color: status.color,
                        }}
                    />
                    {student.curriculum && (
                        <Chip
                            label={student.curriculum}
                            size="small"
                            variant="outlined"
                            sx={{
                                fontSize: 11,
                                color: 'var(--t-text-3)',
                                borderColor: 'var(--t-border)',
                            }}
                        />
                    )}
                    {student.yearOrGrade && (
                        <Chip
                            label={student.yearOrGrade}
                            size="small"
                            variant="outlined"
                            sx={{
                                fontSize: 11,
                                color: 'var(--t-text-3)',
                                borderColor: 'var(--t-border)',
                            }}
                        />
                    )}
                    {student.mode && (
                        <Chip
                            label={student.mode}
                            size="small"
                            variant="outlined"
                            sx={{
                                fontSize: 11,
                                color: 'var(--t-text-3)',
                                borderColor: 'var(--t-border)',
                            }}
                        />
                    )}
                </Box>

                {(phones.student || emails.student) && (
                    <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
                        {phones.student && (
                            <Button
                                size="small"
                                variant="outlined"
                                href={`tel:${phones.student}`}
                                startIcon={<PhoneIcon sx={{ fontSize: 14 }} />}
                                sx={{
                                    textTransform: 'none',
                                    fontSize: 12,
                                    color: 'var(--t-text-3)',
                                    borderColor: 'var(--t-border)',
                                }}
                            >
                                {phones.student}
                            </Button>
                        )}
                        {emails.student && (
                            <Button
                                size="small"
                                variant="outlined"
                                href={`mailto:${emails.student}`}
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
                                {emails.student}
                            </Button>
                        )}
                    </Box>
                )}

                <Section title="Academics">
                    <Field label="Enrollment #" value={student.enrollmentNumber} mono />
                    <Field label="Academic Year" value={student.academicYear} />
                    <Field label="Curriculum" value={student.curriculum} />
                    <Field label="Year / Grade" value={student.yearOrGrade} />
                    <Field label="Mode" value={student.mode} />
                    <Field label="Duration" value={student.courseDuration} />
                    <Field label="School" value={student.school} full />
                </Section>

                <Section title="Fees">
                    <Field
                        label="Course Fee"
                        value={
                            <span style={{ color: '#16A34A', fontWeight: 700 }}>
                                AED {(student.courseFee || 0).toLocaleString()}
                            </span>
                        }
                    />
                    <Field
                        label="Outstanding"
                        value={
                            <span
                                style={{
                                    color:
                                        (student.outstandingAmount ?? 0) > 0
                                            ? '#BE185D'
                                            : 'var(--t-text-faint)',
                                    fontWeight: 700,
                                }}
                            >
                                AED {(student.outstandingAmount ?? 0).toLocaleString()}
                            </span>
                        }
                    />
                    <Field
                        label="Admission Fee Paid"
                        value={`AED ${(student.admissionFeePaid || 0).toLocaleString()}`}
                    />
                    <Field
                        label="Registration Fee"
                        value={`AED ${(student.registrationFee || 0).toLocaleString()}`}
                    />
                    <Field label="EMIs Paid" value={`AED ${totalEmiPaid.toLocaleString()}`} />
                    <Field
                        label="EMIs"
                        value={Array.isArray(student.emis) ? student.emis.length : 0}
                    />
                </Section>

                <Section title="Contact">
                    <Field label="Student Phone" value={phones.student} />
                    <Field label="Student Email" value={emails.student} />
                    <Field label="Parent Phone" value={phones.parent} />
                    <Field label="Parent Email" value={emails.parent} />
                    <Field label="Address Emirate" value={student.addressEmirate} full />
                </Section>

                <Section title="Ownership">
                    <Field label="Counselor" value={student.consultantName} />
                    <Field label="Lead Source" value={student.leadSource} />
                    <Field label="Team" value={student.teamName} full />
                </Section>
            </Box>
        </Drawer>
    );
};

export default SkillhubStudentDetailDrawer;
