import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const API_URL = `${API_BASE_URL}/students`;

// Get all students with optional filters
const getStudents = async (filters = {}) => {
    const params = new URLSearchParams();

    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.consultant) params.append('consultant', filters.consultant);
    if (filters.university) params.append('university', filters.university);
    if (filters.team) params.append('team', filters.team);
    if (filters.month && filters.month.length > 0) params.append('month', filters.month.join(','));
    if (filters.program) params.append('program', filters.program);
    if (filters.source) params.append('source', filters.source);
    if (filters.conversionOperator && filters.conversionDays) {
        params.append('conversionOperator', filters.conversionOperator);
        params.append('conversionDays', filters.conversionDays);
    }
    if (filters.studentStatus) params.append('studentStatus', filters.studentStatus);
    if (filters.organization) params.append('organization', filters.organization);
    if (filters.curriculumSlug) params.append('curriculumSlug', filters.curriculumSlug);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);

    const queryString = params.toString();
    const url = queryString ? `${API_URL}?${queryString}` : API_URL;

    const response = await axios.get(url);
    return response.data;
};

// Get single student
const getStudent = async (id) => {
    const response = await axios.get(`${API_URL}/${id}`);
    return response.data;
};

// Create student
const createStudent = async (studentData) => {
    const response = await axios.post(API_URL, studentData);
    return response.data;
};

// Update student
const updateStudent = async (id, studentData) => {
    const response = await axios.put(`${API_URL}/${id}`, studentData);
    return response.data;
};

// Delete student
const deleteStudent = async (id) => {
    const response = await axios.delete(`${API_URL}/${id}`);
    return response.data;
};

// Skillhub: mark New Admission as Active
const activateStudent = async (id, activationData = {}) => {
    const response = await axios.patch(`${API_URL}/${id}/activate`, activationData);
    return response.data;
};

// Skillhub: move a student between status tabs (new_admission / active / inactive)
const changeStudentStatus = async (id, studentStatus) => {
    const response = await axios.patch(`${API_URL}/${id}/status`, { studentStatus });
    return response.data;
};

// Get student statistics — mirrors the filter params of getStudents so the
// KPI strip can show "all-time" totals when no filter is set and narrowed
// totals when any filter is applied.
const getStudentStats = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.consultant) params.append('consultant', filters.consultant);
    if (filters.university) params.append('university', filters.university);
    if (filters.team) params.append('team', filters.team);
    if (filters.month && filters.month.length > 0) {
        params.append('month', filters.month.join(','));
    }
    if (filters.program) params.append('program', filters.program);
    if (filters.source) params.append('source', filters.source);
    if (filters.conversionOperator && filters.conversionDays) {
        params.append('conversionOperator', filters.conversionOperator);
        params.append('conversionDays', filters.conversionDays);
    }
    if (filters.studentStatus) params.append('studentStatus', filters.studentStatus);
    if (filters.organization) params.append('organization', filters.organization);
    if (filters.curriculumSlug) params.append('curriculumSlug', filters.curriculumSlug);
    const queryString = params.toString();
    const url = queryString ? `${API_URL}/stats?${queryString}` : `${API_URL}/stats`;
    const response = await axios.get(url);
    return response.data;
};

// Distinct LUC program names (for Meeting Tracker dropdown)
const getPrograms = async () => {
    const response = await axios.get(`${API_URL}/programs`);
    return response.data;
};

// AI analysis for the Student Database — mirrors the pattern used by
// meetings / commitments. The server scopes by the calling user's role
// + organization, so we only pass the date window + (for Skillhub)
// curriculumSlug from the current filter state.
const getStudentAnalysis = async ({ startDate, endDate, curriculumSlug } = {}) => {
    const body = { startDate, endDate };
    if (curriculumSlug) body.curriculumSlug = curriculumSlug;
    const response = await axios.post(`${API_BASE_URL}/ai/student-analysis`, body);
    return response.data;
};

const studentService = {
    getStudents,
    getStudent,
    createStudent,
    updateStudent,
    deleteStudent,
    activateStudent,
    changeStudentStatus,
    getStudentStats,
    getPrograms,
    getStudentAnalysis,
};

export default studentService;
