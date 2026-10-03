import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';

type Push = (message: string, kind?: 'ok' | 'err') => void;
const Ctx = createContext<Push>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; message: string; kind: 'ok' | 'err' }[]>([]);
  const push = useCallback<Push>((message, kind = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, message, kind }]);
    setTimeout(() => setItems((l) => l.filter((i) => i.id !== id)), 3800);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[90] space-y-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-soft ${t.kind === 'ok' ? 'bg-navy' : 'bg-clay'}`}>
              {t.kind === 'ok' ? <CheckCircle2 size={18} className="text-peach" /> : <XCircle size={18} />}{t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
