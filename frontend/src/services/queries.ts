import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { addDays, today } from '../utils/format';
import { CalendarEvent, Announcement, AttendanceRecord, AttendanceSummary, Complaint, MarkRecord, TimetableEntry } from '../types';

/** scope 'section' (students): the whole class sheet including every lab batch. Default: my own batch only. */
export const useTimetable = (scope: 'mine' | 'section' = 'mine') => useQuery({ queryKey: ['timetable', scope], queryFn: () => api<TimetableEntry[]>(scope === 'section' ? '/timetable?scope=section' : '/timetable') });
export const useAttendanceSummary = () => useQuery({ queryKey: ['attendance', 'summary'], queryFn: () => api<AttendanceSummary>('/attendance/summary') });
export const useAttendanceRecords = (courseId?: string, from?: string, to?: string) =>
  useQuery({
    queryKey: ['attendance', 'records', courseId, from, to],
    queryFn: () => { const p = new URLSearchParams(); if (courseId) p.set('courseId', courseId); if (from) p.set('from', from); if (to) p.set('to', to); return api<AttendanceRecord[]>(`/attendance?${p}`); },
  });
export const useMarks = () => useQuery({ queryKey: ['marks'], queryFn: () => api<MarkRecord[]>('/marks') });
export const useAnnouncements = () => useQuery({ queryKey: ['announcements'], queryFn: () => api<Announcement[]>('/announcements') });
export const useComplaints = () => useQuery({ queryKey: ['complaints'], queryFn: () => api<Complaint[]>('/complaints') });

export const useApi = <T,>(key: unknown[], path: string, enabled = true) => useQuery({ queryKey: key, queryFn: () => api<T>(path), enabled });

export const useUpcoming = (days = 30) => useApi<CalendarEvent[]>(['calendar', 'upcoming', days], `/calendar?from=${today()}&to=${addDays(today(), days)}`);
