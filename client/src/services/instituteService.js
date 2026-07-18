import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const URL = `${API_BASE_URL}/institute`;

// Skillhub Institute — teachers, timetable, attendance.
const instituteService = {
    // Teachers
    getTeachers: async () => (await axios.get(`${URL}/teachers`)).data,
    createTeacher: async (body) => (await axios.post(`${URL}/teachers`, body)).data,
    updateTeacher: async (id, body) => (await axios.put(`${URL}/teachers/${id}`, body)).data,
    deleteTeacher: async (id) => (await axios.delete(`${URL}/teachers/${id}`)).data,

    // Timetable
    getTimetable: async (params = {}) => (await axios.get(`${URL}/timetable`, { params })).data,
    createEntry: async (body) => (await axios.post(`${URL}/timetable`, body)).data,
    updateEntry: async (id, body) => (await axios.put(`${URL}/timetable/${id}`, body)).data,
    deleteEntry: async (id) => (await axios.delete(`${URL}/timetable/${id}`)).data,

    // Attendance
    getAttendanceMeta: async () => (await axios.get(`${URL}/attendance/meta`)).data,
    getRoster: async (gradeOrYear) =>
        (await axios.get(`${URL}/attendance/roster`, { params: { gradeOrYear } })).data,
    getAttendance: async (params) => (await axios.get(`${URL}/attendance`, { params })).data,
    markAttendance: async (body) => (await axios.post(`${URL}/attendance`, body)).data,
    deleteAttendanceStudent: async (gradeOrYear, studentName) =>
        (await axios.delete(`${URL}/attendance/student`, { data: { gradeOrYear, studentName } })).data,

    // Tests
    getTestMeta: async () => (await axios.get(`${URL}/tests/meta`)).data,
    getTests: async (params = {}) => (await axios.get(`${URL}/tests`, { params })).data,
    saveTests: async (body) => (await axios.post(`${URL}/tests`, body)).data,
    updateTest: async (id, body) => (await axios.put(`${URL}/tests/${id}`, body)).data,
    deleteTest: async (id) => (await axios.delete(`${URL}/tests/${id}`)).data,
};

export default instituteService;
