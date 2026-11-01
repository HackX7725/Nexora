import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AgoraChat from 'agora-chat';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import '../whatsapp.css';

const EMOJIS = ['😀', '😂', '😍', '👍', '🙏', '🔥', '❤️', '🎉', '😢', '👏'];

function initial(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

function clock(value) {
  const date = new Date(value || Date.now());
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(value) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function listTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (date.toDateString() === new Date().toDateString()) return clock(value);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function rowsOf(result, key) {
  const data = result?.data || result || {};
  return data[key] || result?.[key] || [];
}

function previewOf(message) {
  if (!message) return '';
  if (message.type === 'img') return 'Photo';
  if (message.type === 'file') return message.filename || 'Document';
  if (message.type === 'audio') return 'Voice message';
  return message.text || '';
}

function rawText(message) {
  if (typeof message.msg === 'string') return message.msg;
  if (typeof message.body?.msg === 'string') return message.body.msg;
  if (typeof message.msg?.msg === 'string') return message.msg.msg;
  return '';
}

function normalize(message, selfId) {
  const type = message.type || message.body?.type || 'txt';
  if (['cmd', 'read', 'delivery', 'channel'].includes(type)) return null;
  const file = message.file || message.body || {};
  const filename = message.filename || file.filename || '';
  const fileUrl = message.url || file.url || '';
  let text = rawText(message);
  if (type === 'img') text = text || 'Photo';
  if (type === 'file') text = filename || 'Document';
  if (type === 'audio') text = 'Voice message';
  if (!text && !fileUrl && type === 'txt') return null;
  const from = message.from || selfId;
  return {
    id: message.id,
    from,
    type,
    text,
    filename,
    fileUrl,
    time: message.time || Date.now(),
    status: from === selfId ? 'sent' : 'in',
    reply: message.ext?.reply || null,
  };
}

function connectChat(chat) {
  return new AgoraChat.connection({
    ...(chat.appKey ? { appKey: chat.appKey } : { appId: chat.appId }),
    isHttpDNS: false,
    url: chat.url,
    apiUrl: chat.apiUrl,
    delivery: true,
  });
}

export default function WhatsApp() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [people, setPeople] = useState([]);
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [picker, setPicker] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [groupIds, setGroupIds] = useState([]);
  const [online, setOnline] = useState({});
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const connRef = useRef(null);
  const selfRef = useRef('');
  const activeRef = useRef('');
  const scroller = useRef(null);
  const photoRef = useRef(null);
  const fileRef = useRef(null);
  const recorder = useRef(null);
  const recordChunks = useRef([]);

  const names = useMemo(() => {
    const map = new Map(people.map((person) => [person.id, person.name]));
    if (user) map.set(user.id, user.name);
    return map;
  }, [people, user]);
  const namesRef = useRef(names);
  namesRef.current = names;

  const active = threads.find((thread) => thread.id === activeId) || null;
  const visible = threads.filter((thread) => {
    const haystack = `${thread.title} ${thread.preview}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  function patchThread(id, recipe) {
    setThreads((current) => current.map((thread) => (thread.id === id ? { ...thread, ...recipe(thread) } : thread)));
  }

  function upsertMessage(threadId, message) {
    setThreads((current) => {
      const existing = current.find((thread) => thread.id === threadId);
      const nextMessage = { ...message };
      const base = existing || {
        id: threadId,
        chatType: 'singleChat',
        title: namesRef.current.get(threadId) || 'Chat',
        messages: [],
        unread: 0,
        preview: '',
        time: 0,
        pinned: false,
        loaded: true,
        typing: false,
      };
      const messages = base.messages.some((item) => item.id === nextMessage.id)
        ? base.messages
        : [...base.messages, nextMessage];
      const unread = threadId === activeRef.current || nextMessage.from === selfRef.current
        ? 0
        : (existing?.unread || 0) + (existing?.messages.some((item) => item.id === nextMessage.id) ? 0 : 1);
      const updated = {
        ...base,
        messages,
        unread,
        preview: previewOf(nextMessage),
        time: nextMessage.time,
        typing: false,
      };
      return [updated, ...current.filter((thread) => thread.id !== threadId)];
    });
  }

  function markStatus(messageId, status) {
    setThreads((current) => current.map((thread) => ({
      ...thread,
      messages: thread.messages.map((message) => (
        message.id === messageId && message.status !== 'read' ? { ...message, status } : message
      )),
    })));
  }

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [active?.messages.length, activeId]);

  useEffect(() => {
    let closed = false;
    const typingTimers = new Map();

    async function open() {
      const [session, directory] = await Promise.all([
        api('/api/chats/session'),
        api('/api/chats/people'),
      ]);
      if (closed) return;
      setPeople(directory.people);
      const chat = session.chat;
      selfRef.current = chat.userId;
      const conn = connectChat(chat);
      connRef.current = conn;
      conn.addEventHandler('nexora-whatsapp', {
        onTextMessage(message) { receive(message); },
        onImageMessage(message) { receive(message); },
        onFileMessage(message) { receive(message); },
        onAudioMessage(message) { receive(message); },
        onDeliveredMessage(message) { markStatus(message.mid || message.id, 'delivered'); },
        onReadMessage(message) { markStatus(message.mid || message.id, 'read'); },
        onRecallMessage(message) {
          const id = message.mid || message.id;
          setThreads((current) => current.map((thread) => ({
            ...thread,
            messages: thread.messages.map((item) => (item.id === id ? { ...item, type: 'txt', text: 'This message was deleted', fileUrl: '' } : item)),
          })));
        },
        onCmdMessage(message) {
          if (message.action !== 'typing') return;
          const id = message.from;
          patchThread(id, () => ({ typing: true }));
          clearTimeout(typingTimers.get(id));
          typingTimers.set(id, setTimeout(() => patchThread(id, () => ({ typing: false })), 2500));
        },
        onPresenceStatusChange(event) {
          const list = event?.statusDetails || event?.data || [];
          const items = Array.isArray(list) ? list : [event];
          setOnline((current) => {
            const next = { ...current };
            items.forEach((item) => {
              const id = item?.userId || item?.uid || item?.publisher;
              if (!id) return;
              const details = item.statusDetails || item.status || item.ext;
              const text = JSON.stringify(details || '').toLowerCase();
              next[id] = text.includes('offline') || text.includes('0') ? 'offline' : 'online';
            });
            return next;
          });
        },
        onTokenWillExpire() {
          api('/api/chats/session').then((data) => conn.renewToken(data.chat.token)).catch(() => {});
        },
        onError(event) {
          setError(event?.message || 'Chat hit a connection error.');
        },
      });
      await conn.open({ user: chat.userId, accessToken: chat.token });
      if (closed) return;
      const listed = await conn.getServerConversations({ pageSize: 50, cursor: '' }).catch(() => ({}));
      const conversations = rowsOf(listed, 'conversations');
      const nextThreads = [];
      for (const conversation of conversations) {
        const id = conversation.conversationId || conversation.channel_id;
        const chatType = conversation.conversationType === 'groupChat' || conversation.type === 'groupChat' ? 'groupChat' : 'singleChat';
        let title = directory.people.find((person) => person.id === id)?.name || 'Chat';
        if (chatType === 'groupChat') {
          const info = await conn.getGroupInfo({ groupId: id }).catch(() => null);
          title = info?.data?.[0]?.groupName || info?.data?.groupName || info?.groupname || 'Group';
        }
        const last = conversation.lastMessage;
        nextThreads.push({
          id,
          chatType,
          title,
          messages: [],
          unread: conversation.unReadCount || conversation.unreadCount || 0,
          preview: last?.msg || last?.filename || '',
          time: last?.time || conversation.lastMessageTime || 0,
          pinned: Boolean(conversation.isPinned),
          loaded: false,
          typing: false,
        });
      }
      if (!closed) {
        setThreads(nextThreads);
        setReady(true);
      }
      const ids = directory.people.map((person) => person.id);
      if (ids.length) {
        conn.subscribePresence({ usernames: ids, expiry: 86400 }).catch(() => {});
      }
      conn.publishPresence({ description: 'online' }).catch(() => {});
    }

    function receive(message) {
      const threadId = message.chatType === 'groupChat' ? message.to : (message.from === selfRef.current ? message.to : message.from);
      const item = normalize(message, selfRef.current);
      if (!item) return;
      upsertMessage(threadId, item);
      if (threadId === activeRef.current && item.from !== selfRef.current) {
        sendRead(message);
      }
    }

    open().catch((reason) => {
      if (!closed) setError(reason.message || 'Chat could not be opened.');
    });

    return () => {
      closed = true;
      typingTimers.forEach((timer) => clearTimeout(timer));
      connRef.current?.close();
      connRef.current = null;
    };
  }, []);

  function sendRead(message) {
    const conn = connRef.current;
    if (!conn || !message?.id) return;
    const ack = AgoraChat.message.create({
      type: 'read',
      id: message.id,
      to: message.from,
      chatType: message.chatType === 'groupChat' ? 'groupChat' : 'singleChat',
    });
    conn.send(ack).catch(() => {});
  }

  async function loadHistory(thread) {
    const conn = connRef.current;
    if (!conn || thread.loaded) return;
    const history = await conn.getHistoryMessages({
      targetId: thread.id,
      chatType: thread.chatType,
      pageSize: 40,
      searchDirection: 'up',
    });
    const messages = rowsOf(history, 'messages')
      .map((message) => normalize(message, selfRef.current))
      .filter(Boolean)
      .reverse();
    patchThread(thread.id, () => ({ messages, loaded: true, unread: 0 }));
    messages.filter((message) => message.from !== selfRef.current).forEach((message) => sendRead(message));
  }

  function openThread(thread) {
    activeRef.current = thread.id;
    setActiveId(thread.id);
    setPicker('');
    setReply(null);
    patchThread(thread.id, () => ({ unread: 0 }));
    loadHistory(thread).catch((reason) => setError(reason.message || 'Messages could not be loaded.'));
  }

  function startDirect(person) {
    const existing = threads.find((thread) => thread.id === person.id);
    const thread = existing || {
      id: person.id,
      chatType: 'singleChat',
      title: person.name,
      messages: [],
      unread: 0,
      preview: '',
      time: Date.now(),
      pinned: false,
      loaded: true,
      typing: false,
    };
    if (!existing) setThreads((current) => [thread, ...current]);
    openThread(thread);
  }

  async function createGroup(event) {
    event.preventDefault();
    setError('');
    try {
      const data = await api('/api/chats/groups', {
        method: 'POST',
        body: { title: groupTitle, memberIds: groupIds },
      });
      const thread = {
        id: data.group.id,
        chatType: 'groupChat',
        title: data.group.title,
        messages: [],
        unread: 0,
        preview: '',
        time: Date.now(),
        pinned: false,
        loaded: true,
        typing: false,
      };
      setThreads((current) => [thread, ...current]);
      setGroupTitle('');
      setGroupIds([]);
      openThread(thread);
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function sendPayload(message) {
    const conn = connRef.current;
    if (!conn || !active) return;
    const sent = await conn.send(message);
    const saved = normalize({ ...message, id: sent?.serverMsgId || message.id, from: selfRef.current, time: Date.now() }, selfRef.current);
    if (!saved) return;
    upsertMessage(active.id, { ...saved, status: 'sent' });
  }

  async function sendText(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !active) return;
    setError('');
    const message = AgoraChat.message.create({
      type: 'txt',
      chatType: active.chatType,
      to: active.id,
      msg: text,
      ext: reply ? { reply: { from: reply.from, text: reply.text } } : undefined,
    });
    try {
      await sendPayload(message);
      setDraft('');
      setReply(null);
      setEmojiOpen(false);
    } catch (reason) {
      setError(reason.message || 'The message was not sent.');
    }
  }

  function notifyTyping() {
    const conn = connRef.current;
    if (!conn || !active || active.chatType !== 'singleChat') return;
    const message = AgoraChat.message.create({
      type: 'cmd',
      chatType: 'singleChat',
      to: active.id,
      action: 'typing',
    });
    conn.send(message).catch(() => {});
  }

  async function sendFile(file, kind) {
    if (!file || !active) return;
    const type = kind === 'image' ? 'img' : kind === 'audio' ? 'audio' : 'file';
    const message = AgoraChat.message.create({
      type,
      chatType: active.chatType,
      to: active.id,
      filename: file.name,
      file: {
        url: URL.createObjectURL(file),
        filename: file.name,
        filetype: file.type,
        data: file,
      },
      ext: reply ? { reply: { from: reply.from, text: reply.text } } : undefined,
    });
    try {
      await sendPayload(message);
      setReply(null);
    } catch (reason) {
      setError(reason.message || 'The attachment was not sent.');
    }
  }

  async function toggleRecording() {
    if (recording && recorder.current) {
      recorder.current.stop();
      setRecording(false);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const media = new MediaRecorder(stream);
    recordChunks.current = [];
    media.ondataavailable = (event) => {
      if (event.data.size) recordChunks.current.push(event.data);
    };
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(recordChunks.current, { type: media.mimeType || 'audio/webm' });
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
      sendFile(file, 'audio');
    };
    recorder.current = media;
    media.start();
    setRecording(true);
  }

  async function recall(message) {
    const conn = connRef.current;
    if (!conn || !active || message.from !== selfRef.current) return;
    await conn.recallMessage({ mid: message.id, to: active.id, type: active.chatType === 'groupChat' ? 'groupChat' : 'singleChat' });
    patchThread(active.id, (thread) => ({
      messages: thread.messages.map((item) => (item.id === message.id ? { ...item, type: 'txt', text: 'You deleted this message', fileUrl: '' } : item)),
    }));
  }

  async function togglePin() {
    const conn = connRef.current;
    if (!conn || !active) return;
    const isPinned = !active.pinned;
    await conn.pinConversation({
      conversationId: active.id,
      conversationType: active.chatType,
      isPinned,
    }).catch(() => {});
    patchThread(active.id, () => ({ pinned: isPinned }));
  }

  let previousDay = '';

  return (
    <main className={active ? 'wa show-thread' : 'wa'}>
      <aside className="wa-side">
        <header className="wa-head">
          <div>
            <h1>Chats</h1>
            <p>{ready ? user?.name : 'Connecting…'}</p>
          </div>
          <span className="wa-grow" />
          <button className="wa-icon" type="button" title="New chat" onClick={() => setPicker(picker === 'chat' ? '' : 'chat')}>✎</button>
          <button className="wa-icon" type="button" title="New group" onClick={() => setPicker(picker === 'group' ? '' : 'group')}>👥</button>
          <button className="wa-link" type="button" onClick={() => navigate('/rooms')}>Rooms</button>
          <button className="wa-link" type="button" onClick={() => logout().then(() => navigate('/login'))}>Log out</button>
        </header>
        <div className="wa-search">
          <input value={search} placeholder="Search or start a new chat" onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="wa-list">
        {picker === 'chat' ? (
          <div className="wa-picker">
            <h3>New chat</h3>
            {people.map((person) => (
              <button className="wa-person" type="button" key={person.id} onClick={() => startDirect(person)}>
                <span className="wa-avatar">{initial(person.name)}</span>
                <strong>{person.name}</strong>
                <span />
              </button>
            ))}
          </div>
        ) : null}
        {picker === 'group' ? (
          <form className="wa-picker" onSubmit={createGroup}>
            <h3>New group</h3>
            <input value={groupTitle} placeholder="Group name" onChange={(event) => setGroupTitle(event.target.value)} />
            {people.map((person) => (
              <label className="wa-person" key={person.id}>
                <input
                  type="checkbox"
                  checked={groupIds.includes(person.id)}
                  onChange={() => setGroupIds((current) => (
                    current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id]
                  ))}
                />
                <strong>{person.name}</strong>
                <span />
              </label>
            ))}
            <button className="button" type="submit">Create group</button>
          </form>
        ) : null}
        {picker ? null : visible.length === 0 ? <p className="wa-empty-list">No chats yet. Start one with the pencil.</p> : null}
        {picker ? null : visible.map((thread) => (
            <button className={thread.id === activeId ? 'wa-chat on' : 'wa-chat'} type="button" key={thread.id} onClick={() => openThread(thread)}>
              <span className="wa-avatar">{initial(thread.title)}</span>
              <span>
                <strong>{thread.pinned ? '📌 ' : ''}{thread.title}</strong>
                <em>{thread.typing ? 'typing…' : thread.preview || 'No messages yet'}</em>
              </span>
              <span className="wa-meta">
                <span className="wa-time">{listTime(thread.time)}</span>
                {thread.unread > 0 ? <span className="wa-badge">{thread.unread}</span> : null}
              </span>
            </button>
          ))}
        </div>
      </aside>
      <section className="wa-thread">
        {error ? <p className="wa-error">{error}</p> : null}
        {!active ? (
          <div className="wa-empty-thread">
            <div>
              <h2>Nexora chat</h2>
              <p>Send messages, photos, files, and voice notes. Select a chat or start a new one.</p>
            </div>
          </div>
        ) : (
          <>
            <header className="wa-thread-head">
              <button className="wa-back" type="button" onClick={() => { activeRef.current = ''; setActiveId(''); }}>←</button>
              <span className="wa-avatar">{initial(active.title)}</span>
              <div>
                <h2>{active.title}</h2>
                <p>{active.typing ? 'typing…' : active.chatType === 'groupChat' ? 'Group' : (online[active.id] === 'online' ? 'online' : 'last seen recently')}</p>
              </div>
              <span className="wa-grow" />
              <button className="wa-icon" type="button" title="Pin chat" onClick={togglePin}>{active.pinned ? 'Unpin' : 'Pin'}</button>
            </header>
            <div className="wa-log" ref={scroller}>
              {active.messages.map((message) => {
                const label = dayLabel(message.time);
                const showDay = label !== previousDay;
                previousDay = label;
                const mine = message.from === user?.id;
                return (
                  <div key={message.id} style={{ display: 'contents' }}>
                    {showDay ? <div className="wa-day">{label}</div> : null}
                    <article className={mine ? 'wa-bubble mine' : 'wa-bubble'}>
                      {!mine && active.chatType === 'groupChat' ? <strong>{names.get(message.from) || 'Member'}</strong> : null}
                      {message.reply ? <div className="wa-quote">{message.reply.text}</div> : null}
                      {message.type === 'img' && message.fileUrl ? <img src={message.fileUrl} alt="" /> : null}
                      {message.type === 'audio' && message.fileUrl ? <audio controls src={message.fileUrl} /> : null}
                      {message.type === 'file' && message.fileUrl ? <a href={message.fileUrl} download={message.filename}>{message.filename || message.text}</a> : <p>{message.text}</p>}
                      <div className="wa-stamp">
                        <span>{clock(message.time)}</span>
                        {mine ? <span className={message.status === 'read' ? 'ticks read' : 'ticks'}>{message.status === 'sent' ? '✓' : '✓✓'}</span> : null}
                      </div>
                      <div className="wa-actions">
                        <button type="button" onClick={() => setReply(message)}>Reply</button>
                        {mine ? <button type="button" onClick={() => recall(message)}>Delete</button> : null}
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
            {reply ? (
              <div className="wa-reply">
                <span>{reply.text}</span>
                <button className="wa-icon" type="button" onClick={() => setReply(null)}>✕</button>
              </div>
            ) : null}
            {emojiOpen ? (
              <div className="wa-emoji">
                {EMOJIS.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => setDraft((current) => current + emoji)}>{emoji}</button>
                ))}
              </div>
            ) : null}
            <form className="wa-compose" onSubmit={sendText}>
              <button className="wa-icon" type="button" onClick={() => setEmojiOpen((value) => !value)}>☺</button>
              <button className="wa-icon" type="button" onClick={() => photoRef.current?.click()}>📷</button>
              <button className="wa-icon" type="button" onClick={() => fileRef.current?.click()}>📎</button>
              <input
                value={draft}
                placeholder="Type a message"
                onChange={(event) => {
                  setDraft(event.target.value);
                  notifyTyping();
                }}
              />
              {draft.trim() ? (
                <button className="wa-send" type="submit" aria-label="Send">➤</button>
              ) : (
                <button className={recording ? 'wa-send on' : 'wa-send'} type="button" onClick={() => toggleRecording().catch((reason) => setError(reason.message))}>
                  {recording ? 'Stop' : '🎤'}
                </button>
              )}
            </form>
            <input ref={photoRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; sendFile(file, 'image'); }} />
            <input ref={fileRef} type="file" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; sendFile(file, 'file'); }} />
          </>
        )}
      </section>
    </main>
  );
}
