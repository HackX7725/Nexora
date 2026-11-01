'use client';

import { useToast } from '@platform/ui';
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { refreshAccess } from '../lib/api';
import { announceMessage } from '../lib/message-alert';
import { previewText } from '../lib/message-body';
import { connectRealtime, disconnectRealtime } from '../lib/realtime';
import { useCall } from '../stores/call-store';
import { useChat, type ChatMessage } from '../stores/chat-store';
import { useSession } from '../stores/session-store';
import { resolveDark, useShell } from '../stores/shell-store';
import { CallBanner } from './call-banner';
import { NavRail } from './nav-rail';

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const theme = useShell((state) => state.theme);
  const hydrate = useShell((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const apply = () => document.documentElement.classList.toggle('dark', resolveDark(theme));
    apply();
    if (theme !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const search = document.getElementById('conversation-search');
        if (search) {
          search.focus();
          return;
        }
        sessionStorage.setItem('nexora-focus-search', '1');
        router.push('/chats');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const accessToken = useSession((state) => state.session?.accessToken);
  const toast = useToast();

  useEffect(() => {
    if (!accessToken) return undefined;
    const socket = connectRealtime(accessToken);
    const unbindCall = useCall.getState().bind(socket);
    let refreshing = false;
    const onConnectError = (error: Error) => {
      if (refreshing || !/sign in required/i.test(error.message || '')) return;
      refreshing = true;
      void refreshAccess();
    };
    const onMessage = (message: ChatMessage) => {
      if (!useChat.getState().receive(message)) return;
      const title = message.senderName || 'New message';
      const description = previewText(message.ciphertext);
      toast({ title, description });
      void announceMessage(title, description);
    };
    socket.on('connect_error', onConnectError);
    socket.on('message:new', onMessage);
    void useChat.getState().load().catch(() => undefined);
    return () => {
      socket.off('connect_error', onConnectError);
      socket.off('message:new', onMessage);
      unbindCall();
      disconnectRealtime();
    };
  }, [accessToken, toast]);

  return (
    <div className="flex h-dvh bg-canvas text-ink">
      <a href="#workspace" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-3 focus:py-2">
        Skip to workspace
      </a>
      <NavRail />
      <div id="workspace" className="flex min-w-0 flex-1 pb-16 md:pb-0">
        <CallBanner />
        {children}
      </div>
    </div>
  );
}
