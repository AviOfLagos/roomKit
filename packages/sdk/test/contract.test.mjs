import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AUDIO } from '../../shared/dist/wire.js';
import { createSimulatedRoom } from '../dist/index.js';

const FRAME = Buffer.alloc(AUDIO.bytesPerFrame, 0);

test('wire contract: AUDIO.bytesPerFrame === 640', () => {
  assert.equal(AUDIO.bytesPerFrame, 640);
  assert.equal(AUDIO.samplesPerFrame, 320);
  assert.equal(AUDIO.sampleRate, 16_000);
});

test('SimulatedRoom replays scripted events then yields a 640-byte frame', async () => {
  const call = createSimulatedRoom({
    script: [
      {
        event: {
          type: 'room.joined',
          participantId: 'agent-sim',
          role: 'agent',
          at: 1,
        },
      },
      {
        event: {
          type: 'speech.ended',
          participantId: 'human-sim',
          at: 2,
        },
      },
      { frame: FRAME },
    ],
  });

  try {
    const first = await new Promise((resolve) => call.events.once('event', resolve));
    assert.equal(first.type, 'room.joined');
    assert.equal(first.participantId, 'agent-sim');

    const second = await new Promise((resolve) => call.events.once('event', resolve));
    assert.equal(second.type, 'speech.ended');

    const frame = await call.recv();
    assert.ok(Buffer.isBuffer(frame), 'recv() must return a Buffer');
    assert.equal(frame.byteLength, 640);
  } finally {
    call.close();
  }
});

test('SimulatedRoom.send accepts 640-byte frame and rejects bad sizes', () => {
  const call = createSimulatedRoom({ script: [] });
  try {
    let seen = null;
    call.events.on('sent', (b) => { seen = b; });
    call.send(FRAME);
    assert.ok(Buffer.isBuffer(seen));
    assert.equal(seen.byteLength, 640);

    assert.throws(() => call.send(Buffer.alloc(7)), /not a positive multiple of 640/);
  } finally {
    call.close();
  }
});

test('SimulatedRoom recv() after close rejects', async () => {
  const call = createSimulatedRoom({ script: [] });
  call.close();
  await assert.rejects(() => call.recv(), /closed/);
});
