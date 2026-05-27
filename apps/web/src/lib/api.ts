/**
 * Tiny client helper for the roomKit gateway.
 *
 * All requests go through the Next.js `/v1/*` rewrite, which proxies to
 * `NEXT_PUBLIC_GATEWAY_URL` (default `http://localhost:3000`).
 */

export const API_KEY =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ROOMKIT_API_KEY) || 'dev';

export const LIVEKIT_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_LIVEKIT_URL) ||
  'ws://localhost:7880';

export const GATEWAY_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GATEWAY_URL) ||
  '';  // empty = use the Next.js /v1 rewrite

export type CreateRoomResponse = {
  roomId: string;
  joinUrl: string;
  agentToken?: string;
};

export type TokenResponse = {
  token: string;
  livekitUrl?: string;
};

export type SummaryResponse = {
  summary: string;
  generatedAt?: string;
  durationMs?: number;
};

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function createRoom(body: Record<string, unknown> = {}): Promise<CreateRoomResponse> {
  const res = await fetch('/v1/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(body),
  });
  return jsonOrThrow<CreateRoomResponse>(res);
}

export async function mintHumanToken(
  roomId: string,
  identity: string,
  displayName?: string,
): Promise<TokenResponse> {
  const res = await fetch(`/v1/rooms/${encodeURIComponent(roomId)}/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ role: 'human', identity, displayName }),
  });
  return jsonOrThrow<TokenResponse>(res);
}

export async function fetchSummary(roomId: string): Promise<SummaryResponse | null> {
  const res = await fetch(`/v1/rooms/${encodeURIComponent(roomId)}/summary`, {
    headers: { 'x-api-key': API_KEY },
  });
  if (res.status === 404 || res.status === 202) return null;
  return jsonOrThrow<SummaryResponse>(res);
}

export async function extendRoom(roomId: string): Promise<void> {
  await fetch(`/v1/rooms/${encodeURIComponent(roomId)}/extend`, { method: 'POST' });
}

export async function deleteRoom(roomId: string): Promise<void> {
  await fetch(`/v1/rooms/${encodeURIComponent(roomId)}`, {
    method: 'DELETE',
    headers: { 'x-api-key': API_KEY },
  });
}
