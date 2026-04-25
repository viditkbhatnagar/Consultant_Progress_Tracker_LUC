import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/exports`;

const postRaw = async (body) => {
    const res = await axios.post(`${API_URL}/raw`, body);
    return res.data;
};

const fetchAllRawRows = async (body, { onProgress } = {}) => {
    let cursor = undefined;
    const allRows = [];
    let totalEstimate = null;
    let scopeNote = null;
    // Hard cap 100k rows client-side per plan §13.
    const HARD_CAP = 100000;
    let safety = 0;
    do {
        const res = await postRaw({ ...body, cursor, limit: 5000 });
        if (totalEstimate == null && typeof res.totalEstimate === 'number') {
            totalEstimate = res.totalEstimate;
        }
        if (!scopeNote && res.scopeNote) scopeNote = res.scopeNote;
        for (const row of res.rows) allRows.push(row);
        if (allRows.length > HARD_CAP) {
            const err = new Error(
                `Export exceeds the 100,000-row client cap (${allRows.length}). Narrow filters and retry.`
            );
            err.code = 'ROW_CAP_EXCEEDED';
            throw err;
        }
        cursor = res.nextCursor;
        if (typeof onProgress === 'function') {
            onProgress({ loaded: allRows.length, total: totalEstimate });
        }
        safety += 1;
        if (safety > 50) break;
    } while (cursor);
    return { rows: allRows, totalEstimate, scopeNote };
};

const getDimensions = async (dataset, organization) => {
    const params = organization ? { organization } : undefined;
    const res = await axios.get(`${API_URL}/dimensions/${dataset}`, { params });
    return res.data;
};

const postPivot = async (body) => {
    const res = await axios.post(`${API_URL}/pivot`, body);
    return res.data;
};

const exportsApi = { postRaw, fetchAllRawRows, getDimensions, postPivot };
export default exportsApi;
