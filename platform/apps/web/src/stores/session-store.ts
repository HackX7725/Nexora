'use client';

import { create } from 'zustand';
import type { Session } from '../lib/session';

const SESSION_KEY = 'nexora-session';
const DEVICE_KEY = 'nexora-device';

interface SessionState {
  status: 'unknown' | 'anonymous' | 'authenticated';
  session: Session | null;
  hydrate: () => void;
  setSession: (session: Session) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
  deviceId: () => string | undefined;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'unknown',
  session: null,
  hydrate() {
    if (get().status !== 'unknown') return;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        set({ status: 'anonymous', session: null });
        return;
      }
      const session = JSON.parse(raw) as Session;
      if (!session.accessToken || !session.refreshToken || !session.deviceId || !session.user?.username) {
        localStorage.removeItem(SESSION_KEY);
        set({ status: 'anonymous', session: null });
        return;
      }
      localStorage.setItem(DEVICE_KEY, session.deviceId);
      set({ status: 'authenticated', session });
    } catch {
      localStorage.removeItem(SESSION_KEY);
      set({ status: 'anonymous', session: null });
    }
  },
  setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(DEVICE_KEY, session.deviceId);
    set({ status: 'authenticated', session });
  },
  updateTokens(accessToken, refreshToken) {
    const current = get().session;
    if (!current) return;
    const session = { ...current, accessToken, refreshToken };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    set({ session });
  },
  clear() {
    const deviceId = get().session?.deviceId || localStorage.getItem(DEVICE_KEY) || '';
    if (deviceId) localStorage.setItem(DEVICE_KEY, deviceId);
    localStorage.removeItem(SESSION_KEY);
    set({ status: 'anonymous', session: null });
  },
  deviceId() {
    return get().session?.deviceId || localStorage.getItem(DEVICE_KEY) || undefined;
  },
}));
