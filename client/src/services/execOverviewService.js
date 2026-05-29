import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/exec-overview`;

const withAuth = () => ({
    headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    },
});

export const getOverview = async (year, month) => {
    const qs = new URLSearchParams();
    if (year) qs.set('year', year);
    if (month) qs.set('month', month);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await axios.get(`${API_URL}${suffix}`, withAuth());
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

export const getConsultantPerformance = async (year) => {
    const params = year ? `?year=${year}` : '';
    const res = await axios.get(`${API_URL}/consultant-performance${params}`, withAuth());
    return res.data;
};

const execOverviewService = { getOverview, getTeamDetail, getTeams, getConsultantPerformance };
export default execOverviewService;
