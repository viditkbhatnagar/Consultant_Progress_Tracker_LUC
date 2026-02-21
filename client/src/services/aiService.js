import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/ai`;

const generateAnalysis = async (startDate, endDate) => {
    const response = await axios.post(`${API_URL}/analysis`, {
        startDate,
        endDate,
    });
    return response.data;
};

const getUsageStats = async () => {
    const response = await axios.get(`${API_URL}/usage`);
    return response.data;
};

const aiService = {
    generateAnalysis,
    getUsageStats,
};

export default aiService;
