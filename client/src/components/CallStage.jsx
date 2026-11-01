import { useEffect, useMemo, useRef, useState } from 'react';
import AgoraRTC, {
  AgoraRTCProvider,
  LocalVideoTrack,
  RemoteUser,
  useClientEvent,
  useJoin,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  usePublish,
  useRTCClient,
  useRemoteUsers,
} from 'agora-rtc-react';

const SCREEN_UID_OFFSET = 2000000000;

function decodeSalt(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function labelFor(uid, roster, selfUid) {
  const numeric = Number(uid);
  const screen = numeric >= SCREEN_UID_OFFSET;
  const personUid = screen ? numeric - SCREEN_UID_OFFSET : numeric;
  const person = roster.find((member) => member.agoraUid === personUid);
  const name = person?.name || 'Guest';
  if (screen) return personUid === Number(selfUid) ? 'Your screen' : `${name}'s screen`;
  return name;
}

function LiveCall({ roomId, mode, rtc, roster, onRenew }) {
  const client = useRTCClient();
  const screenClient = useMemo(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }), []);
  const [ready, setReady] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(mode === 'video');
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState('');
  const screenTrackRef = useRef(null);
  const previousToken = useRef(rtc.rtcToken);
  const join = useJoin(
    { appid: rtc.appId, channel: rtc.channel, token: rtc.rtcToken, uid: rtc.uid },
    ready,
    client,
  );
  const { localMicrophoneTrack, error: micError } = useLocalMicrophoneTrack(ready);
  const { localCameraTrack, error: cameraError } = useLocalCameraTrack(ready && mode === 'video');
  usePublish(
    [localMicrophoneTrack, mode === 'video' ? localCameraTrack : null],
    ready,
    client,
  );
  const remoteUsers = useRemoteUsers(client);

  useEffect(() => {
    client.setEncryptionConfig('aes-256-gcm2', rtc.encryption.key, decodeSalt(rtc.encryption.salt));
    setReady(true);
  }, [client, rtc.encryption.key, rtc.encryption.salt]);

  useEffect(() => {
    localMicrophoneTrack?.setEnabled(micOn);
  }, [localMicrophoneTrack, micOn]);

  useEffect(() => {
    localCameraTrack?.setEnabled(cameraOn);
  }, [localCameraTrack, cameraOn]);

  useEffect(() => () => {
    screenTrackRef.current?.close();
    screenClient.leave().catch(() => {});
  }, [screenClient]);

  useClientEvent(client, 'token-privilege-will-expire', onRenew);

  useEffect(() => {
    if (!join.isConnected || previousToken.current === rtc.rtcToken) return;
    previousToken.current = rtc.rtcToken;
    client.renewToken(rtc.rtcToken).catch(() => {});
  }, [client, join.isConnected, rtc.rtcToken]);

  useEffect(() => {
    const onExpire = () => onRenew();
    screenClient.on('token-privilege-will-expire', onExpire);
    return () => screenClient.off('token-privilege-will-expire', onExpire);
  }, [onRenew, screenClient]);

  async function toggleShare() {
    setStatus('');
    if (sharing) {
      screenTrackRef.current?.close();
      screenTrackRef.current = null;
      await screenClient.leave().catch(() => {});
      setSharing(false);
      return;
    }
    try {
      screenClient.setEncryptionConfig('aes-256-gcm2', rtc.encryption.key, decodeSalt(rtc.encryption.salt));
      await screenClient.join(rtc.appId, rtc.channel, rtc.screenToken, rtc.screenUid);
      const track = await AgoraRTC.createScreenVideoTrack(
        { encoderConfig: '1080p_1', optimizationMode: 'detail' },
        'disable',
      );
      const videoTrack = Array.isArray(track) ? track[0] : track;
      videoTrack.on('track-ended', () => {
        videoTrack.close();
        screenTrackRef.current = null;
        screenClient.leave().catch(() => {});
        setSharing(false);
      });
      await screenClient.publish(videoTrack);
      screenTrackRef.current = videoTrack;
      setSharing(true);
    } catch (error) {
      await screenClient.leave().catch(() => {});
      if (error?.code !== 'PERMISSION_DENIED') {
        setStatus(error?.message || 'Screen share did not start.');
      }
    }
  }

  const problem = join.error?.message || micError?.message || cameraError?.message || status;

  return (
    <div className="stage">
      {problem ? <p className="banner">{problem}</p> : null}
      <div className="video-grid">
        <article className="tile">
          {mode === 'video' && cameraOn && localCameraTrack ? (
            <LocalVideoTrack track={localCameraTrack} play />
          ) : (
            <div className="tile-fallback">{mode === 'voice' ? 'Voice' : 'Camera off'}</div>
          )}
          <span>{micOn ? 'You' : 'You · muted'}</span>
        </article>
        {remoteUsers.map((user) => (
          <article className="tile" key={user.uid}>
            <RemoteUser user={user} playVideo={mode === 'video'} playAudio />
            <span>{labelFor(user.uid, roster, rtc.uid)}</span>
          </article>
        ))}
      </div>
      <div className="controls">
        <button type="button" className={micOn ? 'on' : ''} onClick={() => setMicOn((value) => !value)}>
          {micOn ? 'Mute' : 'Unmute'}
        </button>
        {mode === 'video' ? (
          <button type="button" className={cameraOn ? 'on' : ''} onClick={() => setCameraOn((value) => !value)}>
            {cameraOn ? 'Camera off' : 'Camera on'}
          </button>
        ) : null}
        {mode === 'video' ? (
          <button type="button" className={sharing ? 'on' : ''} onClick={toggleShare}>
            {sharing ? 'Stop sharing' : 'Share screen'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function CallStage({ roomId, mode, rtc, roster, onRenew }) {
  const client = useMemo(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }), []);
  if (!rtc) {
    return (
      <div className="stage">
        <div className="stage-empty">
          <h2>{mode === 'voice' ? 'Voice room' : 'Video room'}</h2>
          <p>Add AGORA_APP_ID and AGORA_APP_CERTIFICATE on the server to open video, voice, and screen share.</p>
        </div>
      </div>
    );
  }
  return (
    <AgoraRTCProvider client={client}>
      <LiveCall roomId={roomId} mode={mode} rtc={rtc} roster={roster} onRenew={onRenew} />
    </AgoraRTCProvider>
  );
}
