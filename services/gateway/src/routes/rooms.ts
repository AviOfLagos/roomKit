import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../db.js';
import { generateLiveKitToken, forceEndRoom, getRoomServiceClient } from '../livekit.js';
import { v4 as uuidv4 } from 'uuid';

// Authentication helper
export async function authenticateApiKey(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers['x-api-key'];
  if (!apiKey) {
    reply.status(401).send({ error: 'Missing x-api-key header' });
    return;
  }

  const keys = await sql`
    SELECT key FROM api_keys WHERE key = ${apiKey as string}
  `;

  if (keys.length === 0) {
    reply.status(403).send({ error: 'Invalid x-api-key' });
    return;
  }
}

export default async function roomRoutes(fastify: FastifyInstance) {
  // POST /v1/rooms
  fastify.post('/v1/rooms', { preHandler: authenticateApiKey }, async (request, reply) => {
    const body = (request.body || {}) as {
      context?: { systemPrompt?: string; [key: string]: any };
      defaultAgent?: boolean;
      maxParticipants?: number;
    };

    const defaultAgent = body.defaultAgent !== false; // default true
    const maxParticipants = Math.min(body.maxParticipants ?? 10, 10); // default 10, max 10
    const context = body.context || {};

    const roomId = `room-${uuidv4().slice(0, 8)}`;
    const metadata = {
      context,
      defaultAgent,
      maxParticipants,
    };

    // Store in DB
    await sql`
      INSERT INTO rooms (id, status, metadata)
      VALUES (${roomId}, 'active', ${sql.json(metadata)})
    `;

    // Generate web client join URL
    const clientHost = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000';
    const joinUrl = `${clientHost}/room/${roomId}`;

    // Mint an agent token if defaultAgent is true or for custom builder use
    const { token: agentToken } = generateLiveKitToken({
      room: roomId,
      identity: 'custom-agent',
      role: 'agent',
    });

    return {
      roomId,
      joinUrl,
      agentToken,
    };
  });

  // GET /v1/rooms/:id
  fastify.get('/v1/rooms/:id', { preHandler: authenticateApiKey }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const rooms = await sql`
      SELECT id, status, metadata, created_at FROM rooms WHERE id = ${id}
    `;

    if (rooms.length === 0) {
      reply.status(404).send({ error: 'Room not found' });
      return;
    }

    const room = rooms[0];
    let participants: any[] = [];

    // Query active participants from LiveKit if room is active
    if (room.status === 'active') {
      try {
        const client = getRoomServiceClient();
        const lkParticipants = await client.listParticipants(id);
        participants = lkParticipants.map((p) => ({
          identity: p.identity,
          name: p.name,
          joinedAt: new Date(Number(p.joinedAt) * 1000).toISOString(),
        }));
      } catch (err: any) {
        // LiveKit room might not exist yet if no one has joined
      }
    }

    return {
      status: room.status,
      participants,
      createdAt: room.created_at,
    };
  });

  // DELETE /v1/rooms/:id
  fastify.delete('/v1/rooms/:id', { preHandler: authenticateApiKey }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const rooms = await sql`
      SELECT id FROM rooms WHERE id = ${id}
    `;

    if (rooms.length === 0) {
      reply.status(404).send({ error: 'Room not found' });
      return;
    }

    // Update DB status
    await sql`
      UPDATE rooms
      SET status = 'ended', ended_at = NOW()
      WHERE id = ${id}
    `;

    // Terminate in LiveKit
    await forceEndRoom(id);

    return { success: true, message: `Room ${id} terminated` };
  });

  // POST /v1/rooms/:id/tokens
  fastify.post('/v1/rooms/:id/tokens', { preHandler: authenticateApiKey }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as {
      role: 'human' | 'agent';
      identity: string;
      ttlSeconds?: number;
    };

    if (!body.role || !body.identity) {
      reply.status(400).send({ error: 'Missing role or identity' });
      return;
    }

    const { token, expiresAt } = generateLiveKitToken({
      room: id,
      identity: body.identity,
      role: body.role,
      ttlSeconds: body.ttlSeconds,
    });

    return { token, expiresAt };
  });

  // GET /v1/rooms/:id/recording
  fastify.get('/v1/rooms/:id/recording', { preHandler: authenticateApiKey }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const recordings = await sql`
      SELECT url, created_at FROM recordings WHERE room_id = ${id}
    `;

    if (recordings.length === 0) {
      reply.status(404).send({ error: 'No recording found for this room' });
      return;
    }

    // In a real S3 / Cloudflare R2 bucket, we would return a presigned URL with a 15-min TTL.
    // For Phase 1, we can return the direct MinIO URL or standard object store link.
    const recording = recordings[0];
    return {
      url: recording.url,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  });

  // GET /v1/rooms/:id/transcript
  fastify.get('/v1/rooms/:id/transcript', { preHandler: authenticateApiKey }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const chunks = await sql`
      SELECT participant_id as "participantId", display_name as "displayName", role, text, chunk_id as "chunkId", confidence, created_at as "at"
      FROM transcripts
      WHERE room_id = ${id}
      ORDER BY created_at ASC
    `;

    // Deduplicate/extract participant metadata
    const participantsMap = new Map();
    chunks.forEach((c) => {
      participantsMap.set(c.participantId, {
        participantId: c.participantId,
        displayName: c.displayName,
        role: c.role,
      });
    });

    return {
      chunks,
      participants: Array.from(participantsMap.values()),
    };
  });

  // GET /v1/rooms/:id/summary
  fastify.get('/v1/rooms/:id/summary', { preHandler: authenticateApiKey }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const summaries = await sql`
      SELECT markdown, model, generated_at as "generatedAt"
      FROM summaries
      WHERE room_id = ${id}
    `;

    if (summaries.length === 0) {
      reply.status(404).send({ error: 'No summary generated yet' });
      return;
    }

    return summaries[0];
  });
}
