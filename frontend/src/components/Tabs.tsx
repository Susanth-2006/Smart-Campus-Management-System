import { motion } from 'framer-motion';

export function Tabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (t: string) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={value === t} onClick={() => onChange(t)} className={`relative whitespace-nowrap px-4 py-3 text-sm font-semibold ${value === t ? 'text-navy' : 'text-slate hover:text-navy'}`}>
          {t}
          {value === t && <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-clay" />}
        </button>
      ))}
    </div>
  );
}
