import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { sql } from '../db.js';
import { authenticateApiKey } from './rooms.js';
import { startRoomComposite, stopEgress } from '../livekit.js';

export default async function recordingRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/v1/rooms/:id/recording/start',
    { preHandler: authenticateApiKey },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const rooms = await sql`SELECT id, status FROM rooms WHERE id = ${id}`;
      if (rooms.length === 0) {
        reply.status(404).send({ error: 'Room not found' });
        return;
      }
      if (rooms[0].status !== 'active') {
        reply.status(409).send({ error: 'Room is not active' });
        return;
      }

      let egressId: string;
      let url: string;
      try {
        const result = await startRoomComposite(id);
        egressId = result.egressId;
        url = result.url;
      } catch (err: any) {
        reply.status(502).send({ error: 'Failed to start egress', detail: err.message });
        return;
      }

      const recordingId = `rec-${uuidv4().slice(0, 8)}`;
      await sql`
        INSERT INTO recordings (id, room_id, egress_id, url, duration_ms)
        VALUES (${recordingId}, ${id}, ${egressId}, ${url}, 0)
      `;

      return { egressId, recordingId, status: 'starting', url };
    }
  );

  fastify.post(
    '/v1/rooms/:id/recording/stop',
    { preHandler: authenticateApiKey },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const rows = await sql`
        SELECT id, egress_id, created_at
        FROM recordings
        WHERE room_id = ${id}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (rows.length === 0) {
        reply.status(409).send({ error: 'No recording to stop for this room' });
        return;
      }

      const row = rows[0];
      try {
        await stopEgress(row.egress_id);
      } catch (err: any) {
        reply.status(502).send({ error: 'Failed to stop egress', detail: err.message });
        return;
      }

      const durationMs = Date.now() - new Date(row.created_at).getTime();
      await sql`UPDATE recordings SET duration_ms = ${durationMs} WHERE id = ${row.id}`;

      return { egressId: row.egress_id, recordingId: row.id, durationMs };
    }
  );
}
