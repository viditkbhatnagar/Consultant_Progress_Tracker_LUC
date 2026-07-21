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
    // `subject` scopes the roster to that subject — without it the roster is
    // grade-wide and a student shows up under every subject of that grade.
    getRoster: async (gradeOrYear, subject) =>
        (await axios.get(`${URL}/attendance/roster`, { params: { gradeOrYear, subject: subject || undefined } })).data,
    // Class-list membership, independent of whether the student has been marked.
    addRosterStudent: async ({ gradeOrYear, subject, studentName, student }) =>
        (await axios.post(`${URL}/attendance/roster`, { gradeOrYear, subject, studentName, student })).data,
    removeRosterStudent: async ({ gradeOrYear, subject, studentName }) =>
        (await axios.delete(`${URL}/attendance/roster`, { data: { gradeOrYear, subject, studentName } })).data,
    // Institute students, for linking added names to real admission records.
    getInstituteStudents: async () => (await axios.get(`${URL}/students`)).data,
    getAttendance: async (params) => (await axios.get(`${URL}/attendance`, { params })).data,
    markAttendance: async (body) => (await axios.post(`${URL}/attendance`, body)).data,
    // Cancel one wrong mark — the student keeps every other record.
    deleteAttendanceEntry: async ({ gradeOrYear, subject, date, studentName }) =>
        (await axios.delete(`${URL}/attendance/entry`, {
            data: { gradeOrYear, subject: subject || '', date, studentName },
        })).data,
    // Remove the student from the whole grade/year (all their rows).
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
