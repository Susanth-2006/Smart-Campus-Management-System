import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, BookOpen, ClipboardCheck, Megaphone, LifeBuoy, Users, GraduationCap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const FEATURES = [
  { icon: BookOpen, title: 'Academic Management', text: 'Courses, timetable, attendance and marks together.', reveal: ['Attendance', 'Marks', 'Courses', 'Timetable'] },
  { icon: GraduationCap, title: 'Student Experience', text: 'A personal campus home for every student.', reveal: ['Today\'s classes', 'GPA', 'Deadlines'] },
  { icon: Users, title: 'Faculty Experience', text: 'Mark attendance and enter marks in a few clicks.', reveal: ['Roster', 'Quick marking', 'Grades'] },
  { icon: Megaphone, title: 'Announcements', text: 'Targeted notices that reach the right people.', reveal: ['Academic', 'Events', 'Emergency'] },
  { icon: LifeBuoy, title: 'Complaint Management', text: 'Report an issue and watch it get fixed.', reveal: ['Submit', 'Track', 'Resolve'] },
  { icon: BarChart3, title: 'Analytics', text: 'Admins see campus activity at a glance.', reveal: ['Students', 'Attendance', 'Complaints'] },
];

export default function Landing() {
  const { user } = useAuth();
  const [hover, setHover] = useState<number | null>(null);
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"><span className="font-display text-2xl">Smart Campus</span><Link to="/login" className="btn-primary">Login to Campus</Link></header>
      <section className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-navy p-10 text-white sm:p-16">
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-clay/40" /><div className="absolute bottom-6 right-40 h-28 w-28 rounded-full bg-peach/30" />
          <p className="relative text-sm font-semibold uppercase tracking-widest text-peach">Smart Campus Management System</p>
          <h1 className="relative mt-3 max-w-2xl font-display text-5xl leading-tight sm:text-6xl">One connected platform for your entire campus life.</h1>
          <p className="relative mt-4 max-w-xl text-white/70">Manage academics, attendance, courses, timetables, campus services, complaints, announcements and communication from one simple platform.</p>
          <div className="relative mt-8 flex flex-wrap gap-3"><Link to="/login" className="btn bg-peach text-navy hover:bg-peach/90">Login to Campus</Link><a href="#features" className="btn border border-white/30 text-white hover:bg-white/10">Explore Features</a></div>
        </div>
      </section>
      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-4xl">How Smart Campus works</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} whileHover={{ y: -4 }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} className="card">
              <f.icon className="text-clay" /><h3 className="mt-3 font-display text-2xl">{f.title}</h3><p className="text-sm text-slate">{f.text}</p>
              <motion.div initial={false} animate={{ height: hover === i ? 'auto' : 0, opacity: hover === i ? 1 : 0 }} className="overflow-hidden"><div className="flex flex-wrap gap-2 pt-3">{f.reveal.map((r) => <span key={r} className="rounded-full bg-peach/30 px-3 py-1 text-xs font-semibold text-clay">{r}</span>)}</div></motion.div>
            </motion.div>))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-16"><div className="rounded-3xl bg-clay p-10 text-center text-white"><h2 className="font-display text-4xl">Ready to step into your campus?</h2><Link to="/login" className="btn mt-5 bg-white text-navy">Login to Campus</Link></div></section>
      <footer className="border-t border-line py-6 text-center text-sm text-slate">© Smart Campus Management System</footer>
    </div>
  );
}
