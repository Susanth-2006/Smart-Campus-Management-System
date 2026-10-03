import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, HelpCircle, LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useClickOutside } from '../hooks/useClickOutside';
import { ROLE_LABEL } from '../utils/navConfig';

export function ProfileDropdown() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  if (!user) return null;
  const first = user.name.replace(/^Dr\.\s*/, '').split(' ')[0];
  const items = [
    { icon: User, label: 'My Profile', to: '/profile' },
    { icon: Settings, label: 'Settings', to: '/settings' },
    { icon: HelpCircle, label: 'Help', to: '/services/help-desk' },
  ];
  return (
    <div ref={ref} className="relative">
      <button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-white/10">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-peach text-sm font-bold text-navy">{first[0]}</span>
        <span className="hidden text-sm font-medium text-white lg:block">{first}</span>
        <ChevronDown size={14} className="text-white/70" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-line bg-white p-2 shadow-soft">
            <div className="border-b border-line px-3 pb-2 pt-1">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-slate">{ROLE_LABEL[user.role]} · {user.email}</p>
            </div>
            {items.map(({ icon: Icon, label, to }) => (
              <Link key={to} to={to} role="menuitem" onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-peach/20"><Icon size={16} />{label}</Link>
            ))}
            <button role="menuitem" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-clay hover:bg-peach/20"><LogOut size={16} />Logout</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
