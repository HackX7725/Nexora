export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  user: SessionUser;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  user: SessionUser;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function readMessage(body: unknown) {
  if (!body || typeof body !== 'object' || !('message' in body)) return 'Request failed.';
  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) return message.map(String).join(' ');
  if (typeof message === 'string' && message.trim()) return message;
  return 'Request failed.';
}
