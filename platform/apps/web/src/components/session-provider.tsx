'use client';

import { useEffect, type ReactNode } from 'react';
import { useSession } from '../stores/session-store';

export function SessionProvider({ children }: { children: ReactNode }) {
  const hydrate = useSession((state) => state.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return children;
}
