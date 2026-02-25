// Lead stage options with colors
export const LEAD_STAGES = [
    { value: 'Dead', label: 'Dead', color: '#757575' },
    { value: 'Cold', label: 'Cold', color: '#2196F3' },
    { value: 'Warm', label: 'Warm', color: '#FF9800' },
    { value: 'Hot', label: 'Hot', color: '#F44336' },
    { value: 'Offer Sent', label: 'Offer Sent', color: '#9C27B0' },
    { value: 'Awaiting Confirmation', label: 'Awaiting Confirmation', color: '#3F51B5' },
    { value: 'Meeting Scheduled', label: 'Meeting Scheduled', color: '#00BCD4' },
    { value: 'Admission', label: 'Admission', color: '#4CAF50' },
    { value: 'CIF', label: 'CIF', color: '#8BC34A' },
    { value: 'Unresponsive', label: 'Unresponsive', color: '#607D8B' },
];

// Commitment status options
export const COMMITMENT_STATUS = [
    { value: 'pending', label: 'Pending', color: '#FFC107' },
    { value: 'in_progress', label: 'In Progress', color: '#2196F3' },
    { value: 'achieved', label: 'Achieved', color: '#4CAF50' },
    { value: 'missed', label: 'Missed', color: '#F44336' },
];

// User roles
export const USER_ROLES = {
    ADMIN: 'admin',
    TEAM_LEAD: 'team_lead',
    CONSULTANT: 'consultant',
};

// Days of week
export const DAYS_OF_WEEK = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
];

// API Configuration
// In production (Render), use relative path since backend serves frontend
// In development, use localhost with port 5001
export const API_BASE_URL = process.env.NODE_ENV === 'production'
    ? '/api'  // Relative path - same server serves both API and frontend
    : 'http://localhost:5001/api';  // Development - separate servers

// Achievement percentage color coding
export const getAchievementColor = (percentage) => {
    if (percentage >= 80) return '#4CAF50'; // Green
    if (percentage >= 50) return '#FF9800'; // Orange
    return '#F44336'; // Red
};

// Arrays for filters
export const LEAD_STAGES_LIST = LEAD_STAGES.map(stage => stage.value);
export const STATUS_LIST = ['pending', 'in_progress', 'achieved', 'missed'];

// Get lead stage color
export const getLeadStageColor = (stage) => {
    const leadStage = LEAD_STAGES.find((s) => s.value === stage);
    return leadStage ? leadStage.color : '#757575';
};
