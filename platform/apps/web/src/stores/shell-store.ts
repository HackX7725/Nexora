'use client';

import { create } from 'zustand';

export type ThemeChoice = 'light' | 'dark' | 'system';

interface ShellState {
  theme: ThemeChoice;
  infoOpen: boolean;
  infoDialog: boolean;
  setTheme: (theme: ThemeChoice) => void;
  toggleInfo: () => void;
  closeInfoDialog: () => void;
  hydrate: () => void;
}

const STORAGE_KEY = 'nexora-shell';

interface SavedShell {
  theme?: ThemeChoice;
  infoOpen?: boolean;
}

export const useShell = create<ShellState>((set, get) => ({
  theme: 'system',
  infoOpen: true,
  infoDialog: false,
  hydrate() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as SavedShell;
      set({
        theme: saved.theme || 'system',
        infoOpen: saved.infoOpen !== false,
      });
    } catch {
      set({ theme: 'system', infoOpen: true });
    }
  },
  setTheme(theme) {
    set({ theme });
    save(get());
  },
  toggleInfo() {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      set({ infoOpen: !get().infoOpen });
      save(get());
      return;
    }
    set({ infoDialog: true });
  },
  closeInfoDialog() {
    set({ infoDialog: false });
  },
}));

function save(state: ShellState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: state.theme, infoOpen: state.infoOpen }));
}

export function resolveDark(theme: ThemeChoice) {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
