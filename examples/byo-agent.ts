/**
 * roomKit BYO-agent example using `@roomkit/sdk` (Node).
 *
 * Echoes mixed remote audio back after each utterance and logs control events.
 *
 * Run:
 *   pnpm --filter @roomkit/sdk build
 *   node --experimental-strip-types examples/byo-agent.ts <roomId> <gatewayToken>
 */

import { join } from '@roomkit/sdk';

async function main(): Promise<void> {
  const [roomId, token] = process.argv.slice(2);
  if (!roomId || !token) {
    console.error('Usage: byo-agent.ts <roomId> <gatewayToken>');
    process.exit(1);
  }

  const call = await join({ url: 'ws://localhost:3000', room: roomId, token });

  call.events.on('event', async (ev) => {
    console.log(`[event] ${ev.type}`);
    if (ev.type === 'speech.ended') {
      const audio = await call.recv();
      call.send(audio);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
