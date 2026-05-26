import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/team-entries`;

const withAuth = () => ({
    headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    },
});

export const listEntries = async ({ year, teamLeadId } = {}) => {
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (teamLeadId) params.set('teamLeadId', teamLeadId);
    const res = await axios.get(`${API_URL}?${params.toString()}`, withAuth());
    return res.data;
};

export const upsertEntry = async (payload) => {
    const res = await axios.put(API_URL, payload, withAuth());
    return res.data;
};

export const bulkUpsertEntries = async (rows) => {
    const res = await axios.post(`${API_URL}/bulk`, { rows }, withAuth());
    return res.data;
};

export const deleteEntry = async (id) => {
    const res = await axios.delete(`${API_URL}/${id}`, withAuth());
    return res.data;
};

export const getBucketMeta = async () => {
    const res = await axios.get(`${API_URL}/meta`, withAuth());
    return res.data;
};

const teamEntryService = {
    listEntries,
    upsertEntry,
    bulkUpsertEntries,
    deleteEntry,
    getBucketMeta,
};

export default teamEntryService;
