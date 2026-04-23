import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/meetings`;

const buildParams = (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.teamLead) params.append('teamLead', filters.teamLead);
    if (filters.consultant) params.append('consultant', filters.consultant);
    if (filters.status) params.append('status', filters.status);
    if (filters.mode) params.append('mode', filters.mode);
    if (filters.search) params.append('search', filters.search);
    if (filters.organization) params.append('organization', filters.organization);
    return params;
};

const getMeetings = async (filters = {}) => {
    const params = buildParams(filters);
    const response = await axios.get(`${API_URL}?${params.toString()}`);
    return response.data;
};

// Lean stats pull — every row matching the current filters, projected down
// to {meetingDate, status}. Used by the KPI strip so KPIs reflect the full
// dataset, not just the visible page.
const getMeetingStats = async (filters = {}) => {
    const params = buildParams(filters);
    const response = await axios.get(`${API_URL}/stats?${params.toString()}`);
    return response.data;
};

const getMeeting = async (id) => {
    const response = await axios.get(`${API_URL}/${id}`);
    return response.data;
};

const createMeeting = async (meetingData) => {
    const response = await axios.post(API_URL, meetingData);
    return response.data;
};

const updateMeeting = async (id, meetingData) => {
    const response = await axios.put(`${API_URL}/${id}`, meetingData);
    return response.data;
};

const deleteMeeting = async (id) => {
    const response = await axios.delete(`${API_URL}/${id}`);
    return response.data;
};

// AI analysis of the current filter window. Re-uses the same filter shape
// the list endpoint uses so callers can just forward their UI filters.
const getAIAnalysis = async (filters = {}) => {
    const params = buildParams(filters);
    const response = await axios.get(`${API_URL}/ai-analysis?${params.toString()}`);
    return response.data;
};

const meetingService = {
    getMeetings,
    getMeetingStats,
    getMeeting,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    getAIAnalysis,
};

export default meetingService;
