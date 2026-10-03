import { lazy, ReactNode, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';
import AppLayout from '../layouts/AppLayout';
import Login from '../pages/Login';
import Landing from '../pages/Landing';
import Placeholder from '../pages/Placeholder';
import DashboardRouter from '../pages/DashboardRouter';
import { Skeleton } from '../components/ui';

// Code splitting: every page below loads on demand
const L = (f: () => Promise<any>, name = 'default') => lazy(() => f().then((m) => ({ default: m[name] })));
const Attendance = L(() => import('../pages/Attendance'));
const Timetable = L(() => import('../pages/Timetable'));
const Courses = L(() => import('../pages/Courses'));
const CourseDetail = L(() => import('../pages/CourseDetail'));
const Marks = L(() => import('../pages/Marks'));
const Complaints = L(() => import('../pages/Complaints'));
const NewComplaint = L(() => import('../pages/NewComplaint'));
const ComplaintDetail = L(() => import('../pages/ComplaintDetail'));
const Announcements = L(() => import('../pages/Announcements'));
const AnnouncementDetail = L(() => import('../pages/AnnouncementDetail'));
const Profile = L(() => import('../pages/Profile'));
const TeachAttendance = L(() => import('../pages/TeachAttendance'));
const TeachMarks = L(() => import('../pages/TeachMarks'));
const AdminDashboard = L(() => import('../pages/AdminDashboard'));
const StudentsList = L(() => import('../pages/People'), 'StudentsList');
const FacultyList = L(() => import('../pages/People'), 'FacultyList');
const Facilities = L(() => import('../pages/Facilities'));
const CampusMap = L(() => import('../pages/CampusMap'));
const Library = L(() => import('../pages/Library'));
const Transport = L(() => import('../pages/Transport'));
const AcademicCalendar = L(() => import('../pages/AcademicCalendar'));
const Services = L(() => import('../pages/Services'));
const Settings = L(() => import('../pages/Settings'));
const Users = L(() => import('../pages/Users'));
const StaffTasks = L(() => import('../pages/StaffPages'), 'StaffTasks');

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-slate">Loading…</div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}
function Only({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  return user && roles.includes(user.role) ? <>{children}</> : <Navigate to="/dashboard" replace />;
}
const S = ({ roles, el }: { roles: Role[]; el: ReactNode }) => <Only roles={roles}>{el}</Only>;

export function AppRoutes() {
  return (
    <Suspense fallback={<div className="p-10"><Skeleton className="h-64" /></div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route element={<Protected><AppLayout /></Protected>}>
          <Route path="/dashboard" element={<DashboardRouter />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/services/help-desk" element={<Services />} />
          <Route path="/services/maintenance" element={<Services />} />
          <Route path="/services/student-services" element={<Services />} />
          <Route path="/campus/facilities" element={<Facilities />} />
          <Route path="/campus/map" element={<CampusMap />} />
          <Route path="/services/library" element={<Library />} />
          <Route path="/services/transport" element={<Transport />} />
          <Route path="/academics/calendar" element={<S roles={['STUDENT']} el={<AcademicCalendar />} />} />
          <Route path="/teaching/calendar" element={<S roles={['FACULTY']} el={<AcademicCalendar />} />} />
          <Route path="/management/calendar" element={<S roles={['ADMIN']} el={<AcademicCalendar />} />} />
          <Route path="/campus/events" element={<Navigate to="/campus/announcements?category=EVENTS" replace />} />

          {/* Student */}
          <Route path="/academics/attendance" element={<S roles={['STUDENT']} el={<Attendance />} />} />
          <Route path="/academics/timetable" element={<S roles={['STUDENT']} el={<Timetable />} />} />
          <Route path="/academics/courses" element={<S roles={['STUDENT']} el={<Courses />} />} />
          <Route path="/academics/courses/:id" element={<S roles={['STUDENT']} el={<CourseDetail />} />} />
          <Route path="/academics/marks" element={<S roles={['STUDENT']} el={<Marks />} />} />
          <Route path="/academics/faculty" element={<S roles={['STUDENT']} el={<FacultyList />} />} />

          {/* Faculty */}
          <Route path="/teaching/courses" element={<S roles={['FACULTY']} el={<Courses />} />} />
          <Route path="/teaching/courses/:id" element={<S roles={['FACULTY']} el={<CourseDetail />} />} />
          <Route path="/teaching/attendance" element={<S roles={['FACULTY']} el={<TeachAttendance />} />} />
          <Route path="/teaching/marks" element={<S roles={['FACULTY']} el={<TeachMarks />} />} />
          <Route path="/teaching/timetable" element={<S roles={['FACULTY']} el={<Timetable />} />} />
          <Route path="/students" element={<S roles={['FACULTY']} el={<StudentsList />} />} />

          {/* Admin */}
          <Route path="/management/students" element={<S roles={['ADMIN']} el={<StudentsList />} />} />
          <Route path="/management/faculty" element={<S roles={['ADMIN']} el={<FacultyList />} />} />
          <Route path="/management/courses" element={<S roles={['ADMIN']} el={<Courses />} />} />
          <Route path="/management/courses/:id" element={<S roles={['ADMIN']} el={<CourseDetail />} />} />
          <Route path="/management/timetable" element={<S roles={['ADMIN']} el={<Timetable />} />} />
          <Route path="/reports/analytics" element={<S roles={['ADMIN']} el={<AdminDashboard />} />} />
          <Route path="/reports/attendance" element={<S roles={['ADMIN']} el={<AdminDashboard />} />} />
          <Route path="/reports/complaints" element={<S roles={['ADMIN']} el={<Complaints />} />} />

          <Route path="/system/users" element={<S roles={['ADMIN']} el={<Users />} />} />
          <Route path="/system/settings" element={<Settings />} />

          {/* Staff */}
          <Route path="/tasks" element={<S roles={['STAFF']} el={<StaffTasks />} />} />

          {/* Shared campus */}
          <Route path="/campus/announcements" element={<Announcements />} />
          <Route path="/campus/announcements/:id" element={<AnnouncementDetail />} />
          <Route path="/campus/complaints" element={<S roles={['STUDENT', 'ADMIN']} el={<Complaints />} />} />
          <Route path="/campus/complaints/new" element={<S roles={['STUDENT']} el={<NewComplaint />} />} />
          <Route path="/campus/complaints/:id" element={<S roles={['STUDENT', 'ADMIN', 'STAFF']} el={<ComplaintDetail />} />} />

          <Route path="*" element={<Placeholder />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
