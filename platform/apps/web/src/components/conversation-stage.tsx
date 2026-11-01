'use client';

import { Button } from '@platform/ui';
import { Info, Mic, Paperclip, Phone, Smile, Star, Video } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import { decodeBody, encodeBody, withinLimit } from '../lib/message-body';
import { useCall } from '../stores/call-store';
import { conversationTitle, otherMember, useChat, type ChatMessage } from '../stores/chat-store';
import { useSession } from '../stores/session-store';
import { useShell } from '../stores/shell-store';

const emojis = ['😀', '😁', '😂', '😊', '😍', '😘', '😎', '😢', '😮', '😡', '👍', '👎', '🙏', '👏', '🔥', '❤️', '💙', '✨', '🎉', '✅'];

export function ConversationStage() {
  const infoOpen = useShell((state) => state.infoOpen);
  const toggleInfo = useShell((state) => state.toggleInfo);
  const myId = useSession((state) => state.session?.user.id || '');
  const conversations = useChat((state) => state.conversations);
  const activeId = useChat((state) => state.activeId);
  const messages = useChat((state) => state.messages);
  const sendError = useChat((state) => state.error);
  const send = useChat((state) => state.send);
  const sendPayload = useChat((state) => state.sendPayload);
  const pins = useChat((state) => state.pins);
  const loadPins = useChat((state) => state.loadPins);
  const togglePin = useChat((state) => state.togglePin);
  const startCall = useCall((state) => state.start);
  const showCallError = useCall((state) => state.showError);
  const callStatus = useCall((state) => state.status);
  const callConversationId = useCall((state) => state.conversationId);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const draftRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordTimer = useRef(0);
  const conversation = conversations.find((item) => item.id === activeId);
  const title = conversationTitle(conversation, myId);
  const other = otherMember(conversation, myId);
  const direct = conversation?.type === 'DIRECT';
  const pinned = conversation ? pins.includes(conversation.id) : false;
  const callHere = callConversationId === activeId && (callStatus === 'ringing' || callStatus === 'connecting' || callStatus === 'connected');

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  useEffect(() => () => {
    window.clearTimeout(recordTimer.current);
    recorderRef.current?.stop();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await send(draft);
      setDraft('');
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The server did not respond. Try again.');
    }
  }

  function beginCall(video: boolean) {
    if (!conversation || !other) {
      showCallError('Choose a direct chat first.');
      return;
    }
    void startCall(conversation.id, other.displayName, video);
  }

  function insertEmoji(emoji: string) {
    const input = draftRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(next);
    requestAnimationFrame(() => {
      input?.focus();
      const caret = start + emoji.length;
      input?.setSelectionRange(caret, caret);
    });
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !conversation) return;
    setError('');
    try {
      const dataUrl = await compressImage(file);
      const ciphertext = encodeBody({ kind: 'image', dataUrl });
      if (!withinLimit(ciphertext)) {
        setError('That image is too large.');
        return;
      }
      await sendPayload(ciphertext);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'That image could not be sent.');
    }
  }

  async function toggleRecording() {
    if (!conversation) return;
    if (recorderRef.current) {
      recorderRef.current.stop();
      return;
    }
    setError('');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('The microphone is not available.');
      return;
    }
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setError('The microphone is not available.');
      return;
    }
    const chunks: Blob[] = [];
    recorder.ondataavailable = (chunk) => {
      if (chunk.data.size) chunks.push(chunk.data);
    };
    recorder.onstop = () => {
      window.clearTimeout(recordTimer.current);
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      setRecording(false);
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      if (!blob.size) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const ciphertext = encodeBody({ kind: 'audio', dataUrl });
        if (!withinLimit(ciphertext)) {
          setError('That voice note is too long.');
          return;
        }
        void sendPayload(ciphertext).catch((reason) => {
          setError(reason instanceof ApiError ? reason.message : 'That voice note could not be sent.');
        });
      };
      reader.readAsDataURL(blob);
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    recordTimer.current = window.setTimeout(() => recorder.stop(), 20000);
  }

  return (
    <section aria-label="Conversation" className="flex min-w-0 flex-1 flex-col bg-canvas">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {title.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted">
            {callHere ? callLabel(callStatus) : conversation ? (direct ? 'Direct chat' : 'Group') : 'Choose a chat from the list'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!conversation}
          aria-pressed={pinned}
          aria-label={pinned ? 'Remove from favorites' : 'Add to favorites'}
          title={pinned ? 'Remove from favorites' : 'Add to favorites'}
          onClick={() => {
            if (conversation) togglePin(conversation.id);
          }}
        >
          <Star className={`h-5 w-5 ${pinned ? 'fill-current text-primary' : ''}`} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!direct}
          aria-label={direct ? 'Start voice call' : 'Audio call unavailable'}
          title={direct ? 'Start a voice call' : 'Calls connect after a direct chat is open'}
          onClick={() => beginCall(false)}
        >
          <Phone className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!direct}
          aria-label={direct ? 'Start video call' : 'Video call unavailable'}
          title={direct ? 'Start a video call' : 'Calls connect after a direct chat is open'}
          onClick={() => beginCall(true)}
        >
          <Video className="h-5 w-5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Conversation details" aria-pressed={infoOpen} onClick={toggleInfo}>
          <Info className="h-5 w-5" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-auto px-4 py-4">
        {conversation && messages.length ? messages.map((message) => (
          <MessageBubble key={message.id} message={message} mine={message.senderUserId === myId} />
        )) : (
          <div className="m-auto max-w-md text-center">
            <h2 className="text-2xl font-semibold tracking-tight">{conversation ? title : 'A quieter place to talk'}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {conversation ? 'Messages you send appear here after the server accepts them.' : 'Messages show up here after you open a conversation.'}
            </p>
          </div>
        )}
      </div>
      <form className="relative border-t border-line bg-surface p-3" onSubmit={(event) => void onSubmit(event)}>
        {emojiOpen && conversation ? (
          <div className="absolute bottom-full left-3 z-20 mb-2 grid grid-cols-10 gap-1 rounded-2xl border border-line bg-surface p-2 shadow-[var(--nx-shadow)]">
            {emojis.map((emoji) => (
              <button key={emoji} type="button" className="grid h-9 w-9 place-items-center rounded-lg text-lg hover:bg-canvas" onClick={() => insertEmoji(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
        {error || sendError ? <p role="alert" className="mb-2 text-sm text-danger">{error || sendError}</p> : null}
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!conversation}
            aria-label="Emoji"
            aria-pressed={emojiOpen}
            title="Add an emoji"
            onClick={() => setEmojiOpen((open) => !open)}
          >
            <Smile className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!conversation}
            aria-label="Attach a photo"
            title="Attach a photo"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => void onFile(event)} />
          <input
            ref={draftRef}
            aria-label="Message"
            placeholder={conversation ? 'Write a message' : 'Choose a chat first'}
            disabled={!conversation}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 text-sm disabled:opacity-60"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!conversation}
            aria-label={recording ? 'Stop voice note' : 'Voice note'}
            aria-pressed={recording}
            title={recording ? 'Stop and send the voice note' : 'Record a voice note'}
            onClick={() => void toggleRecording()}
          >
            <Mic className={`h-5 w-5 ${recording ? 'text-danger' : ''}`} />
          </Button>
          <Button type="submit" size="icon" aria-label="Send" disabled={!conversation || !draft.trim()}>↑</Button>
        </div>
      </form>
    </section>
  );
}

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const body = decodeBody(message.ciphertext);
  return (
    <div className={`w-fit max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? 'self-end bg-primary text-white' : 'self-start border border-line bg-surface'}`}>
      {body.kind === 'image' ? <img src={body.dataUrl} alt="Photo" className="max-h-64 rounded-lg" /> : null}
      {body.kind === 'audio' ? <audio controls src={body.dataUrl} className="max-w-full" /> : null}
      {body.kind === 'text' ? body.text : null}
    </div>
  );
}

function callLabel(status: string) {
  if (status === 'connected') return 'Connected';
  if (status === 'connecting') return 'Connecting…';
  if (status === 'ringing') return 'Ringing…';
  return 'Voice call';
}

function compressImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const longest = Math.max(image.width, image.height) || 1;
      const scale = Math.min(1, 1280 / longest);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('The image could not be prepared.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be sent.'));
    };
    image.src = url;
  });
}
