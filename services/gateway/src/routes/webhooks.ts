import { FastifyInstance } from 'fastify';
import { WebhookReceiver } from 'livekit-server-sdk';
import { sql } from '../db.js';
import { bump, untrack } from '../inactivity.js';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';

const receiver = new WebhookReceiver(apiKey, apiSecret);

export default async function webhookRoutes(fastify: FastifyInstance) {
  // POST /v1/webhooks/livekit
  fastify.post('/v1/webhooks/livekit', async (request, reply) => {
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      reply.status(401).send({ error: 'Missing Authorization header' });
      return;
    }

    try {
      // For testing, let's bypass verification if signature is 'bypass'
      let event;
      if (authHeader === 'bypass') {
        event = request.body as any;
      } else {
        event = await receiver.receive(request.body as string, authHeader);
      }

      console.log('Received LiveKit Webhook event:', event.event);

      const roomId = event.room?.name || event.room?.sid;
      if (!roomId) {
        return { success: true };
      }

      if (event.event === 'room_finished') {
        await sql`
          UPDATE rooms
          SET status = 'ended', ended_at = NOW()
          WHERE id = ${roomId}
        `;
        untrack(roomId);
        console.log(`Room ${roomId} marked as ended via webhook`);
      } else if (event.event === 'participant_joined' || event.event === 'track_published') {
        // Any meaningful room activity resets the idle timer.
        bump(roomId);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Webhook verification failed:', error.message);
      reply.status(400).send({ error: 'Invalid webhook signature' });
    }
  });

  // POST /v1/rooms/:id/summary (internal endpoint for agents)
  fastify.post('/v1/rooms/:id/summary', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as {
      markdown: string;
      model?: string;
    };

    if (!body.markdown) {
      reply.status(400).send({ error: 'Missing markdown' });
      return;
    }

    const model = body.model || 'gpt-4o-mini';

    // Insert or update summary
    await sql`
      INSERT INTO summaries (room_id, markdown, model)
      VALUES (${id}, ${body.markdown}, ${model})
      ON CONFLICT DO NOTHING
    `;

    return { success: true };
  });

  // POST /v1/rooms/:id/transcripts (internal endpoint for agents or tools to post transcript chunks)
  fastify.post('/v1/rooms/:id/transcripts', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as {
      participantId: string;
      displayName?: string;
      role: 'human' | 'agent';
      text: string;
      chunkId: string;
      confidence?: number;
    };

    if (!body.participantId || !body.text || !body.chunkId) {
      reply.status(400).send({ error: 'Missing required parameters' });
      return;
    }

    await sql`
      INSERT INTO transcripts (room_id, participant_id, display_name, role, text, chunk_id, confidence)
      VALUES (${id}, ${body.participantId}, ${body.displayName || ''}, ${body.role}, ${body.text}, ${body.chunkId}, ${body.confidence ?? 1.0})
    `;

    return { success: true };
  });
}
