'use client';

import { create } from 'zustand';
import { api } from '../lib/api';
import { ApiError } from '../lib/session';
import { useSession } from './session-store';

export interface ConversationMember {
  userId: string;
  role: string;
  username: string;
  displayName: string;
}

export interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  updatedAt: string;
  preview?: string;
  previewSequence?: number;
  previewSenderId?: string | null;
  members: ConversationMember[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName?: string;
  ciphertext: string;
  sequenceNumber: number;
  createdAt: string;
}

interface ChatState {
  conversations: Conversation[];
  unread: Record<string, number>;
  activeId: string | null;
  messages: ChatMessage[];
  error: string;
  pins: string[];
  load: () => Promise<void>;
  loadPins: () => void;
  togglePin: (id: string) => void;
  openDirect: (userId: string) => Promise<Conversation>;
  select: (id: string) => Promise<void>;
  send: (text: string) => Promise<void>;
  sendPayload: (ciphertext: string) => Promise<void>;
  receive: (message: ChatMessage) => boolean;
}

const seenKey = 'nexora-last-seen';
const readyKey = 'nexora-seen-ready';
const pinKey = 'nexora-pins';
const delivered = new Set<string>();

function seenStore() {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

function readSeen() {
  const store = seenStore();
  if (!store) return {} as Record<string, number>;
  try {
    const parsed = JSON.parse(store.getItem(seenKey) || '{}') as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSeen(seen: Record<string, number>) {
  seenStore()?.setItem(seenKey, JSON.stringify(seen));
}

function rememberSeen(conversationId: string, sequence: number) {
  const seen = readSeen();
  seen[conversationId] = Math.max(seen[conversationId] || 0, sequence);
  writeSeen(seen);
}

function reconcile(conversations: Conversation[], myId: string, current: Record<string, number>) {
  const store = seenStore();
  const seen = readSeen();
  const ready = store?.getItem(readyKey) === '1';
  const activeId = useChat.getState().activeId;
  const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
  const unread: Record<string, number> = {};
  if (!ready) {
    for (const conversation of conversations) {
      if (visible && conversation.id === activeId) {
        seen[conversation.id] = conversation.previewSequence || 0;
        continue;
      }
      if ((current[conversation.id] || 0) > 0) {
        unread[conversation.id] = current[conversation.id];
        continue;
      }
      seen[conversation.id] = conversation.previewSequence || 0;
    }
    writeSeen(seen);
    store?.setItem(readyKey, '1');
    return unread;
  }
  for (const conversation of conversations) {
    const sequence = conversation.previewSequence || 0;
    if (visible && conversation.id === activeId) {
      seen[conversation.id] = Math.max(seen[conversation.id] || 0, sequence);
      continue;
    }
    const last = seen[conversation.id];
    if (last === undefined) {
      if (conversation.previewSenderId && conversation.previewSenderId !== myId && sequence > 0) {
        unread[conversation.id] = Math.max(current[conversation.id] || 0, 1);
      } else {
        seen[conversation.id] = sequence;
      }
      continue;
    }
    if (sequence > last && conversation.previewSenderId !== myId) {
      unread[conversation.id] = Math.max(current[conversation.id] || 0, sequence - last);
    }
  }
  writeSeen(seen);
  return unread;
}

function promote(conversations: Conversation[], message: ChatMessage) {
  const current = conversations.find((item) => item.id === message.conversationId);
  if (!current) return conversations;
  const next: Conversation = {
    ...current,
    preview: message.ciphertext,
    previewSequence: message.sequenceNumber,
    previewSenderId: message.senderUserId,
    updatedAt: message.createdAt,
  };
  return [next, ...conversations.filter((item) => item.id !== message.conversationId)];
}

function applyIncoming(message: ChatMessage, markRead: boolean) {
  const conversations = promote(useChat.getState().conversations, message);
  const unread = { ...useChat.getState().unread };
  if (markRead) {
    rememberSeen(message.conversationId, message.sequenceNumber);
    delete unread[message.conversationId];
  } else {
    const last = readSeen()[message.conversationId] ?? 0;
    if (message.sequenceNumber > last) {
      unread[message.conversationId] = Math.max(unread[message.conversationId] || 0, message.sequenceNumber - last);
    }
  }
  useChat.setState({ conversations, unread });
}

export const useChat = create<ChatState>((set, get) => ({
  conversations: [],
  unread: {},
  pins: [],
  activeId: null,
  messages: [],
  error: '',
  loadPins() {
    if (typeof window === 'undefined') return;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(pinKey) || '[]') as unknown;
      const pins = Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
      set({ pins });
    } catch {
      set({ pins: [] });
    }
  },
  togglePin(id) {
    const current = get().pins.includes(id) ? get().pins.filter((item) => item !== id) : [...get().pins, id];
    window.localStorage.setItem(pinKey, JSON.stringify(current));
    set({ pins: current });
  },
  async load() {
    const data = await api<{ conversations: Conversation[] }>('/api/v1/conversations');
    const myId = useSession.getState().session?.user.id || '';
    set({
      conversations: data.conversations,
      unread: reconcile(data.conversations, myId, get().unread),
    });
  },
  async openDirect(userId) {
    const conversation = await api<Conversation>('/api/v1/conversations', {
      method: 'POST',
      body: JSON.stringify({ type: 'DIRECT', participantId: userId }),
    });
    await get().load();
    await get().select(conversation.id);
    return conversation;
  },
  async select(id) {
    set({ activeId: id, error: '' });
    const data = await api<{ messages: ChatMessage[] }>(`/api/v1/conversations/${id}/messages?after=0&limit=100`);
    if (get().activeId !== id) return;
    const latest = data.messages.reduce(
      (max, item) => Math.max(max, item.sequenceNumber),
      get().conversations.find((item) => item.id === id)?.previewSequence || 0,
    );
    rememberSeen(id, latest);
    const unread = { ...get().unread };
    delete unread[id];
    set({ messages: data.messages, unread });
  },
  async send(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    await get().sendPayload(trimmed);
  },
  async sendPayload(ciphertext) {
    const conversationId = get().activeId;
    const deviceId = useSession.getState().session?.deviceId;
    if (!conversationId || !ciphertext) return;
    if (!deviceId) {
      const message = 'This browser is not registered for messages.';
      set({ error: message });
      throw new ApiError(0, message);
    }
    const clientMessageId = crypto.randomUUID();
    set({ error: '' });
    const message = await api<ChatMessage>(`/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Idempotency-Key': clientMessageId },
      body: JSON.stringify({
        clientMessageId,
        senderDeviceId: deviceId,
        ciphertext,
        encryptionHeader: { algorithm: 'none', keyVersion: 1 },
      }),
    });
    get().receive(message);
  },
  receive(message) {
    if (delivered.has(message.id)) return false;
    delivered.add(message.id);
    const myId = useSession.getState().session?.user.id || '';
    const mine = message.senderUserId === myId;
    const open = get().activeId === message.conversationId;
    const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
    const markRead = mine || (open && visible);
    const lastSeen = readSeen()[message.conversationId];
    const alreadySeen = lastSeen !== undefined && message.sequenceNumber <= lastSeen;
    if (open && !get().messages.some((item) => item.id === message.id)) {
      set({
        messages: [...get().messages, message].sort((left, right) => left.sequenceNumber - right.sequenceNumber),
      });
    }
    const known = get().conversations.some((item) => item.id === message.conversationId);
    if (!known && !markRead) {
      set({
        unread: {
          ...get().unread,
          [message.conversationId]: Math.max(get().unread[message.conversationId] || 0, 1),
        },
      });
    }
    const finish = () => applyIncoming(message, markRead);
    if (!known) void get().load().then(finish).catch(() => undefined);
    else finish();
    return !mine && !markRead && !alreadySeen;
  },
}));

export function conversationTitle(conversation: Conversation | undefined, myId: string) {
  if (!conversation) return 'No conversation selected';
  if (conversation.type === 'GROUP') return conversation.title || 'Group';
  return conversation.members.find((member) => member.userId !== myId)?.displayName || 'Conversation';
}

export function otherMember(conversation: Conversation | undefined, myId: string) {
  return conversation?.members.find((member) => member.userId !== myId);
}

export function unreadTotal(unread: Record<string, number>) {
  return Object.values(unread).reduce((sum, count) => sum + count, 0);
}
