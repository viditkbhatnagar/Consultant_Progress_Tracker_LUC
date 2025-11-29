import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/auth`;

// Set auth token header
const setAuthToken = (token) => {
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        localStorage.setItem('token', token);
    } else {
        delete axios.defaults.headers.common['Authorization'];
        localStorage.removeItem('token');
    }
};

// Login user
const login = async (email, password) => {
    const response = await axios.post(`${API_URL}/login`, { email, password });

    if (response.data.success && response.data.token) {
        setAuthToken(response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response.data;
};

// Logout user
const logout = () => {
    setAuthToken(null);
    localStorage.removeItem('user');
};

// Get current user
const getCurrentUser = async () => {
    const response = await axios.get(`${API_URL}/me`);
    return response.data;
};

// Update password
const updatePassword = async (currentPassword, newPassword) => {
    const response = await axios.put(`${API_URL}/updatepassword`, {
        currentPassword,
        newPassword,
    });

    if (response.data.success && response.data.token) {
        setAuthToken(response.data.token);
    }

    return response.data;
};

// Check if user is authenticated
const isAuthenticated = () => {
    const token = localStorage.getItem('token');
    return !!token;
};

// Get stored user
const getStoredUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
};

// Initialize auth token from localStorage
const initializeAuth = () => {
    const token = localStorage.getItem('token');
    if (token) {
        setAuthToken(token);
    }
};

// Get all users (admin only)
export const getUsers = async () => {
    const response = await axios.get(`${API_URL}/users`);
    return response.data;
};

const authService = {
    login,
    logout,
    getCurrentUser,
    updatePassword,
    isAuthenticated,
    getStoredUser,
    setAuthToken,
    initializeAuth,
    // The getUsers function is now exported separately, but if it was intended to be part of authService,
    // it would be defined here. For now, keeping the original inline definition as well,
    // assuming the user wants both a standalone export and an internal one, or that the standalone
    // export is the primary intent. If the standalone export is meant to replace this,
    // this line should be removed.
    getUsers: async () => {
        const response = await axios.get(`${API_BASE_URL}/users`);
        return response.data;
    },
};

export default authService;
