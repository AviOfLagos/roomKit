/**
 * Wire-level constants and types for the roomKit WebSocket gateway.
 *
 * FROZEN — any change here must be coordinated across every lane.
 * See SWARM.md and docs/call-platform-feasibility.md §3-§5.
 */

export const WIRE_VERSION = '0.1.0' as const;

export const AUDIO = {
  sampleRate: 16_000,
  channels: 1,
  bitsPerSample: 16,
  encoding: 'pcm_s16le' as const,
  frameMs: 20,
  samplesPerFrame: 320,
  bytesPerFrame: 640,
} as const;

export const ENDPOINTS = {
  agentWs: (roomId: string, token: string, stream: 'mixed' | 'per-track' = 'mixed') =>
    `/v1/rooms/${roomId}/agent?token=${encodeURIComponent(token)}&stream=${stream}`,
  rooms: '/v1/rooms',
  room: (id: string) => `/v1/rooms/${id}`,
  roomTokens: (id: string) => `/v1/rooms/${id}/tokens`,
  roomTranscript: (id: string) => `/v1/rooms/${id}/transcript`,
  roomSummary: (id: string) => `/v1/rooms/${id}/summary`,
  roomRecording: (id: string) => `/v1/rooms/${id}/recording`,
  webhooks: '/v1/webhooks/livekit',
} as const;

export type AgentJwtClaims = {
  role: 'agent' | 'human';
  identity: string;
  room: string;
  iat?: number;
  exp?: number;
};

export type StreamMode = 'mixed' | 'per-track';

/**
 * Validate a binary audio frame size against the wire contract.
 * Returns true if length is a positive multiple of bytesPerFrame.
 */
export function isValidAudioFrame(byteLength: number): boolean {
  return byteLength > 0 && byteLength % AUDIO.bytesPerFrame === 0;
}

/**
 * Number of 20 ms frames in a buffer.
 */
export function framesIn(byteLength: number): number {
  return Math.floor(byteLength / AUDIO.bytesPerFrame);
}
