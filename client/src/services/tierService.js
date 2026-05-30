import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/tiers`;

// Tier config + live MTD totals.
const getTiers = async () => (await axios.get(API_URL)).data;

// Latest generated tier image (for the banner + TL tab).
const getLatestImage = async () => (await axios.get(`${API_URL}/latest-image`)).data;

// Admin: generate a fresh tier-standings image (calls OpenAI server-side).
const generateImage = async () => (await axios.post(`${API_URL}/generate-image`)).data;

// Admin: replace a tier's member list (array of consultant ids).
const updateTier = async (tier, members) => (await axios.put(`${API_URL}/${tier}`, { members })).data;

const tierService = { getTiers, getLatestImage, generateImage, updateTier };

export default tierService;
