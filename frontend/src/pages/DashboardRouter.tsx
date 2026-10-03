import { lazy } from 'react';
import { useAuth } from '../hooks/useAuth';

const StudentDashboard = lazy(() => import('./StudentDashboard'));
const FacultyDashboard = lazy(() => import('./FacultyDashboard'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const StaffDashboard = lazy(() => import('./StaffPages').then((m) => ({ default: m.StaffDashboard })));

export default function DashboardRouter() {
  const { user } = useAuth();
  switch (user?.role) {
    case 'STUDENT': return <StudentDashboard />;
    case 'FACULTY': return <FacultyDashboard />;
    case 'ADMIN': return <AdminDashboard />;
    default: return <StaffDashboard />;
  }
}
