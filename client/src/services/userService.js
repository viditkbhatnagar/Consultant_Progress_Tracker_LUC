import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/users`;

// NOTE: do NOT set axios.defaults.baseURL here. Every service in this app
// builds full URLs from API_BASE_URL (e.g. `${API_BASE_URL}/auth/login`).
// In production API_BASE_URL === '/api', so setting a baseURL of '/api'
// would cause axios to double-prefix every request to '/api/api/...'.

// Add auth token to requests
axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Get all users (Admin only). Accepts optional filters (e.g. { organization: 'luc' })
// — important for admin pages that must override the global admin org scope
// interceptor (see utils/axiosAdminOrgInterceptor.js).
const getUsers = async (filters = {}) => {
    const params = {};
    if (filters.organization) params.organization = filters.organization;
    const response = await axios.get(API_URL, { params });
    return response.data;
};

const getUser = async (id) => {
    const response = await axios.get(`${API_URL}/${id}`);
    return response.data;
};

const updateUser = async (id, userData) => {
    const response = await axios.put(`${API_URL}/${id}`, userData);
    return response.data;
};

const deleteUser = async (id) => {
    const response = await axios.delete(`${API_URL}/${id}`);
    return response.data;
};

// Server route is /api/users/team/:teamLeadId — the old client path
// (/users/teamlead/:id/consultants) never matched, so this used to return
// a 404 silently. Matches CLAUDE.md "Known Issues" note.
const getConsultantsByTeamLead = async (teamLeadId) => {
    const response = await axios.get(`${API_URL}/team/${teamLeadId}`);
    return response.data;
};

const userService = {
    getUsers,
    getUser,
    updateUser,
    deleteUser,
    getConsultantsByTeamLead,
};

export default userService;
