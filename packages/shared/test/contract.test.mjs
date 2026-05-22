import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO, ENDPOINTS, WIRE_VERSION, isValidAudioFrame, framesIn } from '../dist/wire.js';

test('wire version is frozen at 0.1.0', () => {
  assert.equal(WIRE_VERSION, '0.1.0');
});

test('audio frame is 16k mono int16 LE, 20 ms, 640 bytes', () => {
  assert.equal(AUDIO.sampleRate, 16_000);
  assert.equal(AUDIO.channels, 1);
  assert.equal(AUDIO.bitsPerSample, 16);
  assert.equal(AUDIO.encoding, 'pcm_s16le');
  assert.equal(AUDIO.frameMs, 20);
  assert.equal(AUDIO.samplesPerFrame, 320);
  assert.equal(AUDIO.bytesPerFrame, 640);
});

test('isValidAudioFrame accepts positive multiples of 640', () => {
  assert.equal(isValidAudioFrame(640), true);
  assert.equal(isValidAudioFrame(1280), true);
  assert.equal(isValidAudioFrame(640 * 50), true);
});

test('isValidAudioFrame rejects zero, non-multiples, and tiny frames', () => {
  assert.equal(isValidAudioFrame(0), false);
  assert.equal(isValidAudioFrame(320), false);
  assert.equal(isValidAudioFrame(641), false);
  assert.equal(isValidAudioFrame(639), false);
});

test('framesIn counts 20 ms frames', () => {
  assert.equal(framesIn(640), 1);
  assert.equal(framesIn(640 * 50), 50);
  assert.equal(framesIn(0), 0);
});

test('endpoint paths are stable', () => {
  assert.equal(ENDPOINTS.rooms, '/v1/rooms');
  assert.equal(ENDPOINTS.room('r1'), '/v1/rooms/r1');
  assert.equal(ENDPOINTS.roomTokens('r1'), '/v1/rooms/r1/tokens');
  assert.equal(ENDPOINTS.roomTranscript('r1'), '/v1/rooms/r1/transcript');
  assert.equal(ENDPOINTS.roomSummary('r1'), '/v1/rooms/r1/summary');
  assert.equal(ENDPOINTS.roomRecording('r1'), '/v1/rooms/r1/recording');
  assert.equal(ENDPOINTS.webhooks, '/v1/webhooks/livekit');
});

test('agent WS url defaults to mixed stream', () => {
  const url = ENDPOINTS.agentWs('r1', 'jwt_abc');
  assert.equal(url, '/v1/rooms/r1/agent?token=jwt_abc&stream=mixed');
});

test('agent WS url supports per-track stream', () => {
  const url = ENDPOINTS.agentWs('r1', 'jwt_abc', 'per-track');
  assert.equal(url, '/v1/rooms/r1/agent?token=jwt_abc&stream=per-track');
});

test('agent WS url url-encodes token', () => {
  const url = ENDPOINTS.agentWs('r1', 'jwt with spaces&extra=1');
  assert.ok(url.includes('jwt%20with%20spaces%26extra%3D1'));
});
