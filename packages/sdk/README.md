# @roomkit/sdk

Public Node/TypeScript SDK for roomKit. Two products on one surface
(`Call = { recv, send, events, close }`):

## Real gateway

```ts
import { join } from '@roomkit/sdk';

const call = await join({
  url: 'ws://localhost:3000',
  room: 'r_abc',
  token: 'jwt_...',
});

call.events.on('speech.ended', async () => {
  const audio = await call.recv();        // Buffer, 16k mono int16 LE
  call.send(await myLlmAndTts(audio));    // same format back
});
```

## Deterministic in-process sim (zero network, zero `ws` dep at runtime)

```ts
import { createSimulatedRoom, AUDIO } from '@roomkit/sdk';

const sim = createSimulatedRoom({
  script: [
    { event: { type: 'room.joined', participantId: 'a', role: 'agent', at: 0 } },
    { event: { type: 'speech.ended', participantId: 'h', at: 1 } },
    { frame: Buffer.alloc(AUDIO.bytesPerFrame) },
  ],
});
```
