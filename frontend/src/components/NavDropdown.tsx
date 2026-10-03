import { useCallback, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { NavItem } from '../utils/navConfig';
import { useClickOutside } from '../hooks/useClickOutside';

export function NavDropdown({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  const { pathname } = useLocation();
  const active = item.children?.some((c) => pathname.startsWith(c.to.split('?')[0]));

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={close}>
      <button
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-white/10 ${active ? 'bg-white/10 text-peach' : 'text-white/90'}`}
      >
        {item.label}
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu" initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }} className="absolute left-0 top-full z-50 pt-2"
          >
            <div className="w-72 rounded-2xl border border-line bg-white p-2 shadow-soft">
              {item.children!.map((c) => (
                <NavLink key={c.to} to={c.to} role="menuitem" onClick={close}
                  className="block rounded-xl px-3 py-2.5 hover:bg-peach/20">
                  <span className="block text-sm font-semibold text-navy">{c.label}</span>
                  {c.desc && <span className="block text-xs text-slate">{c.desc}</span>}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
