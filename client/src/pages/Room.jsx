import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import CallStage from '../components/CallStage';
import ChatPanel from '../components/ChatPanel';
import Whiteboard from '../components/Whiteboard';
import FilePanel from '../components/FilePanel';

export default function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [socket, setSocket] = useState(null);
  const [tab, setTab] = useState('chat');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const renew = useCallback(async () => {
    const data = await api(`/api/rooms/${id}/tokens`, { method: 'POST' });
    setSession((current) => {
      if (!current) return current;
      return {
        ...current,
        rtc: data.rtc || current.rtc,
        chat: data.chat ? { ...current.chat, ...data.chat } : current.chat,
      };
    });
  }, [id]);

  useEffect(() => {
    let active = true;
    api(`/api/rooms/${id}/join`, { method: 'POST' })
      .then((data) => {
        if (active) setSession(data);
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const next = io({ withCredentials: true });
    next.on('connect', () => next.emit('room:join', { roomId: id }));
    next.on('room:error', (payload) => setMessage(payload.message));
    setSocket(next);
    return () => next.disconnect();
  }, [id]);

  async function copyCode() {
    if (!session?.room?.inviteCode) return;
    await navigator.clipboard.writeText(session.room.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (message && !session) {
    return (
      <main className="studio">
        <p className="banner">{message}</p>
        <button className="button" type="button" onClick={() => navigate('/rooms')}>Back to rooms</button>
      </main>
    );
  }

  if (!session) return <main className="boot">Opening the room…</main>;

  const roster = session.room.roster || [];
  const isHost = session.room.hostId === user?.id;

  return (
    <main className="studio">
      <header className="studio-bar">
        <div>
          <p className="brand">Nexora</p>
          <h1>{session.room.title}</h1>
        </div>
        <button className="code-chip" type="button" onClick={copyCode}>
          {copied ? 'Copied' : `Invite ${session.room.inviteCode}`}
        </button>
        <button className="button ghost" type="button" onClick={() => navigate('/rooms')}>Leave</button>
      </header>
      <div className="studio-body">
        <CallStage
          roomId={id}
          mode={session.room.mode}
          rtc={session.rtc}
          roster={roster}
          onRenew={renew}
        />
        <aside className="side">
          <div className="tabs" role="tablist">
            {['chat', 'board', 'files'].map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                className={tab === name ? 'on' : ''}
                onClick={() => setTab(name)}
              >
                {name === 'chat' ? 'Chat' : name === 'board' ? 'Board' : 'Files'}
              </button>
            ))}
          </div>
          {tab === 'chat' ? (
            <ChatPanel chat={session.chat} chatError={session.chatError} roster={roster} onRenew={renew} />
          ) : null}
          {tab === 'board' ? <Whiteboard roomId={id} socket={socket} isHost={isHost} /> : null}
          {tab === 'files' ? <FilePanel roomId={id} socket={socket} /> : null}
        </aside>
      </div>
    </main>
  );
}
