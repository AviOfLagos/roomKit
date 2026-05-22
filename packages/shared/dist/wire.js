"use strict";
/**
 * Wire-level constants and types for the roomKit WebSocket gateway.
 *
 * FROZEN — any change here must be coordinated across every lane.
 * See SWARM.md and docs/call-platform-feasibility.md §3-§5.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.framesIn = exports.isValidAudioFrame = exports.ENDPOINTS = exports.AUDIO = exports.WIRE_VERSION = void 0;
exports.WIRE_VERSION = '0.1.0';
exports.AUDIO = {
    sampleRate: 16_000,
    channels: 1,
    bitsPerSample: 16,
    encoding: 'pcm_s16le',
    frameMs: 20,
    samplesPerFrame: 320,
    bytesPerFrame: 640,
};
exports.ENDPOINTS = {
    agentWs: (roomId, token, stream = 'mixed') => `/v1/rooms/${roomId}/agent?token=${encodeURIComponent(token)}&stream=${stream}`,
    rooms: '/v1/rooms',
    room: (id) => `/v1/rooms/${id}`,
    roomTokens: (id) => `/v1/rooms/${id}/tokens`,
    roomTranscript: (id) => `/v1/rooms/${id}/transcript`,
    roomSummary: (id) => `/v1/rooms/${id}/summary`,
    roomRecording: (id) => `/v1/rooms/${id}/recording`,
    webhooks: '/v1/webhooks/livekit',
};
/**
 * Validate a binary audio frame size against the wire contract.
 * Returns true if length is a positive multiple of bytesPerFrame.
 */
function isValidAudioFrame(byteLength) {
    return byteLength > 0 && byteLength % exports.AUDIO.bytesPerFrame === 0;
}
exports.isValidAudioFrame = isValidAudioFrame;
/**
 * Number of 20 ms frames in a buffer.
 */
function framesIn(byteLength) {
    return Math.floor(byteLength / exports.AUDIO.bytesPerFrame);
}
exports.framesIn = framesIn;
