import { Link } from 'react-router-dom';
import { Clock, DoorOpen, UserRound } from 'lucide-react';
import { TimetableEntry } from '../types';
import { DAYS, fmtTime } from '../utils/format';
import { Modal } from './ui';
import { useAuth } from '../hooks/useAuth';

export function ClassModal({ entry, onClose }: { entry: TimetableEntry | null; onClose: () => void }) {
  const { user } = useAuth();
  const base = user?.role === 'FACULTY' ? '/teaching/courses' : user?.role === 'ADMIN' ? '/management/courses' : '/academics/courses';
  return (
    <Modal open={!!entry} onClose={onClose} title={entry?.course.name ?? ''}>
      {entry && (
        <div className="space-y-3 text-sm">
          <span className="inline-block rounded-full bg-peach/30 px-3 py-1 text-xs font-semibold text-clay">{entry.course.code}</span>
          <p className="flex items-center gap-2"><UserRound size={16} className="text-clay" />{entry.course.faculty.user.name}</p>
          <p className="flex items-center gap-2"><Clock size={16} className="text-clay" />{DAYS[entry.dayOfWeek]}, {fmtTime(entry.startTime)} – {fmtTime(entry.endTime)}</p>
          <p className="flex items-center gap-2"><DoorOpen size={16} className="text-clay" />Room {entry.room}</p>
          <Link to={`${base}/${entry.course.id}`} onClick={onClose} className="btn-primary mt-2 w-full">View Course</Link>
        </div>
      )}
    </Modal>
  );
}
