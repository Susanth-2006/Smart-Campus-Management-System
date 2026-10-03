import { Link, useLocation } from 'react-router-dom';
import { BookOpenCheck, LifeBuoy, ListChecks, Megaphone, PlusCircle, Wrench } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';

interface Action { to: string; title: string; text: string; icon: typeof LifeBuoy }

const ACTIONS: Record<Role, Action[]> = {
  STUDENT: [
    { to: '/campus/complaints/new', title: 'Report an issue', text: 'Electricity, water, internet, classroom, hostel and more.', icon: PlusCircle },
    { to: '/campus/complaints', title: 'Track my complaints', text: 'See exactly where each request stands.', icon: ListChecks },
    { to: '/campus/announcements', title: 'Announcements', text: 'Notices from departments and administration.', icon: Megaphone },
    { to: '/academics/courses', title: 'My courses', text: 'Faculty, schedule, attendance and marks per course.', icon: BookOpenCheck },
  ],
  FACULTY: [
    { to: '/campus/announcements', title: 'Announcements', text: 'Notices from administration.', icon: Megaphone },
    { to: '/teaching/courses', title: 'My courses', text: 'Rosters, schedule and results.', icon: BookOpenCheck },
  ],
  ADMIN: [
    { to: '/reports/complaints', title: 'All complaints', text: 'Review, assign and resolve campus issues.', icon: LifeBuoy },
    { to: '/campus/announcements', title: 'Announcements', text: 'Publish notices to the right audience.', icon: Megaphone },
  ],
  STAFF: [
    { to: '/tasks', title: 'My tasks', text: 'Accept, update and resolve assigned work.', icon: Wrench },
    { to: '/campus/announcements', title: 'Announcements', text: 'Campus notices.', icon: Megaphone },
  ],
};
const TITLES: Record<string, string> = { 'help-desk': 'Help Desk', maintenance: 'Maintenance', 'student-services': 'Student Services' };

export default function Services() {
  const { user } = useAuth();
  const key = useLocation().pathname.split('/').pop() ?? '';
  return (
    <div className="space-y-5">
      <header><h1 className="font-display text-4xl">{TITLES[key] ?? 'Services'}</h1><p className="text-slate">Quick ways to get things done on campus.</p></header>
      <div className="grid gap-4 sm:grid-cols-2">
        {ACTIONS[user!.role].map(({ to, title, text, icon: Icon }) => (
          <Link key={to} to={to} className="card flex gap-4 transition hover:-translate-y-0.5"><Icon className="mt-1 shrink-0 text-clay" /><span><span className="block font-semibold">{title}</span><span className="text-sm text-slate">{text}</span></span></Link>
        ))}
      </div>
      <p className="text-sm text-slate">Need something else? Contact the administration office at <a className="text-clay underline" href="mailto:admin@smartcampus.com">admin@smartcampus.com</a>.</p>
    </div>
  );
}
