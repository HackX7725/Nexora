import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

function formatSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilePanel({ roomId, socket }) {
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const inputRef = useRef(null);

  async function load() {
    const data = await api(`/api/rooms/${roomId}/files`);
    setFiles(data.files);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [roomId]);

  useEffect(() => {
    if (!socket) return undefined;
    const onAdded = (file) => {
      setFiles((current) => [file, ...current.filter((item) => item.id !== file.id)]);
    };
    socket.on('file:added', onAdded);
    return () => socket.off('file:added', onAdded);
  }, [socket]);

  async function onUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessage('');
    if (file.size > 10 * 1024 * 1024) {
      setMessage('Files must be 10 MB or smaller.');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    setPending(true);
    try {
      const data = await api(`/api/rooms/${roomId}/files`, { method: 'POST', formData: body });
      setFiles((current) => [data.file, ...current.filter((item) => item.id !== data.file.id)]);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="file-pane">
      <button className="button" type="button" onClick={() => inputRef.current?.click()} disabled={pending}>
        {pending ? 'Uploading…' : 'Upload a file'}
      </button>
      <input ref={inputRef} type="file" hidden onChange={onUpload} />
      {message ? <p className="banner">{message}</p> : null}
      {files.length === 0 ? <p className="empty">Files shared here stay with the room.</p> : null}
      <ul className="file-list">
        {files.map((file) => (
          <li key={file.id}>
            <a href={`/api/rooms/${roomId}/files/${file.id}/download`}>{file.originalName}</a>
            <span>{file.uploader?.name} · {formatSize(file.size)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
