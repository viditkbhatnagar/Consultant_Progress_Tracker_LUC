import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/ai`;

const generateAnalysis = async (startDate, endDate) => {
    const response = await axios.post(`${API_URL}/analysis`, {
        startDate,
        endDate,
    });
    return response.data;
};

// Admin-only — list of teams + consultants with activity in the window.
const getAnalysisTargets = async (startDate, endDate) => {
    const response = await axios.get(`${API_URL}/analysis-targets`, {
        params: { startDate, endDate },
    });
    return response.data;
};

// Admin-only — run analysis scoped to one team (by teamLeadId).
const generateTeamAnalysis = async ({ startDate, endDate, teamLeadId }) => {
    const response = await axios.post(`${API_URL}/team-analysis`, {
        startDate,
        endDate,
        teamLeadId,
    });
    return response.data;
};

// Admin-only — run analysis scoped to one consultant (name + org).
const generateConsultantAnalysis = async ({
    startDate,
    endDate,
    consultantName,
    organization,
}) => {
    const response = await axios.post(`${API_URL}/consultant-analysis`, {
        startDate,
        endDate,
        consultantName,
        organization,
    });
    return response.data;
};

const getUsageStats = async () => {
    const response = await axios.get(`${API_URL}/usage`);
    return response.data;
};

const aiService = {
    generateAnalysis,
    getAnalysisTargets,
    generateTeamAnalysis,
    generateConsultantAnalysis,
    getUsageStats,
};

export default aiService;
