import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth';
import { env } from '../utils/env';
import * as auth from '../controllers/authController';
import * as students from '../controllers/studentController';
import * as attendance from '../controllers/attendanceController';
import * as marks from '../controllers/marksController';
import * as courses from '../controllers/courseController';
import * as timetable from '../controllers/timetableController';
import * as complaints from '../controllers/complaintController';
import * as announcements from '../controllers/announcementController';
import * as notifications from '../controllers/notificationController';
import * as meta from '../controllers/metaController';
import * as uploads from '../controllers/uploadController';
import * as materials from '../controllers/materialController';
import * as facilities from '../controllers/facilityController';
import * as library from '../controllers/libraryController';
import * as transport from '../controllers/transportController';
import * as calendar from '../controllers/calendarController';

const r = Router();
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.uploadRateLimit, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many uploads. Try again later.' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.loginRateLimit, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts. Try again later.' } });

// Auth
r.post('/auth/login', loginLimiter, auth.login);
r.post('/auth/logout', auth.logout);
r.get('/auth/me', authenticate, auth.me);

// Everything below requires a valid token
r.use(authenticate);

r.get('/students', authorize('ADMIN', 'FACULTY'), students.listStudents);
r.get('/students/:id', authorize('ADMIN', 'FACULTY', 'STUDENT'), students.getStudent);

r.get('/attendance', authorize('ADMIN', 'FACULTY', 'STUDENT'), attendance.listAttendance);
r.get('/attendance/summary', authorize('ADMIN', 'FACULTY', 'STUDENT'), attendance.attendanceSummary);
r.post('/attendance', authorize('ADMIN', 'FACULTY'), attendance.markAttendance);
r.put('/attendance/:id', authorize('ADMIN', 'FACULTY'), attendance.updateAttendance);

r.get('/marks', authorize('ADMIN', 'FACULTY', 'STUDENT'), marks.listMarks);
r.post('/marks', authorize('ADMIN', 'FACULTY'), marks.createMarks);
r.put('/marks/:id', authorize('ADMIN', 'FACULTY'), marks.updateMarks);

r.get('/courses', courses.listCourses);
r.get('/courses/:id', courses.getCourse);
r.post('/courses', authorize('ADMIN'), courses.createCourse);
r.put('/courses/:id', authorize('ADMIN'), courses.updateCourse);
r.delete('/courses/:id', authorize('ADMIN'), courses.deleteCourse);

r.get('/timetable', authorize('ADMIN', 'FACULTY', 'STUDENT'), timetable.listTimetable);
r.post('/timetable', authorize('ADMIN'), timetable.createSlot);
r.put('/timetable/:id', authorize('ADMIN'), timetable.updateSlot);

r.get('/complaints', authorize('ADMIN', 'STUDENT', 'STAFF'), complaints.listComplaints);
r.get('/complaints/:id', complaints.getComplaint);
r.post('/complaints', authorize('STUDENT'), complaints.createComplaint);
r.patch('/complaints/:id/status', authorize('ADMIN', 'STAFF', 'STUDENT'), complaints.updateStatus);

r.get('/announcements', announcements.listAnnouncements);
r.post('/announcements', authorize('ADMIN'), announcements.createAnnouncement);
r.put('/announcements/:id', authorize('ADMIN'), announcements.updateAnnouncement);
r.patch('/announcements/:id/read', announcements.markRead);

r.get('/notifications', notifications.listNotifications);
r.patch('/notifications/read-all', notifications.markAllRead);
r.patch('/notifications/:id/read', notifications.markNotificationRead);

r.patch('/auth/password', auth.changePassword);
r.get('/users', authorize('ADMIN'), meta.listUsers);
r.get('/departments', meta.listDepartments);
r.get('/faculty', meta.listFaculty);
r.get('/staff', authorize('ADMIN'), meta.listStaff);
r.get('/stats', authorize('ADMIN'), meta.stats);
r.get('/search', meta.search);

r.post('/uploads', uploadLimiter, uploads.upload);
r.get('/courses/:id/materials', materials.listMaterials);
r.post('/courses/:id/materials', authorize('FACULTY', 'ADMIN'), materials.createMaterial);
r.delete('/materials/:id', authorize('FACULTY', 'ADMIN'), materials.deleteMaterial);

r.get('/facilities', facilities.listFacilities);

r.get('/library/books', library.listBooks);
r.get('/library/categories', library.listCategories);
r.post('/library/books', authorize('ADMIN'), library.createBook);
r.post('/library/books/:id/borrow', authorize('STUDENT', 'FACULTY'), library.borrow);
r.get('/library/loans', library.listLoans);
r.post('/library/loans/:id/return', library.returnLoan);

r.get('/transport/routes', transport.listRoutes);
r.get('/transport/my-route', transport.myRoute);
r.put('/transport/my-route', transport.setMyRoute);
r.delete('/transport/my-route', transport.clearMyRoute);

r.get('/calendar', calendar.listEvents);
r.post('/calendar', authorize('ADMIN'), calendar.createEvent);
r.put('/calendar/:id', authorize('ADMIN'), calendar.updateEvent);
r.delete('/calendar/:id', authorize('ADMIN'), calendar.deleteEvent);

export default r;
