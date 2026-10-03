import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { NAV } from '../utils/navConfig';

export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div role="dialog" aria-modal="true" aria-label="Navigation menu" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] overflow-y-auto bg-navy text-white">
          <div className="flex h-16 items-center justify-between px-4">
            <span className="font-display text-xl">Smart Campus</span>
            <button aria-label="Close menu" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10"><X size={24} /></button>
          </div>
          <nav className="space-y-6 px-4 pb-10 pt-2">
            {NAV[user.role].map((item) => (
              <div key={item.label}>
                {item.to ? (
                  <NavLink to={item.to} onClick={onClose} className="block rounded-xl py-3 text-xl font-semibold">{item.label}</NavLink>
                ) : (
                  <>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-peach">{item.label}</p>
                    {item.children!.map((c) => (
                      <NavLink key={c.to} to={c.to} onClick={onClose} className="block rounded-xl py-3 text-lg text-white/90 active:bg-white/10">{c.label}</NavLink>
                    ))}
                  </>
                )}
              </div>
            ))}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-peach">Account</p>
              <NavLink to="/profile" onClick={onClose} className="block py-3 text-lg">My Profile</NavLink>
              <NavLink to="/settings" onClick={onClose} className="block py-3 text-lg">Settings</NavLink>
              <button onClick={() => { onClose(); logout(); }} className="flex items-center gap-2 py-3 text-lg text-peach"><LogOut size={18} />Logout</button>
            </div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
