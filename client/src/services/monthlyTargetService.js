import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/monthly-targets`;

const withAuth = () => ({
    headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    },
});

export const listTargets = async ({ year, teamLeadId } = {}) => {
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (teamLeadId) params.set('teamLeadId', teamLeadId);
    const res = await axios.get(`${API_URL}?${params.toString()}`, withAuth());
    return res.data;
};

export const upsertTarget = async (row) => {
    const res = await axios.put(API_URL, row, withAuth());
    return res.data;
};

export const bulkUpsertTargets = async (rows) => {
    const res = await axios.post(`${API_URL}/bulk`, { rows }, withAuth());
    return res.data;
};

export const deleteTarget = async (id) => {
    const res = await axios.delete(`${API_URL}/${id}`, withAuth());
    return res.data;
};

export default { listTargets, upsertTarget, bulkUpsertTargets, deleteTarget };
