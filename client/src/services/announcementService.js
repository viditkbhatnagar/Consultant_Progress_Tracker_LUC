import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/announcements`;

// Active announcements for the current user's org that they haven't dismissed.
const getActiveAnnouncements = async () => {
    const response = await axios.get(`${API_URL}/active`);
    return response.data;
};

// Acknowledge (dismiss) an announcement for the current user.
const acknowledgeAnnouncement = async (id) => {
    const response = await axios.post(`${API_URL}/${id}/ack`);
    return response.data;
};

const announcementService = { getActiveAnnouncements, acknowledgeAnnouncement };

export default announcementService;
