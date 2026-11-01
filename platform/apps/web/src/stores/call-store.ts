'use client';

import type { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { getSocket, whenReady } from '../lib/realtime';

const connectError = 'The call could not connect.';
const connectRetryMs = 8000;
const connectGiveUpMs = 16000;
const iceServers: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'unavailable' | 'ended' | 'error';

interface CallState {
  status: CallStatus;
  conversationId: string | null;
  peerName: string;
  direction: 'in' | 'out' | null;
  video: boolean;
  detail: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  start: (conversationId: string, peerName: string, video: boolean) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => void;
  hangup: (detail?: string) => void;
  showError: (detail: string) => void;
  bind: (socket: Socket) => () => void;
}

let peer: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteAudio: HTMLAudioElement | null = null;
let pendingIce: RTCIceCandidateInit[] = [];
let answerTimer = 0;
let ringPulse = 0;
let ringContext: AudioContext | null = null;
let callEpoch = 0;
let iceRestarted = false;
let connectTimer = 0;

function remoteElement() {
  if (!remoteAudio) {
    remoteAudio = document.createElement('audio');
    remoteAudio.autoplay = true;
  }
  return remoteAudio;
}

function ringTone(context: AudioContext, frequency: number, start: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.04, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.3);
}

function startRing() {
  stopRing();
  try {
    const context = ringContext || new AudioContext();
    ringContext = context;
    const pulse = () => {
      void context.resume();
      const start = context.currentTime;
      ringTone(context, 440, start);
      ringTone(context, 480, start + 0.32);
    };
    pulse();
    ringPulse = window.setInterval(pulse, 2200);
  } catch {
    // A blocked sound still leaves the on-screen call.
  }
}

function stopRing() {
  window.clearInterval(ringPulse);
  ringPulse = 0;
}

function clearConnectDeadline() {
  window.clearTimeout(connectTimer);
  connectTimer = 0;
}

function stopMedia() {
  window.clearTimeout(answerTimer);
  answerTimer = 0;
  clearConnectDeadline();
  stopRing();
  localStream?.getTracks().forEach((track) => track.stop());
  localStream = null;
  pendingIce = [];
  iceRestarted = false;
  if (remoteAudio) remoteAudio.srcObject = null;
  if (peer) {
    peer.ontrack = null;
    peer.onicecandidate = null;
    peer.onconnectionstatechange = null;
    peer.close();
    peer = null;
  }
}

function clearedMedia() {
  return { localStream: null, remoteStream: null };
}

async function capture(video: boolean) {
  return navigator.mediaDevices.getUserMedia({ audio: true, video });
}

function mediaError(video: boolean) {
  return video ? 'The camera or microphone is not available.' : 'The microphone is not available.';
}

function plainDescription(description: RTCSessionDescription | null): RTCSessionDescriptionInit | null {
  if (!description?.type || !description.sdp) return null;
  return { type: description.type, sdp: description.sdp };
}

function remoteDescription(value: RTCSessionDescriptionInit | null | undefined): RTCSessionDescriptionInit {
  if (!value?.type || !value.sdp) throw new Error(connectError);
  return { type: value.type, sdp: value.sdp };
}

function waitForIce(connection: RTCPeerConnection, timeoutMs = 2000) {
  if (connection.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      connection.removeEventListener('icegatheringstatechange', onState);
      resolve();
    };
    const onState = () => {
      if (connection.iceGatheringState === 'complete') finish();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    connection.addEventListener('icegatheringstatechange', onState);
  });
}

async function publishDescription(connection: RTCPeerConnection, conversationId: string, event: 'call:offer' | 'call:answer') {
  await waitForIce(connection);
  if (peer !== connection || useCall.getState().conversationId !== conversationId) return false;
  const sdp = plainDescription(connection.localDescription);
  const socket = getSocket();
  if (!sdp || !socket?.connected) throw new Error(connectError);
  socket.emit(event, { conversationId, sdp });
  return true;
}

function giveUp(conversationId: string) {
  const current = useCall.getState();
  if (current.conversationId !== conversationId) return;
  if (current.status !== 'ringing' && current.status !== 'connecting' && current.status !== 'connected') return;
  callEpoch += 1;
  getSocket()?.emit('call:hangup', { conversationId });
  const peerName = current.peerName;
  stopMedia();
  useCall.setState({
    status: 'error',
    detail: connectError,
    direction: null,
    video: false,
    conversationId,
    peerName,
    ...clearedMedia(),
  });
}

async function restartIce(connection: RTCPeerConnection, conversationId: string) {
  const offer = await connection.createOffer({ iceRestart: true });
  if (peer !== connection || useCall.getState().conversationId !== conversationId) return false;
  await connection.setLocalDescription(offer);
  return publishDescription(connection, conversationId, 'call:offer');
}

function armConnectDeadline(conversationId: string, delayMs: number) {
  clearConnectDeadline();
  connectTimer = window.setTimeout(() => {
    connectTimer = 0;
    const current = useCall.getState();
    if (current.conversationId !== conversationId || current.status !== 'connecting') return;
    if (peer?.connectionState === 'connected') return;
    if (current.direction === 'out' && !iceRestarted && peer && peer.connectionState !== 'closed') {
      iceRestarted = true;
      void restartIce(peer, conversationId)
        .then((sent) => {
          if (useCall.getState().conversationId !== conversationId || useCall.getState().status !== 'connecting') return;
          if (sent) armConnectDeadline(conversationId, connectRetryMs);
          else giveUp(conversationId);
        })
        .catch(() => giveUp(conversationId));
      return;
    }
    giveUp(conversationId);
  }, delayMs);
}

async function addIce(candidate: RTCIceCandidateInit) {
  if (!peer || !peer.remoteDescription) {
    pendingIce.push(candidate);
    return;
  }
  await peer.addIceCandidate(candidate).catch(() => undefined);
}

async function flushIce() {
  const queued = pendingIce;
  pendingIce = [];
  for (const candidate of queued) {
    await peer?.addIceCandidate(candidate).catch(() => undefined);
  }
}

function attach(conversationId: string, stream: MediaStream) {
  if (peer) {
    peer.ontrack = null;
    peer.onicecandidate = null;
    peer.onconnectionstatechange = null;
    peer.close();
  }
  const connection = new RTCPeerConnection({ iceServers });
  peer = connection;
  stream.getTracks().forEach((track) => connection.addTrack(track, stream));
  connection.onicecandidate = (event) => {
    if (!event.candidate) return;
    getSocket()?.emit('call:ice', { conversationId, candidate: event.candidate.toJSON() });
  };
  connection.ontrack = (event) => {
    const streamed = event.streams[0];
    const incoming = streamed && streamed.getTracks().length > 0 ? streamed : new MediaStream([event.track]);
    if (!incoming.getTracks().length) return;
    const hasVideo = incoming.getVideoTracks().length > 0;
    if (hasVideo) {
      if (remoteAudio) remoteAudio.srcObject = null;
    } else {
      const element = remoteElement();
      element.srcObject = incoming;
      void element.play().catch(() => undefined);
    }
    if (useCall.getState().conversationId === conversationId) {
      useCall.setState({ remoteStream: incoming });
    }
  };
  connection.onconnectionstatechange = () => {
    const current = useCall.getState();
    if (current.conversationId !== conversationId || peer !== connection) return;
    if (connection.connectionState === 'connected') {
      clearConnectDeadline();
      useCall.setState({ status: 'connected', detail: '' });
      return;
    }
    if (connection.connectionState === 'failed') {
      if (current.direction === 'in' && !iceRestarted) {
        if (current.status === 'connected') useCall.setState({ status: 'connecting', detail: '' });
        return;
      }
      if (current.direction === 'out' && !iceRestarted) {
        iceRestarted = true;
        clearConnectDeadline();
        useCall.setState({ status: 'connecting', detail: '' });
        void restartIce(connection, conversationId)
          .then((sent) => {
            if (useCall.getState().conversationId !== conversationId || useCall.getState().status !== 'connecting') return;
            if (sent) armConnectDeadline(conversationId, connectRetryMs);
            else giveUp(conversationId);
          })
          .catch(() => giveUp(conversationId));
        return;
      }
      giveUp(conversationId);
      return;
    }
    if (current.status === 'connected') {
      useCall.setState({ status: 'connecting', detail: '' });
    }
  };
  return connection;
}

function armRingTimeout() {
  window.clearTimeout(answerTimer);
  answerTimer = window.setTimeout(() => {
    if (useCall.getState().status === 'ringing' && useCall.getState().direction === 'out') {
      useCall.getState().hangup("They didn't answer.");
    }
  }, 45000);
}

export const useCall = create<CallState>((set, get) => ({
  status: 'idle',
  conversationId: null,
  peerName: '',
  direction: null,
  video: false,
  detail: '',
  localStream: null,
  remoteStream: null,
  async start(conversationId, peerName, video) {
    if (get().status === 'ringing' || get().status === 'connecting' || get().status === 'connected') {
      get().hangup();
    }
    const epoch = ++callEpoch;
    iceRestarted = false;
    set({
      status: 'ringing',
      conversationId,
      peerName,
      direction: 'out',
      video,
      detail: '',
      ...clearedMedia(),
    });
    startRing();
    try {
      localStream = await capture(video);
    } catch {
      if (epoch !== callEpoch) return;
      stopMedia();
      set({
        status: 'error',
        conversationId,
        peerName,
        direction: 'out',
        video,
        detail: mediaError(video),
        ...clearedMedia(),
      });
      return;
    }
    if (epoch !== callEpoch) {
      localStream?.getTracks().forEach((track) => track.stop());
      localStream = null;
      return;
    }
    set({ localStream });
    const socket = getSocket();
    try {
      await whenReady();
    } catch {
      if (epoch !== callEpoch) return;
      stopMedia();
      set({
        status: 'error',
        conversationId,
        peerName,
        direction: 'out',
        video,
        detail: 'The server did not respond. Try again.',
        ...clearedMedia(),
      });
      return;
    }
    if (epoch !== callEpoch) return;
    if (!socket?.connected) {
      stopMedia();
      set({
        status: 'error',
        conversationId,
        peerName,
        direction: 'out',
        video,
        detail: 'The server did not respond. Try again.',
        ...clearedMedia(),
      });
      return;
    }
    socket.timeout(8000).emit('call:invite', { conversationId, video }, (error: Error | null, response?: { available?: boolean }) => {
      if (epoch !== callEpoch || get().conversationId !== conversationId || get().direction !== 'out') return;
      if (error) {
        stopMedia();
        set({ status: 'error', detail: 'The server did not respond. Try again.', ...clearedMedia() });
        return;
      }
      if (!response?.available) {
        stopMedia();
        set({ status: 'unavailable', detail: "They're not available for a call.", ...clearedMedia() });
        return;
      }
      set({ status: 'ringing' });
      armRingTimeout();
    });
  },
  async accept() {
    const conversationId = get().conversationId;
    const video = get().video;
    if (!conversationId) return;
    stopRing();
    try {
      localStream = await capture(video);
    } catch {
      getSocket()?.emit('call:reject', { conversationId });
      stopMedia();
      set({ status: 'error', detail: mediaError(video), direction: null, ...clearedMedia() });
      return;
    }
    set({ localStream, status: 'connecting', detail: '' });
    armConnectDeadline(conversationId, connectGiveUpMs);
    getSocket()?.emit('call:accept', { conversationId });
  },
  decline() {
    callEpoch += 1;
    const conversationId = get().conversationId;
    if (conversationId) getSocket()?.emit('call:reject', { conversationId });
    stopMedia();
    set({
      status: 'idle',
      conversationId: null,
      peerName: '',
      direction: null,
      video: false,
      detail: '',
      ...clearedMedia(),
    });
  },
  hangup(detail = '') {
    callEpoch += 1;
    const conversationId = get().conversationId;
    const status = get().status;
    if (conversationId && status !== 'idle' && status !== 'ended' && status !== 'unavailable' && status !== 'error') {
      getSocket()?.emit('call:hangup', { conversationId });
    }
    stopMedia();
    set({
      status: detail ? 'ended' : 'idle',
      detail,
      direction: null,
      video: false,
      conversationId: detail ? conversationId : null,
      peerName: detail ? get().peerName : '',
      ...clearedMedia(),
    });
  },
  showError(detail) {
    callEpoch += 1;
    stopMedia();
    set({
      status: 'error',
      detail,
      direction: null,
      video: false,
      conversationId: null,
      peerName: '',
      ...clearedMedia(),
    });
  },
  bind(socket) {
    const onInvite = (payload: { conversationId: string; fromName: string; video?: boolean }) => {
      const status = get().status;
      if (status === 'ringing' || status === 'connecting' || status === 'connected') return;
      iceRestarted = false;
      set({
        status: 'ringing',
        direction: 'in',
        conversationId: payload.conversationId,
        peerName: payload.fromName,
        video: payload.video === true,
        detail: '',
        ...clearedMedia(),
      });
      startRing();
    };
    const onAccept = async (payload: { conversationId: string }) => {
      if (get().direction !== 'out' || get().conversationId !== payload.conversationId || !localStream) return;
      window.clearTimeout(answerTimer);
      stopRing();
      const conversationId = payload.conversationId;
      set({ status: 'connecting', detail: '' });
      try {
        const connection = attach(conversationId, localStream);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        const sent = await publishDescription(connection, conversationId, 'call:offer');
        if (!sent) return;
        armConnectDeadline(conversationId, connectRetryMs);
      } catch {
        giveUp(conversationId);
      }
    };
    const onOffer = async (payload: { conversationId: string; sdp: RTCSessionDescriptionInit }) => {
      if (get().conversationId !== payload.conversationId || !localStream) return;
      if (peer && !peer.remoteDescription && peer.signalingState !== 'closed') return;
      stopRing();
      const conversationId = payload.conversationId;
      const renegotiate = Boolean(peer && peer.remoteDescription && peer.signalingState !== 'closed');
      set({ status: 'connecting', detail: '' });
      armConnectDeadline(conversationId, renegotiate ? connectRetryMs : connectGiveUpMs);
      try {
        const description = remoteDescription(payload.sdp);
        const connection = renegotiate && peer ? peer : attach(conversationId, localStream);
        await connection.setRemoteDescription(description);
        await flushIce();
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        const sent = await publishDescription(connection, conversationId, 'call:answer');
        if (!sent) return;
        if (renegotiate) iceRestarted = true;
      } catch {
        giveUp(conversationId);
      }
    };
    const onAnswer = async (payload: { conversationId: string; sdp: RTCSessionDescriptionInit }) => {
      if (!peer || get().conversationId !== payload.conversationId) return;
      try {
        await peer.setRemoteDescription(remoteDescription(payload.sdp));
        await flushIce();
      } catch {
        giveUp(payload.conversationId);
      }
    };
    const onIce = (payload: { conversationId: string; candidate: RTCIceCandidateInit }) => {
      if (get().conversationId !== payload.conversationId || !payload.candidate) return;
      void addIce(payload.candidate);
    };
    const onReject = () => {
      stopMedia();
      set({ status: 'ended', detail: 'The call was declined.', direction: null, ...clearedMedia() });
    };
    const onRemoteHangup = () => {
      const failedLink = get().status === 'connecting';
      if (get().status === 'error') return;
      stopMedia();
      set({
        status: failedLink ? 'error' : 'ended',
        detail: failedLink ? connectError : 'Call ended.',
        direction: null,
        ...clearedMedia(),
      });
    };
    socket.on('call:invite', onInvite);
    socket.on('call:accept', onAccept);
    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice', onIce);
    socket.on('call:reject', onReject);
    socket.on('call:hangup', onRemoteHangup);
    return () => {
      socket.off('call:invite', onInvite);
      socket.off('call:accept', onAccept);
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice', onIce);
      socket.off('call:reject', onReject);
      socket.off('call:hangup', onRemoteHangup);
    };
  },
}));
