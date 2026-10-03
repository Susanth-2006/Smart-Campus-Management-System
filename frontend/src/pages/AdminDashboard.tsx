import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpen, GraduationCap, LifeBuoy, Users } from 'lucide-react';
import { useApi } from '../services/queries';
import { Complaint } from '../types';
import { STATUS_LABEL } from '../utils/format';
import { EmptyState, ErrorState, Skeleton, StatCard } from '../components/ui';

interface Stats {
  totals: { students: number; faculty: number; courses: number; pendingComplaints: number };
  studentsByDepartment: { code: string; name: string; students: number; courses: number }[];
  attendanceTrend: { week: string; percentage: number }[];
  complaintsByCategory: { category: string; count: number }[];
  complaintsByStatus: { status: string; count: number }[];
}
const COLORS = ['#0F3040', '#A56F63', '#D99B7F', '#464858'];
const tip = { contentStyle: { borderRadius: 12, border: '1px solid #E8DFD9' } };

export default function AdminDashboard() {
  const { data: s, isLoading, isError, refetch } = useApi<Stats>(['stats'], '/stats');
  const [cat, setCat] = useState<string>(''), [dept, setDept] = useState<string>('');
  const list = useApi<Complaint[]>(['complaints', 'cat', cat], `/complaints${cat ? `?category=${cat}` : ''}`);
  if (isLoading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  if (isError || !s) return <ErrorState text="Unable to load analytics. Try again." onRetry={() => refetch()} />;
  const d = s.studentsByDepartment.find((x) => x.code === dept);

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-navy p-6 text-white sm:p-8"><h1 className="font-display text-3xl sm:text-4xl">Campus at a glance</h1><p className="text-white/70">Click any chart to drill in.</p></header>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total students" value={s.totals.students} to="/management/students" icon={<GraduationCap size={18} />} />
        <StatCard label="Faculty" value={s.totals.faculty} to="/management/faculty" icon={<Users size={18} />} />
        <StatCard label="Courses" value={s.totals.courses} to="/management/courses" icon={<BookOpen size={18} />} />
        <StatCard label="Pending complaints" value={s.totals.pendingComplaints} to="/reports/complaints" icon={<LifeBuoy size={18} />} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card"><h2 className="mb-3 font-display text-2xl">Students by department</h2>
          <div className="h-60"><ResponsiveContainer><BarChart data={s.studentsByDepartment} margin={{ left: -20 }}><CartesianGrid stroke="#E8DFD9" vertical={false} /><XAxis dataKey="code" fontSize={12} /><YAxis fontSize={12} allowDecimals={false} /><Tooltip {...tip} cursor={{ fill: '#D99B7F33' }} />
            <Bar dataKey="students" radius={[8, 8, 0, 0]} cursor="pointer" onClick={(x: any) => setDept(dept === x.code ? '' : x.code)}>{s.studentsByDepartment.map((x) => <Cell key={x.code} fill={x.code === dept ? '#A56F63' : '#0F3040'} />)}</Bar></BarChart></ResponsiveContainer></div>
          {d ? <p className="mt-2 rounded-xl bg-peach/25 px-3 py-2 text-sm"><b>{d.name}</b>: {d.students} students, {d.courses} courses</p> : <p className="mt-2 text-xs text-slate">Select a bar for department details.</p>}</div>

        <div className="card"><h2 className="mb-3 font-display text-2xl">Attendance trend</h2>
          {!s.attendanceTrend.length ? <EmptyState text="No attendance data." /> : <div className="h-60"><ResponsiveContainer><LineChart data={s.attendanceTrend.map((w) => ({ ...w, week: new Date(w.week).toLocaleDateString([], { month: 'short', day: 'numeric' }) }))} margin={{ left: -20 }}><CartesianGrid stroke="#E8DFD9" vertical={false} /><XAxis dataKey="week" fontSize={12} /><YAxis domain={[50, 100]} unit="%" fontSize={12} /><Tooltip {...tip} formatter={(v: any) => [`${v}%`, 'Attendance']} /><Line dataKey="percentage" stroke="#A56F63" strokeWidth={3} dot={{ r: 4, fill: '#0F3040' }} /></LineChart></ResponsiveContainer></div>}</div>

        <div className="card"><h2 className="mb-3 font-display text-2xl">Complaints by category</h2>
          {!s.complaintsByCategory.length ? <EmptyState text="No complaints yet." /> : <div className="h-60"><ResponsiveContainer><PieChart><Pie data={s.complaintsByCategory} dataKey="count" nameKey="category" outerRadius={85} cursor="pointer" onClick={(x: any) => setCat(cat === x.category ? '' : x.category)}>{s.complaintsByCategory.map((c, i) => <Cell key={c.category} fill={COLORS[i % 4]} stroke={c.category === cat ? '#000' : '#fff'} />)}</Pie><Tooltip {...tip} /><Legend formatter={(v) => String(v).toLowerCase()} /></PieChart></ResponsiveContainer></div>}</div>

        <div className="card"><h2 className="mb-3 font-display text-2xl">Complaint resolution</h2>
          <div className="h-60"><ResponsiveContainer><BarChart data={s.complaintsByStatus.map((x) => ({ ...x, label: STATUS_LABEL[x.status] }))} layout="vertical" margin={{ left: 20 }}><CartesianGrid stroke="#E8DFD9" horizontal={false} /><XAxis type="number" allowDecimals={false} fontSize={12} /><YAxis type="category" dataKey="label" fontSize={12} width={90} /><Tooltip {...tip} cursor={{ fill: '#D99B7F33' }} /><Bar dataKey="count" fill="#A56F63" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></div></div>

        <div className="card lg:col-span-2"><h2 className="mb-3 font-display text-2xl">Course distribution</h2>
          <div className="h-52"><ResponsiveContainer><BarChart data={s.studentsByDepartment} margin={{ left: -20 }}><CartesianGrid stroke="#E8DFD9" vertical={false} /><XAxis dataKey="code" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip {...tip} cursor={{ fill: '#D99B7F33' }} /><Bar dataKey="courses" fill="#D99B7F" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-2xl">{cat ? `${cat[0] + cat.slice(1).toLowerCase()} complaints` : 'Recent complaints'}</h2>{cat && <button className="btn-ghost !py-1.5" onClick={() => setCat('')}>Clear filter</button>}</div>
        {list.isLoading ? <Skeleton className="h-24" /> : !list.data?.length ? <EmptyState text="No complaints yet." /> : <ul className="divide-y divide-line">{list.data.slice(0, 6).map((c) => <li key={c.id}><Link to={`/campus/complaints/${c.id}`} className="flex justify-between gap-3 py-3 text-sm hover:text-clay"><span className="font-medium">#{c.ticketNo} {c.title}</span><span className="text-clay">{STATUS_LABEL[c.status]}</span></Link></li>)}</ul>}
      </section>
    </div>
  );
}
