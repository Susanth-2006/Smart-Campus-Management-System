export type Role = 'STUDENT' | 'FACULTY' | 'ADMIN' | 'STAFF';
export interface AuthUser {
  id: string; name: string; email: string; role: Role; profileId: string; avatarUrl?: string | null;
  student?: { rollNo: string; semester: number; section: string; batch?: string | null; department: { code: string; name: string } } | null;
}
export interface AppNotification { id: string; type: string; title: string; message: string; link?: string | null; read: boolean; createdAt: string }

export interface TimetableEntry {
  id: string; dayOfWeek: number; startTime: string; endTime: string; room: string;
  /** "ALL", or a lab batch such as "B-1" / "B-2" */ section: string;
  course: { id: string; code: string; name: string; faculty: { id: string; user: { name: string } } };
}
export interface AttendanceSummary {
  overall: number; totalClasses: number;
  courses: { courseId: string; code: string; name: string; total: number; present: number; late: number; absent: number; percentage: number }[];
}
export interface AttendanceRecord { id: string; courseId: string; date: string; status: 'PRESENT' | 'ABSENT' | 'LATE'; course: { code: string; name: string } }
export interface MarkRecord { id: string; studentId: string; courseId: string; internal: number | null; assignment: number | null; midExam: number | null; finalExam: number | null; total: number; grade: string | null; published: boolean; course: { code: string; name: string; credits: number } }
export interface Announcement { id: string; title: string; body: string; category: string; priority: string; audience: string[]; createdAt: string; read: boolean }
export interface Complaint { id: string; ticketNo: number; imageUrl?: string | null; imageSrc?: string | null; title: string; status: string; priority: string; category: string; location: string; createdAt: string }

export interface Course {
  id: string; code: string; name: string; description?: string | null; credits: number; semester: number; room: string;
  department: { id: string; code: string; name: string };
  faculty: { id: string; designation: string; user: { name: string; email: string } };
  _count: { enrollments: number };
  timetable?: { id: string; dayOfWeek: number; startTime: string; endTime: string; room: string; section?: string }[];
}
export interface Person { id: string; rollNo?: string; section?: string; semester?: number; user: { name: string; email: string }; department: { code: string; name: string } }
export interface ComplaintFull extends Complaint {
  description: string; student?: { rollNo: string; user: { name: string } };
  task?: { staffId: string; status: string; staff: { user: { name: string }; staffType: string } } | null;
  events?: { id: string; status: string; note?: string | null; createdAt: string; actor?: { name: string; role: string } | null }[];
}

export interface Facility { id: string; name: string; category: string; building: string; floor?: string | null; description: string; hours: string; capacity?: number | null; mapX: number; mapY: number }
export interface Book { id: string; title: string; author: string; category: string; isbn?: string | null; copies: number; available: number; myLoan: { id: string; dueAt: string } | null }
export interface Loan { id: string; issuedAt: string; dueAt: string; returnedAt: string | null; book: { title: string; author: string }; user?: { name: string; role: Role } }
export interface RouteStop { id: string; name: string; order: number; pickupTime: string }
export interface TransportRoute { id: string; number: string; name: string; vehicleNo: string; driverName: string; driverPhone: string; capacity: number; stops: RouteStop[]; _count: { passes: number } }
export interface TransportPass { id: string; route: TransportRoute; stop: RouteStop }
export interface CalendarEvent { id: string; title: string; type: 'HOLIDAY' | 'EXAM' | 'DEADLINE' | 'EVENT' | 'CLASS'; startDate: string; endDate: string; description?: string | null }
export interface MaterialItem { id: string; title: string; fileName: string; storedName: string; downloadUrl: string; mimeType: string; size: number; createdAt: string; uploadedBy: { name: string } }
