import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/hourly`;

const getConsultants = async () => {
    const response = await axios.get(`${API_URL}/consultants`);
    return response.data;
};

const getDayActivities = async (date) => {
    const response = await axios.get(`${API_URL}/day`, { params: { date } });
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
        params: { date },
    });
    return response.data;
};

const getMonthActivities = async (year, month) => {
    const response = await axios.get(`${API_URL}/month`, {
        params: { year, month },
    });
    return response.data;
};

const getDayAdmissions = async (date) => {
    const response = await axios.get(`${API_URL}/admissions`, {
        params: { date },
    });
    return response.data;
};

const upsertAdmission = async (data) => {
    const response = await axios.put(`${API_URL}/admissions`, data);
    return response.data;
};

const getMonthAdmissions = async (year, month) => {
    const response = await axios.get(`${API_URL}/admissions/month`, {
        params: { year, month },
    });
    return response.data;
};

const getAIAnalysis = async (date) => {
    const response = await axios.get(`${API_URL}/ai-analysis`, { params: { date } });
    return response.data;
};

const getTeamLeads = async () => {
    const response = await axios.get(`${API_BASE_URL}/users`);
    return response.data;
};

const getLeaderboard = async (date) => {
    const response = await axios.get(`${API_URL}/leaderboard`, { params: { date } });
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
    getAIAnalysis,
    getTeamLeads,
    getLeaderboard,
};

export default hourlyService;
