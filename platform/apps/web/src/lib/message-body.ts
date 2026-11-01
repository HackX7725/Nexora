export type MessageBody =
  | { kind: 'text'; text: string }
  | { kind: 'image'; dataUrl: string }
  | { kind: 'audio'; dataUrl: string };

const maxCiphertext = 1_500_000;

export function encodeBody(body: MessageBody) {
  if (body.kind === 'text') return body.text;
  return JSON.stringify(body);
}

export function decodeBody(ciphertext: string): MessageBody {
  if (ciphertext.startsWith('{"kind":')) {
    try {
      const parsed = JSON.parse(ciphertext) as { kind?: string; dataUrl?: string };
      if ((parsed.kind === 'image' || parsed.kind === 'audio') && typeof parsed.dataUrl === 'string' && parsed.dataUrl.startsWith('data:')) {
        return { kind: parsed.kind, dataUrl: parsed.dataUrl };
      }
    } catch {
      // Older messages are plain text, including text that happens to look like JSON.
    }
  }
  return { kind: 'text', text: ciphertext };
}

export function previewText(ciphertext: string) {
  const body = decodeBody(ciphertext);
  if (body.kind === 'image') return 'Photo';
  if (body.kind === 'audio') return 'Voice note';
  return body.text;
}

export function withinLimit(ciphertext: string) {
  return ciphertext.length <= maxCiphertext;
}
