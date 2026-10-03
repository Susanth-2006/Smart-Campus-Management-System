import { Role } from '../types';

export interface NavLeaf { label: string; to: string; desc?: string }
export interface NavItem { label: string; to?: string; children?: NavLeaf[] }

const campus: NavItem = {
  label: 'Campus',
  children: [
    { label: 'Announcements', to: '/campus/announcements', desc: 'News and notices' },
    { label: 'Complaints', to: '/campus/complaints', desc: 'Report and track issues' },
    { label: 'Facilities', to: '/campus/facilities' },
    { label: 'Events', to: '/campus/events' },
    { label: 'Campus Map', to: '/campus/map' },
  ],
};

export const NAV: Record<Role, NavItem[]> = {
  STUDENT: [
    { label: 'Dashboard', to: '/dashboard' },
    {
      label: 'Academics',
      children: [
        { label: 'My Courses', to: '/academics/courses', desc: 'Everything you are enrolled in' },
        { label: 'Attendance', to: '/academics/attendance', desc: 'Track your presence' },
        { label: 'Marks', to: '/academics/marks', desc: 'Grades and performance' },
        { label: 'Timetable', to: '/academics/timetable', desc: 'Your weekly schedule' },
        { label: 'Faculty', to: '/academics/faculty' },
        { label: 'Academic Calendar', to: '/academics/calendar' },
      ],
    },
    campus,
    {
      label: 'Services',
      children: [
        { label: 'Help Desk', to: '/services/help-desk' },
        { label: 'Maintenance', to: '/services/maintenance' },
        { label: 'Library', to: '/services/library' },
        { label: 'Transport', to: '/services/transport' },
        { label: 'Student Services', to: '/services/student-services' },
      ],
    },
  ],
  FACULTY: [
    { label: 'Dashboard', to: '/dashboard' },
    {
      label: 'Teaching',
      children: [
        { label: 'My Courses', to: '/teaching/courses' },
        { label: 'Attendance', to: '/teaching/attendance', desc: 'Mark today\'s class' },
        { label: 'Marks', to: '/teaching/marks' },
        { label: 'Timetable', to: '/teaching/timetable' },
        { label: 'Academic Calendar', to: '/teaching/calendar' },
      ],
    },
    { label: 'Students', to: '/students' },
    { ...campus, children: campus.children!.filter((c) => c.label !== 'Complaints') },
    { label: 'Services', children: [{ label: 'Help Desk', to: '/services/help-desk' }, { label: 'Library', to: '/services/library' }, { label: 'Transport', to: '/services/transport' }] },
  ],
  ADMIN: [
    { label: 'Dashboard', to: '/dashboard' },
    {
      label: 'Management',
      children: [
        { label: 'Students', to: '/management/students' },
        { label: 'Faculty', to: '/management/faculty' },
        { label: 'Courses', to: '/management/courses' },
        { label: 'Timetable', to: '/management/timetable' },
        { label: 'Academic Calendar', to: '/management/calendar' },
        { label: 'Library', to: '/services/library' },
      ],
    },
    {
      label: 'Reports',
      children: [
        { label: 'Analytics', to: '/reports/analytics', desc: 'Campus activity at a glance' },
        { label: 'Attendance Trends', to: '/reports/attendance' },
        { label: 'Complaint Report', to: '/reports/complaints' },
      ],
    },
    campus,
    { label: 'System', children: [{ label: 'Users', to: '/system/users' }, { label: 'Settings', to: '/system/settings' }] },
  ],
  STAFF: [
    { label: 'Dashboard', to: '/dashboard' },
    {
      label: 'Tasks',
      children: [
        { label: 'Assigned Tasks', to: '/tasks', desc: 'Your work queue' },
        { label: 'In Progress', to: '/tasks?status=IN_PROGRESS' },
        { label: 'Resolved', to: '/tasks?status=RESOLVED' },
      ],
    },
    { label: 'Campus', children: [{ label: 'Announcements', to: '/campus/announcements' }, { label: 'Facilities', to: '/campus/facilities' }, { label: 'Campus Map', to: '/campus/map' }] },
    { label: 'Services', children: [{ label: 'Help Desk', to: '/services/help-desk' }, { label: 'Transport', to: '/services/transport' }] },
  ],
};

export const ROLE_LABEL: Record<Role, string> = { STUDENT: 'Student', FACULTY: 'Faculty', ADMIN: 'Admin', STAFF: 'Campus Staff' };
