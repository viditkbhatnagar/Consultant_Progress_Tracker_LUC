import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/notifications`;

// Get all notifications
const getNotifications = async () => {
    const response = await axios.get(API_URL);
    return response.data;
};

// Mark notification as read
const markAsRead = async (id) => {
    const response = await axios.patch(`${API_URL}/${id}/read`);
    return response.data;
};

// Mark all notifications as read
const markAllAsRead = async () => {
    const response = await axios.patch(`${API_URL}/read-all`);
    return response.data;
};

// Delete notification
const deleteNotification = async (id) => {
    const response = await axios.delete(`${API_URL}/${id}`);
    return response.data;
};

// Generate follow-up reminders (Admin/Team Lead only)
const generateReminders = async () => {
    const response = await axios.post(`${API_URL}/generate-reminders`);
    return response.data;
};

const notificationService = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    generateReminders,
};

export default notificationService;
