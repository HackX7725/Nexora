'use client';

import { Button, useToast } from '@platform/ui';
import { useRouter } from 'next/navigation';
import { logout } from '../../../src/lib/api';
import { useSession } from '../../../src/stores/session-store';
import { useShell, type ThemeChoice } from '../../../src/stores/shell-store';

const choices: { value: ThemeChoice; label: string; detail: string }[] = [
  { value: 'light', label: 'Light', detail: 'Soft paper background' },
  { value: 'dark', label: 'Dark', detail: 'Deep green night background' },
  { value: 'system', label: 'Match system', detail: 'Follow this device' },
];

export default function SettingsPage() {
  const router = useRouter();
  const theme = useShell((state) => state.theme);
  const setTheme = useShell((state) => state.setTheme);
  const username = useSession((state) => state.session?.user.username);
  const toast = useToast();

  return (
    <section className="min-w-0 flex-1 overflow-auto bg-canvas">
      <header className="border-b border-line bg-surface px-6 py-5">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Signed in as {username || 'your account'}. Appearance stays in this browser.</p>
      </header>
      <div className="mx-auto grid max-w-2xl gap-8 px-6 py-8">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Account</h2>
          <p className="mt-3 font-medium">{username}</p>
          <Button
            className="mt-4"
            variant="secondary"
            type="button"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            Sign out
          </Button>
        </section>
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Theme</h2>
          <div className="mt-3 grid gap-3">
            {choices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                aria-pressed={theme === choice.value}
                onClick={() => {
                  setTheme(choice.value);
                  toast({ title: 'Appearance updated', description: choice.label });
                }}
                className={`flex items-center justify-between rounded-2xl border px-4 py-4 text-left ${theme === choice.value ? 'border-primary bg-primary/10' : 'border-line bg-surface'}`}
              >
                <span>
                  <span className="block font-medium">{choice.label}</span>
                  <span className="mt-1 block text-sm text-muted">{choice.detail}</span>
                </span>
                <span className={`h-3 w-3 rounded-full ${theme === choice.value ? 'bg-primary' : 'bg-line'}`} />
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-medium">Keyboard</h2>
          <p className="mt-2 text-sm text-muted">
            <kbd className="rounded-md border border-line px-1.5 py-0.5">Ctrl</kbd>
            {' '}or{' '}
            <kbd className="rounded-md border border-line px-1.5 py-0.5">⌘</kbd>
            {' '}+{' '}
            <kbd className="rounded-md border border-line px-1.5 py-0.5">K</kbd>
            {' '}focuses conversation search.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            type="button"
            onClick={() => {
              sessionStorage.setItem('nexora-focus-search', '1');
              router.push('/chats');
            }}
          >
            Open search
          </Button>
        </section>
      </div>
    </section>
  );
}
