import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/payment-plans`;

// List payment plans (server scopes: team_lead → own team, admin → all).
const getPaymentPlans = async () => (await axios.get(API_URL)).data;

// Create from a linked LUC student: { studentId, status, remarks }.
const createPaymentPlan = async (payload) => (await axios.post(API_URL, payload)).data;

// Update status / remarks: { status?, remarks? }.
const updatePaymentPlan = async (id, payload) => (await axios.put(`${API_URL}/${id}`, payload)).data;

const deletePaymentPlan = async (id) => (await axios.delete(`${API_URL}/${id}`)).data;

const paymentPlanService = {
    getPaymentPlans,
    createPaymentPlan,
    updatePaymentPlan,
    deletePaymentPlan,
};

export default paymentPlanService;
