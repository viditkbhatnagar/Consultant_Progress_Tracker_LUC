import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/exec-overview`;

const withAuth = () => ({
    headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    },
});

export const getOverview = async (year) => {
    const params = year ? `?year=${year}` : '';
    const res = await axios.get(`${API_URL}${params}`, withAuth());
    return res.data;
};

export const getTeamDetail = async (teamLeadId, year) => {
    const params = year ? `?year=${year}` : '';
    const res = await axios.get(`${API_URL}/team/${teamLeadId}${params}`, withAuth());
    return res.data;
};

export const getTeams = async () => {
    const res = await axios.get(`${API_URL}/teams`, withAuth());
    return res.data;
};

export default { getOverview, getTeamDetail, getTeams };
