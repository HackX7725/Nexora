'use client';

import { Menu, MenuContent, MenuItem, MenuRadioGroup, MenuRadioItem, MenuTrigger, useToast } from '@platform/ui';
import { Archive, MessageSquareText, Phone, Settings, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ComponentType } from 'react';
import { logout } from '../lib/api';
import { navigation, type NavIcon } from '../lib/navigation';
import { unreadTotal, useChat } from '../stores/chat-store';
import { useSession } from '../stores/session-store';
import { useShell, type ThemeChoice } from '../stores/shell-store';
import { Mark } from './mark';

const icons: Record<NavIcon, ComponentType<{ className?: string }>> = {
  chats: MessageSquareText,
  calls: Phone,
  updates: Sparkles,
  contacts: Users,
  archived: Archive,
  settings: Settings,
};

const themes: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match system' },
];

export function NavRail() {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useShell((state) => state.theme);
  const setTheme = useShell((state) => state.setTheme);
  const username = useSession((state) => state.session?.user.username);
  const waiting = useChat((state) => unreadTotal(state.unread));
  const toast = useToast();
  const chooseTheme = (value: ThemeChoice) => {
    setTheme(value);
    toast({ title: 'Appearance updated', description: themes.find((item) => item.value === value)?.label });
  };
  const signOut = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <>
      <aside className="hidden h-full w-16 shrink-0 flex-col items-center border-r border-line bg-rail py-4 md:flex">
        <Link href="/chats" className="mb-6 text-primary" aria-label="Nexora home">
          <Mark className="h-9 w-9" />
        </Link>
        <nav aria-label="Primary" className="grid gap-2">
          {navigation.map((item) => {
            const Icon = icons[item.icon];
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                title={item.href === '/chats' && waiting ? `${item.label}, ${waiting} unread` : item.label}
                className={`relative grid h-10 w-10 place-items-center rounded-xl ${active ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-primary/10 hover:text-ink'}`}
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{item.label}</span>
                {item.href === '/chats' ? <UnreadCount count={waiting} /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <AccountMenu theme={theme} setTheme={chooseTheme} username={username} onSignOut={signOut} />
        </div>
      </aside>
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-rail px-2 py-2 md:hidden">
        {navigation.map((item) => {
          const Icon = icons[item.icon];
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`relative grid min-w-0 flex-1 place-items-center gap-1 rounded-xl py-1 text-[10px] ${active ? 'text-primary' : 'text-muted'}`}
            >
              <Icon className="h-5 w-5" />
              {item.href === '/chats' ? <UnreadCount count={waiting} /> : null}
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function UnreadCount({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute right-1 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}

function AccountMenu({
  theme,
  setTheme,
  username,
  onSignOut,
}: {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
  username?: string;
  onSignOut: () => void;
}) {
  const letter = (username || 'N').slice(0, 1).toUpperCase();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary" aria-label="Account">
          {letter}
        </button>
      </MenuTrigger>
      <MenuContent>
        {username ? <p className="px-3 py-2 text-sm font-medium">{username}</p> : null}
        <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted">Appearance</p>
        <MenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemeChoice)}>
          {themes.map((item) => (
            <MenuRadioItem key={item.value} value={item.value}>{item.label}</MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuItem onSelect={onSignOut}>Sign out</MenuItem>
      </MenuContent>
    </Menu>
  );
}
