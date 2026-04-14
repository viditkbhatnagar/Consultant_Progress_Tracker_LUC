import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/consultants`;

// Get all consultants (filtered by team for TL, or by organization for admin if passed)
const getConsultants = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.organization) params.append('organization', filters.organization);
    const qs = params.toString();
    const response = await axios.get(qs ? `${API_URL}?${qs}` : API_URL);
    return response.data;
};

// Create consultant
const createConsultant = async (consultantData) => {
    const response = await axios.post(API_URL, consultantData);
    return response.data;
};

// Update consultant
const updateConsultant = async (id, consultantData) => {
    const response = await axios.put(`${API_URL}/${id}`, consultantData);
    return response.data;
};

// Delete (deactivate) consultant
const deleteConsultant = async (id) => {
    const response = await axios.delete(`${API_URL}/${id}`);
    return response.data;
};

const consultantService = {
    getConsultants,
    createConsultant,
    updateConsultant,
    deleteConsultant,
};

export default consultantService;
