import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/commitments`;

// Get all commitments (filtered by role automatically on backend)
const getCommitments = async (filters = {}) => {
    const params = new URLSearchParams();

    if (filters.weekNumber) params.append('weekNumber', filters.weekNumber);
    if (filters.year) params.append('year', filters.year);
    if (filters.status) params.append('status', filters.status);

    const response = await axios.get(`${API_URL}?${params.toString()}`);
    return response.data;
};

// Get single commitment
const getCommitment = async (id) => {
    const response = await axios.get(`${API_URL}/${id}`);
    return response.data;
};

// Create new commitment
const createCommitment = async (commitmentData) => {
    const response = await axios.post(API_URL, commitmentData);
    return response.data;
};

// Update commitment
const updateCommitment = async (id, commitmentData) => {
    const response = await axios.put(`${API_URL}/${id}`, commitmentData);
    return response.data;
};

// Delete commitment
const deleteCommitment = async (id) => {
    const response = await axios.delete(`${API_URL}/${id}`);
    return response.data;
};

// Mark admission as closed
const closeAdmission = async (id, closedDate, closedAmount) => {
    const response = await axios.patch(`${API_URL}/${id}/close`, {
        closedDate,
        closedAmount,
    });
    return response.data;
};

// Update meetings count
const updateMeetings = async (id, meetingsDone) => {
    const response = await axios.patch(`${API_URL}/${id}/meetings`, {
        meetingsDone,
    });
    return response.data;
};

// Get commitments for specific week
const getWeekCommitments = async (weekNumber, year) => {
    const response = await axios.get(`${API_URL}/week/${weekNumber}/${year}`);
    return response.data;
};

// Get current week's commitments
const getCurrentWeekCommitments = async () => {
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();
    return getWeekCommitments(weekNumber, year);
};

// Helper function to get week number
const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

// Get commitments by date range
const getCommitmentsByDateRange = async (startDate, endDate, consultantId = null) => {
    const params = { startDate, endDate };
    if (consultantId) params.consultantId = consultantId;

    const response = await axios.get(`${API_URL}/date-range`, { params });
    return response.data;
};

// Get consultant performance details
const getConsultantPerformance = async (consultantId, months = 3) => {
    const response = await axios.get(
        `${API_URL}/consultant/${consultantId}/performance`,
        { params: { months } }
    );
    return response.data;
};

const commitmentService = {
    getCommitments,
    getCommitment,
    createCommitment,
    updateCommitment,
    deleteCommitment,
    closeAdmission,
    updateMeetings,
    getWeekCommitments,
    getCurrentWeekCommitments,
    getCommitmentsByDateRange,
    getConsultantPerformance,
};

export default commitmentService;
