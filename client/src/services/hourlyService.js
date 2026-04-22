import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { getAdminOrgScope } from '../utils/adminOrgScope';

const API_URL = `${API_BASE_URL}/hourly`;

// When the logged-in user is an admin, every read must be scoped to the
// currently selected LUC/Skillhub tab. This helper returns that scope as a
// params object to spread into axios requests; empty object for non-admins.
const adminOrgParam = () => {
    try {
        const userStr = localStorage.getItem('user');
        if (!userStr) return {};
        const user = JSON.parse(userStr);
        if (!user || user.role !== 'admin') return {};
        return { organization: getAdminOrgScope() };
    } catch {
        return {};
    }
};

const getConsultants = async (scope) => {
    const params = { ...adminOrgParam() };
    if (scope) params.scope = scope;
    const response = await axios.get(`${API_URL}/consultants`, { params });
    return response.data;
};

const getDayActivities = async (date) => {
    const response = await axios.get(`${API_URL}/day`, {
        params: { date, ...adminOrgParam() },
    });
    return response.data;
};

const upsertSlot = async (data) => {
    const response = await axios.put(`${API_URL}/slot`, data);
    return response.data;
};

const clearSlot = async (data) => {
    const response = await axios.delete(`${API_URL}/slot`, { data });
    return response.data;
};

const clearDay = async (date) => {
    const response = await axios.delete(`${API_URL}/day`, {
        params: { date, ...adminOrgParam() },
    });
    return response.data;
};

const getMonthActivities = async (year, month) => {
    const response = await axios.get(`${API_URL}/month`, {
        params: { year, month, ...adminOrgParam() },
    });
    return response.data;
};

const getDayAdmissions = async (date) => {
    const response = await axios.get(`${API_URL}/admissions`, {
        params: { date, ...adminOrgParam() },
    });
    return response.data;
};

const upsertAdmission = async (data) => {
    const response = await axios.put(`${API_URL}/admissions`, data);
    return response.data;
};

const getMonthAdmissions = async (year, month) => {
    const response = await axios.get(`${API_URL}/admissions/month`, {
        params: { year, month, ...adminOrgParam() },
    });
    return response.data;
};

const getDayReferences = async (date) => {
    const response = await axios.get(`${API_URL}/references`, {
        params: { date, ...adminOrgParam() },
    });
    return response.data;
};

const upsertReference = async (data) => {
    const response = await axios.put(`${API_URL}/references`, data);
    return response.data;
};

const getMonthReferences = async (year, month) => {
    const response = await axios.get(`${API_URL}/references/month`, {
        params: { year, month, ...adminOrgParam() },
    });
    return response.data;
};

const getAIAnalysis = async (date) => {
    const response = await axios.get(`${API_URL}/ai-analysis`, {
        params: { date, ...adminOrgParam() },
    });
    return response.data;
};

const getTeamLeads = async () => {
    const response = await axios.get(`${API_BASE_URL}/users`, {
        params: { ...adminOrgParam() },
    });
    return response.data;
};

const getLeaderboard = async (date, { groupBy } = {}) => {
    const response = await axios.get(`${API_URL}/leaderboard`, {
        params: { date, ...(groupBy ? { groupBy } : {}), ...adminOrgParam() },
    });
    return response.data;
};

const getWeeklyLeaderboard = async (date, { groupBy } = {}) => {
    const response = await axios.get(`${API_URL}/leaderboard/weekly`, {
        params: { date, ...(groupBy ? { groupBy } : {}), ...adminOrgParam() },
    });
    return response.data;
};

const hourlyService = {
    getConsultants,
    getDayActivities,
    upsertSlot,
    clearSlot,
    clearDay,
    getMonthActivities,
    getDayAdmissions,
    upsertAdmission,
    getMonthAdmissions,
    getDayReferences,
    upsertReference,
    getMonthReferences,
    getAIAnalysis,
    getTeamLeads,
    getLeaderboard,
    getWeeklyLeaderboard,
};

export default hourlyService;
