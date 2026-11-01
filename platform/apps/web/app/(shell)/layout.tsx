'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '../../src/components/shell';
import { useSession } from '../../src/stores/session-store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const status = useSession((state) => state.status);
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [router, status]);

  if (status !== 'authenticated') {
    return <p className="grid min-h-dvh place-items-center bg-canvas text-sm text-muted">Checking your session…</p>;
  }

  return <Shell>{children}</Shell>;
}
