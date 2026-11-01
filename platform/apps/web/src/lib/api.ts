import type { AuthResult } from './session';
import { ApiError, readMessage } from './session';
import { useSession } from '../stores/session-store';

export { ApiError };

const baseUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const objectIdPattern = /^[0-9a-f]{24}$/i;

function savedDeviceId() {
  const deviceId = useSession.getState().deviceId();
  return deviceId && objectIdPattern.test(deviceId) ? deviceId : undefined;
}

let refreshRequest: Promise<boolean> | null = null;

export async function api<T>(path: string, init: RequestInit = {}, allowRefresh = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const accessToken = useSession.getState().session?.accessToken;
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'The server did not respond. Try again.');
  }

  if (response.status === 401 && allowRefresh && useSession.getState().session?.refreshToken && !path.endsWith('/auth/refresh')) {
    const refreshed = await refreshOnce();
    if (refreshed) return api<T>(path, init, false);
    useSession.getState().clear();
    throw new ApiError(401, 'Sign in required.');
  }

  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, readMessage(data));
  return data as T;
}

export interface LoginChallenge {
  requiresVerification: true;
  challengeId: string;
  maskedEmail: string;
  resendAvailableIn: number;
}

export async function login(identifier: string, password: string): Promise<LoginChallenge> {
  const data = await api<Partial<LoginChallenge>>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: identifier.trim(),
      password,
      deviceId: savedDeviceId(),
      deviceName: 'This browser',
      platform: 'WEB',
    }),
  }, false);
  if (!data.requiresVerification || !data.challengeId || !data.maskedEmail) {
    throw new ApiError(500, 'The server did not start verification.');
  }
  return {
    requiresVerification: true,
    challengeId: data.challengeId,
    maskedEmail: data.maskedEmail,
    resendAvailableIn: data.resendAvailableIn ?? 60,
  };
}

export async function verifyLogin(challengeId: string, code: string): Promise<AuthResult> {
  const data = await api<AuthResult>('/api/v1/auth/verify-login', {
    method: 'POST',
    body: JSON.stringify({ challengeId, code }),
  }, false);
  if (!data.accessToken || !data.refreshToken || !data.deviceId || !data.user) {
    throw new ApiError(500, 'The server did not return an account.');
  }
  return data;
}

export async function resendLoginCode(challengeId: string) {
  return api<{ resendAvailableIn: number }>('/api/v1/auth/resend-login-code', {
    method: 'POST',
    body: JSON.stringify({ challengeId }),
  }, false);
}

export async function registerAccount(input: {
  username: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<AuthResult> {
  const phone = normalizePhone(input.phone || '');
  const data = await api<AuthResult>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: input.username.trim().toLowerCase(),
      email: input.email.trim(),
      password: input.password,
      ...(phone ? { phone } : {}),
      deviceName: 'This browser',
      platform: 'WEB',
    }),
  }, false);
  if (!data.user) throw new ApiError(500, 'The server did not return an account.');
  return data;
}

function normalizePhone(value: string) {
  const raw = value.trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  return raw.startsWith('+') ? `+${digits}` : digits;
}

export async function logout() {
  const current = useSession.getState().session?.accessToken;
  if (current) {
    try {
      let token = current;
      let response = await fetch(`${baseUrl()}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401 && await refreshOnce()) {
        token = useSession.getState().session?.accessToken || '';
        if (token) {
          response = await fetch(`${baseUrl()}/api/v1/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }
    } catch {
      // Local sign-out still proceeds when the API cannot be reached.
    }
  }
  useSession.getState().clear();
}

export function refreshAccess() {
  return refreshOnce();
}

async function refreshOnce() {
  if (!refreshRequest) {
    refreshRequest = refreshSession().finally(() => {
      refreshRequest = null;
    });
  }
  return refreshRequest;
}

async function refreshSession() {
  const refreshToken = useSession.getState().session?.refreshToken;
  if (!refreshToken) return false;
  try {
    const response = await fetch(`${baseUrl()}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;
    const data = await response.json() as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken || !data.refreshToken) return false;
    useSession.getState().updateTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export interface DirectoryPerson {
  id: string;
  username: string;
  displayName: string;
}

export interface SavedContact {
  userId: string;
  username: string;
  displayName: string;
  createdAt: string;
}

export function searchPeople(query: string) {
  return api<{ users: DirectoryPerson[] }>(`/api/v1/users/search?q=${encodeURIComponent(query)}`).then((data) => data.users);
}

export function listContacts() {
  return api<{ contacts: SavedContact[] }>('/api/v1/contacts');
}

export function addContact(username: string) {
  return api<SavedContact>('/api/v1/contacts', {
    method: 'POST',
    body: JSON.stringify({ username: username.trim().toLowerCase() }),
  });
}

export function removeContact(userId: string) {
  return api<{ status: string }>(`/api/v1/contacts/${userId}`, { method: 'DELETE' });
}
