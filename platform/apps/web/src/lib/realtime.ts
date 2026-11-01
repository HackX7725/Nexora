'use client';

import { io, type Socket } from 'socket.io-client';

interface ReadySocket extends Socket {
  authed?: boolean;
}

const baseUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let socket: ReadySocket | null = null;

export function getSocket() {
  return socket;
}

export function connectRealtime(token: string) {
  if (socket?.connected && socket.authed) return socket;
  socket?.removeAllListeners();
  socket?.disconnect();
  const next = io(baseUrl(), { auth: { token } }) as ReadySocket;
  next.on('ready', () => {
    next.authed = true;
  });
  next.on('disconnect', () => {
    next.authed = false;
  });
  socket = next;
  return socket;
}

export function whenReady(timeoutMs = 8000) {
  const current = socket;
  if (!current) return Promise.reject(new Error('The server did not respond. Try again.'));
  if (current.authed) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      current.off('ready', onReady);
      reject(new Error('The server did not respond. Try again.'));
    }, timeoutMs);
    const onReady = () => {
      window.clearTimeout(timer);
      resolve();
    };
    current.once('ready', onReady);
  });
}

export function disconnectRealtime() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
