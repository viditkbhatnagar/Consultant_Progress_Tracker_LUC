import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

// Get auth token from localStorage
const getAuthToken = () => {
    return localStorage.getItem('token');
};

// Set up axios defaults
axios.defaults.baseURL = API_URL;

// Add auth token to requests
axios.interceptors.request.use(
    (config) => {
        const token = getAuthToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Get all users (Admin only)
const getUsers = async () => {
    const response = await axios.get('/users');
    return response.data;
};

// Get single user
const getUser = async (id) => {
    const response = await axios.get(`/users/${id}`);
    return response.data;
};

// Update user
const updateUser = async (id, userData) => {
    const response = await axios.put(`/users/${id}`, userData);
    return response.data;
};

// Delete user
const deleteUser = async (id) => {
    const response = await axios.delete(`/users/${id}`);
    return response.data;
};

// Get consultants by team lead
const getConsultantsByTeamLead = async (teamLeadId) => {
    const response = await axios.get(`/users/teamlead/${teamLeadId}/consultants`);
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
