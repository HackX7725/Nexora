import { useState, type FormEvent } from 'react';
import AgoraRTC, {
  AgoraRTCProvider,
  LocalUser,
  RemoteUser,
  useJoin,
  useLocalMicrophoneTrack,
  usePublish,
  useRemoteUsers,
} from 'agora-rtc-react';

const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
const UID_MAX = 4_294_967_295;

type VoiceSetup = {
  appId: string;
  channel: string;
  token: string;
  uid: number;
};

function parseUid(value: string): number | null {
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  const uid = Number(trimmed);
  if (!Number.isInteger(uid) || uid > UID_MAX) return null;
  return uid;
}

function ActiveVoiceCall({ setup, onLeave }: { setup: VoiceSetup; onLeave: () => void }) {
  const [micOn, setMicOn] = useState(true);
  const { localMicrophoneTrack, error: micError } = useLocalMicrophoneTrack(micOn);
  const join = useJoin(
    {
      appid: setup.appId,
      channel: setup.channel,
      token: setup.token,
      uid: setup.uid,
    },
    true,
  );
  usePublish([localMicrophoneTrack]);
  const remoteUsers = useRemoteUsers();
  const problem = join.error?.message || micError?.message;
  const hearing = remoteUsers.filter((user) => Boolean(user.audioTrack)).length;

  return (
    <section className="stage voice-stage">
      {problem ? <p className="banner">{problem}</p> : null}
      <div className="tile">
        <LocalUser audioTrack={localMicrophoneTrack} micOn={micOn} playAudio={false} />
        <div className="tile-fallback">{micOn ? 'Microphone live' : 'Microphone muted'}</div>
        <span>{micOn ? `You · ${setup.uid}` : `You · ${setup.uid} · muted`}</span>
      </div>
      <ul className="voice-roster">
        <li>
          <span>Channel {setup.channel}</span>
          <span>{join.isConnected ? 'In the call' : 'Joining…'}</span>
        </li>
        <li>
          <span>Remote audio</span>
          <span>{hearing === 0 ? 'Waiting for another microphone' : `${hearing} publishing`}</span>
        </li>
        {remoteUsers.map((user) => (
          <li key={String(user.uid)}>
            <RemoteUser user={user} playAudio playVideo={false} />
            <span>UID {String(user.uid)}</span>
            <span>{user.audioTrack ? 'Audio on' : 'No audio yet'}</span>
          </li>
        ))}
      </ul>
      <div className="controls">
        <button type="button" className={micOn ? 'on' : ''} onClick={() => setMicOn((value) => !value)}>
          {micOn ? 'Mute' : 'Unmute'}
        </button>
        <button type="button" onClick={onLeave}>Leave</button>
      </div>
    </section>
  );
}

function VoiceSetupForm() {
  const [appId, setAppId] = useState(import.meta.env.VITE_AGORA_APP_ID ?? '');
  const [channel, setChannel] = useState('nexora-voice');
  const [uid, setUid] = useState('1001');
  const [token, setToken] = useState('');
  const [setup, setSetup] = useState<VoiceSetup | null>(null);
  const [formError, setFormError] = useState('');

  function joinCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUid = parseUid(uid);
    const nextAppId = appId.trim();
    const nextChannel = channel.trim();
    const nextToken = token.trim();
    if (!/^[a-fA-F0-9]{32}$/.test(nextAppId)) {
      setFormError('Enter the App ID from the selected Agora project.');
      return;
    }
    if (!nextChannel || nextChannel.length > 64) {
      setFormError('Use a channel name between 1 and 64 characters. Both windows must use the same name.');
      return;
    }
    if (nextUid === null) {
      setFormError('Use a numeric RTC UID from 1 through 4294967295. Each window needs a different UID.');
      return;
    }
    if (!nextToken) {
      setFormError('Paste a Console temporary token generated for this channel and this UID.');
      return;
    }
    setFormError('');
    setSetup({ appId: nextAppId, channel: nextChannel, token: nextToken, uid: nextUid });
  }

  if (setup) {
    return <ActiveVoiceCall setup={setup} onLeave={() => setSetup(null)} />;
  }

  return (
    <main className="voice-lab">
      <header>
        <p className="brand">Nexora</p>
        <h1>Voice call</h1>
      </header>
      <section className="panel">
        <p className="lede">
          Audio only. Both people publish and subscribe in the same channel. There is no camera.
        </p>
        <ol className="voice-steps">
          <li>Open this page in two separate windows, such as a normal window and a private window.</li>
          <li>Keep the same App ID and the same channel. Give each window a different UID, such as 1001 and 1002.</li>
          <li>In Agora Console, open project nexora, then Manage credentials, then Generate Temp Token. Create one token per UID, using that same channel name.</li>
          <li>Paste each token into the matching window, choose Join, and allow the microphone.</li>
          <li>Confirm you can hear the other window. Mute, unmute, then Leave from each window.</li>
        </ol>
        <form onSubmit={joinCall}>
          {formError ? <p className="banner">{formError}</p> : null}
          <label className="field">
            <span>App ID</span>
            <input value={appId} onChange={(event) => setAppId(event.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <label className="field">
            <span>Channel</span>
            <input value={channel} onChange={(event) => setChannel(event.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <label className="field">
            <span>RTC UID</span>
            <input value={uid} onChange={(event) => setUid(event.target.value)} inputMode="numeric" autoComplete="off" />
          </label>
          <label className="field">
            <span>Temporary token</span>
            <textarea value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <button className="button" type="submit">Join</button>
        </form>
        <p className="lede">
          A temporary token is only for this check. A production call should take tokens from the trusted server, renew them before they expire, and keep the App Certificate on that server.
        </p>
      </section>
    </main>
  );
}

export default function VoiceCall() {
  return (
    <AgoraRTCProvider client={client}>
      <VoiceSetupForm />
    </AgoraRTCProvider>
  );
}
