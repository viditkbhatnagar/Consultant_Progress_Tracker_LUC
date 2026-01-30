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

// Get student statistics
const getStudentStats = async () => {
    const response = await axios.get(`${API_URL}/stats`);
    return response.data;
};

const studentService = {
    getStudents,
    getStudent,
    createStudent,
    updateStudent,
    deleteStudent,
    getStudentStats,
};

export default studentService;
