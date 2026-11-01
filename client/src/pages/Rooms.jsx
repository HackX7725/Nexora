import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Banner, Field } from '../components/AuthLayout';

export default function Rooms() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState('video');
  const [inviteCode, setInviteCode] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState('');

  async function load() {
    const data = await api('/api/rooms');
    setRooms(data.rooms);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  async function createRoom(event) {
    event.preventDefault();
    setErrors({});
    setMessage('');
    if (title.trim().length < 2) {
      setErrors({ title: 'Give the room a title between 2 and 80 characters.' });
      return;
    }
    setPending('create');
    try {
      const data = await api('/api/rooms', { method: 'POST', body: { title, mode } });
      navigate(`/rooms/${data.room.id}`);
    } catch (error) {
      setMessage(error.message);
      setErrors(error.errors || {});
    } finally {
      setPending('');
    }
  }

  async function joinRoom(event) {
    event.preventDefault();
    setErrors({});
    setMessage('');
    if (!inviteCode.trim()) {
      setErrors({ inviteCode: 'Enter an invite code.' });
      return;
    }
    setPending('join');
    try {
      const data = await api('/api/rooms/join', { method: 'POST', body: { inviteCode } });
      navigate(`/rooms/${data.room.id}`);
    } catch (error) {
      setMessage(error.message);
      setErrors(error.errors || {});
    } finally {
      setPending('');
    }
  }

  return (
    <main className="lobby">
      <header className="lobby-bar">
        <p className="brand">Nexora</p>
        <div className="lobby-user">
          <span>{user?.name}</span>
          <button className="button ghost" type="button" onClick={() => navigate('/chats')}>Chats</button>
          <button className="button ghost" type="button" onClick={() => logout().then(() => navigate('/login'))}>
            Log out
          </button>
        </div>
      </header>
      <section className="lobby-grid">
        <div className="panel">
          <h1>Rooms</h1>
          <p className="lede">Start a video or voice room, or walk in with an invite code.</p>
          <Banner>{message}</Banner>
          {rooms.length === 0 ? <p className="empty">Create a room or join with an invite code.</p> : null}
          <ul className="room-list">
            {rooms.map((room) => (
              <li key={room.id}>
                <button type="button" onClick={() => navigate(`/rooms/${room.id}`)}>
                  <strong>{room.title}</strong>
                  <span>{room.mode === 'voice' ? 'Voice' : 'Video'} · {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel stack">
          <form onSubmit={createRoom}>
            <h2>Create a room</h2>
            <Field label="Title" error={errors.title}>
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} />
            </Field>
            <div className="mode-switch" role="group" aria-label="Room type">
              <button type="button" className={mode === 'video' ? 'on' : ''} onClick={() => setMode('video')}>Video</button>
              <button type="button" className={mode === 'voice' ? 'on' : ''} onClick={() => setMode('voice')}>Voice</button>
            </div>
            <button className="button" type="submit" disabled={pending === 'create'}>
              {pending === 'create' ? 'Creating…' : 'Create room'}
            </button>
          </form>
          <form onSubmit={joinRoom}>
            <h2>Join with a code</h2>
            <Field label="Invite code" error={errors.inviteCode}>
              <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} autoCapitalize="none" />
            </Field>
            <button className="button" type="submit" disabled={pending === 'join'}>
              {pending === 'join' ? 'Joining…' : 'Join room'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
