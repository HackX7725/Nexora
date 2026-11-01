let audio: AudioContext | null = null;

function tone(context: AudioContext, frequency: number, start: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.05, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.2);
}

export function playMessageBeep() {
  const context = audio || new AudioContext();
  audio = context;
  void context.resume();
  const start = context.currentTime;
  tone(context, 880, start);
  tone(context, 1175, start + 0.16);
}

export async function announceMessage(title: string, body: string) {
  try {
    playMessageBeep();
  } catch {
    // A blocked sound still leaves the on-screen notice.
  }
  if (!document.hidden || typeof Notification === 'undefined') return;
  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return;
  const notice = new Notification(title, { body });
  notice.onclick = () => {
    window.focus();
    notice.close();
  };
}
