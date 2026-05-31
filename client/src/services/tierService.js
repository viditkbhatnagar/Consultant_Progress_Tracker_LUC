import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/tiers`;

// Tier config + live MTD totals.
const getTiers = async () => (await axios.get(API_URL)).data;

// Latest generated tier image (for the banner + TL tab).
const getLatestImage = async () => (await axios.get(`${API_URL}/latest-image`)).data;

// Past tier images (newest first) for the date-wise history view.
const getImageHistory = async () => (await axios.get(`${API_URL}/images`)).data;

// Admin: generate a fresh Tier Fight image. Optional { theme, thoughts, image
// (File) } ride along as multipart so an uploaded base image is supported.
const generateImage = async (opts = {}) => {
    const form = new FormData();
    if (opts.theme) form.append('theme', opts.theme);
    if (opts.title) form.append('title', opts.title);
    if (opts.message) form.append('message', opts.message);
    if (opts.includeTiers !== undefined) form.append('includeTiers', String(opts.includeTiers));
    if (opts.image) form.append('image', opts.image);
    return (await axios.post(`${API_URL}/generate-image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

// Admin: replace a tier's member list (array of consultant ids).
const updateTier = async (tier, members) => (await axios.put(`${API_URL}/${tier}`, { members })).data;

const tierService = { getTiers, getLatestImage, getImageHistory, generateImage, updateTier };

export default tierService;
