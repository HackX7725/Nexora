'use client';

import { Button, EmptyState, Modal, ModalClose } from '@platform/ui';
import { Search, SquarePen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DirectoryPicker } from './directory-picker';
import { previewText } from '../lib/message-body';
import { conversationTitle, useChat, type Conversation } from '../stores/chat-store';
import { useSession } from '../stores/session-store';

const filters = ['All', 'Unread', 'Favorites', 'Groups'] as const;
type Filter = (typeof filters)[number];

const emptyCopy: Record<Filter, string> = {
  All: 'When a conversation starts, it stays in this list.',
  Unread: 'Nothing is waiting for you.',
  Favorites: 'Pin a conversation later and it will show up here.',
  Groups: 'Groups you join will be listed here.',
};

export function ChatSidebar() {
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const myId = useSession((state) => state.session?.user.id || '');
  const conversations = useChat((state) => state.conversations);
  const unread = useChat((state) => state.unread);
  const pins = useChat((state) => state.pins);
  const activeId = useChat((state) => state.activeId);
  const select = useChat((state) => state.select);
  const openDirect = useChat((state) => state.openDirect);
  const load = useChat((state) => state.load);
  const loadPins = useChat((state) => state.loadPins);
  useEffect(() => {
    loadPins();
    void load().catch(() => undefined);
  }, [load, loadPins]);
  useEffect(() => {
    if (sessionStorage.getItem('nexora-focus-search') !== '1') return;
    sessionStorage.removeItem('nexora-focus-search');
    document.getElementById('conversation-search')?.focus();
  }, []);
  const trimmed = query.trim().toLowerCase();
  const visible = useMemo(() => conversations.filter((conversation) => {
    const title = conversationTitle(conversation, myId).toLowerCase();
    const matchesQuery = !trimmed || title.includes(trimmed) || conversation.members.some((member) => member.username.includes(trimmed));
    if (!matchesQuery) return false;
    if (filter === 'Groups') return conversation.type === 'GROUP';
    if (filter === 'Favorites') return pins.includes(conversation.id);
    if (filter === 'Unread') return (unread[conversation.id] || 0) > 0;
    return true;
  }), [conversations, filter, myId, pins, trimmed, unread]);
  const description = trimmed ? `No conversations match “${query.trim()}”.` : emptyCopy[filter];

  return (
    <section className="flex w-full shrink-0 flex-col border-b border-line bg-sidebar max-md:max-h-[48%] md:w-[340px] md:border-b-0 md:border-r">
      <header className="flex items-center gap-3 px-4 pb-2 pt-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Chats</h1>
          <p className="text-sm text-muted">Nexora</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="New conversation" onClick={() => setOpen(true)}>
          <SquarePen className="h-5 w-5" />
        </Button>
      </header>
      <div className="px-4 pb-3">
        <label className="relative block">
          <span className="sr-only">Search conversations</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id="conversation-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            className="h-11 w-full rounded-xl border border-line bg-canvas pl-10 pr-3 text-sm outline-none focus-visible:border-primary"
          />
        </label>
      </div>
      <div role="tablist" aria-label="Conversation filters" className="flex gap-2 overflow-x-auto px-4 pb-3">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={filter === item}
            onClick={() => setFilter(item)}
            className={`h-8 shrink-0 rounded-full px-3 text-sm ${filter === item ? 'bg-primary text-white' : 'bg-canvas text-muted'}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {visible.length ? (
          <ul className="grid gap-1 px-2 pb-4">
            {visible.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeId}
                myId={myId}
                onSelect={() => void select(conversation.id)}
              />
            ))}
          </ul>
        ) : (
          <div className="flex h-full items-center">
            <EmptyState title={trimmed ? 'No matches' : 'No conversations yet'} description={description} />
          </div>
        )}
      </div>
      <Modal open={open} onOpenChange={setOpen} title="New conversation" description="Choose someone from the directory. This opens a direct chat.">
        <DirectoryPicker
          action="Message"
          onPick={async (person) => {
            await openDirect(person.id);
            setOpen(false);
          }}
        />
        <ModalClose asChild>
          <Button type="button" variant="secondary" className="mt-4">Close</Button>
        </ModalClose>
      </Modal>
    </section>
  );
}

function ConversationRow({
  conversation,
  active,
  myId,
  onSelect,
}: {
  conversation: Conversation;
  active: boolean;
  myId: string;
  onSelect: () => void;
}) {
  const title = conversationTitle(conversation, myId);
  const unread = useChat((state) => state.unread[conversation.id] || 0);
  const preview = conversation.preview ? previewText(conversation.preview) : (conversation.type === 'GROUP' ? 'Group' : 'Direct chat');
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${active ? 'bg-primary/10' : 'hover:bg-canvas'}`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {title.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${unread ? 'font-semibold' : 'font-medium'}`}>{title}</span>
          <span className={`block truncate text-sm ${unread ? 'text-ink' : 'text-muted'}`}>{preview}</span>
        </span>
        {unread ? (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
    </li>
  );
}
