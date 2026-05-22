/**
 * Wire-level constants and types for the roomKit WebSocket gateway.
 *
 * FROZEN — any change here must be coordinated across every lane.
 * See SWARM.md and docs/call-platform-feasibility.md §3-§5.
 */
export declare const WIRE_VERSION: "0.1.0";
export declare const AUDIO: {
    readonly sampleRate: 16000;
    readonly channels: 1;
    readonly bitsPerSample: 16;
    readonly encoding: "pcm_s16le";
    readonly frameMs: 20;
    readonly samplesPerFrame: 320;
    readonly bytesPerFrame: 640;
};
export declare const ENDPOINTS: {
    readonly agentWs: (roomId: string, token: string, stream?: 'mixed' | 'per-track') => string;
    readonly rooms: "/v1/rooms";
    readonly room: (id: string) => string;
    readonly roomTokens: (id: string) => string;
    readonly roomTranscript: (id: string) => string;
    readonly roomSummary: (id: string) => string;
    readonly roomRecording: (id: string) => string;
    readonly webhooks: "/v1/webhooks/livekit";
};
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
export declare function isValidAudioFrame(byteLength: number): boolean;
/**
 * Number of 20 ms frames in a buffer.
 */
export declare function framesIn(byteLength: number): number;
