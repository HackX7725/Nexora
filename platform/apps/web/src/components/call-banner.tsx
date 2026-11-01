'use client';

import { Button } from '@platform/ui';
import { useEffect, useRef } from 'react';
import { useCall } from '../stores/call-store';

const labels: Record<string, string> = {
  ringing: 'Ringing…',
  connecting: 'Connecting…',
  connected: 'Connected',
  unavailable: "They're not available for a call.",
  ended: 'Call ended.',
  error: 'The call could not start.',
};

export function CallBanner() {
  const status = useCall((state) => state.status);
  const direction = useCall((state) => state.direction);
  const peerName = useCall((state) => state.peerName);
  const detail = useCall((state) => state.detail);
  const video = useCall((state) => state.video);
  const localStream = useCall((state) => state.localStream);
  const remoteStream = useCall((state) => state.remoteStream);
  const accept = useCall((state) => state.accept);
  const decline = useCall((state) => state.decline);
  const hangup = useCall((state) => state.hangup);

  if (status === 'idle') return null;

  const incoming = status === 'ringing' && direction === 'in';
  const live = status === 'ringing' || status === 'connecting' || status === 'connected';
  const text = incoming
    ? `${peerName} is calling`
    : detail || labels[status] || '';
  const remoteVideo = Boolean(remoteStream?.getVideoTracks().length);
  const localVideo = Boolean(localStream?.getVideoTracks().length);

  return (
    <div className="fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(100%-2rem,28rem)] flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-[var(--nx-shadow)]">
      {remoteVideo || localVideo ? (
        <div className="relative overflow-hidden rounded-xl bg-ink">
          {remoteVideo && remoteStream ? <StreamVideo stream={remoteStream} className="aspect-video w-full bg-ink object-cover" /> : null}
          {localVideo && localStream ? (
            <StreamVideo
              stream={localStream}
              muted
              className={remoteVideo
                ? 'absolute bottom-2 right-2 h-24 w-32 rounded-lg border border-white/40 object-cover'
                : 'aspect-video w-full object-cover'}
            />
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {incoming ? (video ? 'Incoming video call' : 'Incoming voice call') : peerName || (video ? 'Video call' : 'Voice call')}
          </p>
          <p className="text-sm text-muted">{text}</p>
        </div>
        <div className="flex gap-2">
          {incoming ? (
            <>
              <Button type="button" onClick={() => void accept()}>Accept</Button>
              <Button type="button" variant="secondary" onClick={decline}>Decline</Button>
            </>
          ) : null}
          {live && !incoming ? (
            <Button type="button" variant="danger" onClick={() => hangup('Call ended.')}>Hang up</Button>
          ) : null}
          {!live && !incoming ? (
            <Button type="button" variant="secondary" onClick={() => hangup()}>Close</Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StreamVideo({ stream, muted, className }: { stream: MediaStream; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    void element.play().catch(() => undefined);
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}
