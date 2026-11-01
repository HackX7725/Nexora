import { useEffect, useRef, useState } from 'react';
import AgoraChat from 'agora-chat';

function textOf(message) {
  return {
    id: message.id || `${message.from}-${message.time}`,
    from: message.from || '',
    text: message.msg || '',
    time: message.time || Date.now(),
  };
}

export default function ChatPanel({ chat, chatError, roster, onRenew }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const connRef = useRef(null);
  const scroller = useRef(null);
  const tokenRef = useRef(chat?.token);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (!chat) return undefined;
    const conn = new AgoraChat.connection({
      ...(chat.appKey ? { appKey: chat.appKey } : { appId: chat.appId }),
      isHttpDNS: false,
      url: chat.url,
      apiUrl: chat.apiUrl,
      delivery: true,
    });
    connRef.current = conn;
    conn.addEventHandler('nexora-room', {
      onTextMessage(message) {
        if (message.chatType !== 'groupChat' || message.to !== chat.groupId) return;
        if (message.from === chat.userId) return;
        setMessages((current) => [...current, textOf(message)]);
      },
      onTokenWillExpire() {
        onRenew();
      },
      onError(event) {
        setError(event?.message || 'Chat hit a connection error.');
      },
    });

    let closed = false;
    conn.open({ user: chat.userId, accessToken: chat.token })
      .then(() => conn.getHistoryMessages({
        targetId: chat.groupId,
        chatType: 'groupChat',
        pageSize: 50,
        searchDirection: 'up',
      }))
      .then((history) => {
        if (closed) return;
        const items = (history?.messages || [])
          .filter((message) => message.type === 'txt')
          .map(textOf)
          .reverse();
        setMessages(items);
      })
      .catch((reason) => {
        if (!closed) setError(reason?.message || 'Chat could not be opened.');
      });

    return () => {
      closed = true;
      conn.close();
      connRef.current = null;
    };
  }, [chat?.appId, chat?.appKey, chat?.apiUrl, chat?.url, chat?.groupId, chat?.userId, onRenew]);

  useEffect(() => {
    if (!chat?.token || tokenRef.current === chat.token) return;
    tokenRef.current = chat.token;
    connRef.current?.renewToken(chat.token).catch(() => {});
  }, [chat?.token]);

  async function send(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !connRef.current) return;
    setPending(true);
    setError('');
    try {
      const message = AgoraChat.message.create({
        chatType: 'groupChat',
        type: 'txt',
        to: chat.groupId,
        msg: text,
      });
      await connRef.current.send(message);
      setMessages((current) => [...current, textOf({ ...message, from: chat.userId, time: Date.now() })]);
      setDraft('');
    } catch (reason) {
      setError(reason?.message || 'The message was not sent.');
    } finally {
      setPending(false);
    }
  }

  if (!chat) {
    return (
      <div className="pane-empty">
        <p>{chatError || 'Room chat is not available for this room yet.'}</p>
      </div>
    );
  }

  return (
    <div className="chat-pane">
      <div className="chat-log" ref={scroller}>
        {messages.length === 0 ? <p className="empty">No messages yet.</p> : null}
        {messages.map((message) => {
          const person = roster.find((member) => member.id === message.from);
          return (
            <article key={message.id} className={message.from === chat.userId ? 'mine' : ''}>
              <strong>{person?.name || 'Member'}</strong>
              <p>{message.text}</p>
            </article>
          );
        })}
      </div>
      {error ? <p className="banner">{error}</p> : null}
      <form onSubmit={send} className="chat-form">
        <input
          value={draft}
          maxLength={2000}
          placeholder="Message the room"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="button" type="submit" disabled={pending || !draft.trim()}>Send</button>
      </form>
    </div>
  );
}
