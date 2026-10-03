import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { NAV } from '../utils/navConfig';
import { NavDropdown } from './NavDropdown';
import { NotificationDropdown } from './NotificationDropdown';
import { ProfileDropdown } from './ProfileDropdown';
import { MobileMenu } from './MobileMenu';

export function Navbar({ onSearch }: { onSearch: () => void }) {
  const { user } = useAuth();
  const [menu, setMenu] = useState(false);
  if (!user) return null;
  return (
    <header className="sticky top-0 z-40 bg-navy shadow-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link to="/dashboard" className="flex items-center gap-2 text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-peach font-display text-lg text-navy">S</span>
          <span className="font-display text-xl">Smart Campus</span>
        </Link>

        <nav aria-label="Primary" className="ml-6 hidden items-center gap-1 md:flex">
          {NAV[user.role].map((item) =>
            item.children ? <NavDropdown key={item.label} item={item} /> : (
              <NavLink key={item.label} to={item.to!} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-white/10 ${isActive ? 'bg-white/10 text-peach' : 'text-white/90'}`}>{item.label}</NavLink>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={onSearch} aria-label="Search (Ctrl+K)" className="hidden items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/15 lg:flex">
            <Search size={16} /> Search <kbd className="rounded bg-white/10 px-1.5 text-xs">Ctrl K</kbd>
          </button>
          <button onClick={onSearch} aria-label="Search" className="rounded-lg p-2 text-white/90 hover:bg-white/10 lg:hidden"><Search size={20} /></button>
          <NotificationDropdown />
          <div className="hidden md:block"><ProfileDropdown /></div>
          <button aria-label="Open menu" onClick={() => setMenu(true)} className="rounded-lg p-2 text-white md:hidden hover:bg-white/10"><Menu size={22} /></button>
        </div>
      </div>
      <MobileMenu open={menu} onClose={() => setMenu(false)} />
    </header>
  );
}
