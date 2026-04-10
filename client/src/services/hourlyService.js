import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/hourly`;

const getConsultants = async (scope) => {
    const params = scope ? { scope } : {};
    const response = await axios.get(`${API_URL}/consultants`, { params });
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

const getDayReferences = async (date) => {
    const response = await axios.get(`${API_URL}/references`, { params: { date } });
    return response.data;
};

const upsertReference = async (data) => {
    const response = await axios.put(`${API_URL}/references`, data);
    return response.data;
};

const getMonthReferences = async (year, month) => {
    const response = await axios.get(`${API_URL}/references/month`, { params: { year, month } });
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
    getDayReferences,
    upsertReference,
    getMonthReferences,
    getAIAnalysis,
    getTeamLeads,
    getLeaderboard,
};

export default hourlyService;
