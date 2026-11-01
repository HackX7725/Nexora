'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ToastInput {
  title: string;
  description?: string;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<(input: ToastInput) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { ...input, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-6 right-6 z-50 grid max-w-sm gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} role="status" className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-[var(--nx-shadow)]">
            <p className="text-sm font-semibold text-ink">{toast.title}</p>
            {toast.description ? <p className="mt-1 text-sm text-muted">{toast.description}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
