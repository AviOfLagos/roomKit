import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { sql } from '../db.js';
import { authenticateApiKey } from './rooms.js';
import { generateLiveKitToken } from '../livekit.js';
import type { AgentJwtClaims } from '@roomkit/shared/wire';

dotenv.config();

const roomkitApiKey = process.env.ROOMKIT_API_KEY || 'dev';

export default async function tokenRoutes(fastify: FastifyInstance) {
  // POST /v1/rooms/:id/tokens/sign — tenant-scoped DUAL token mint
  // Distinct from existing POST /v1/rooms/:id/tokens in routes/rooms.ts which
  // mints only a LiveKit token without tenant scoping.
  fastify.post(
    '/v1/rooms/:id/tokens/sign',
    { preHandler: authenticateApiKey },
    async (request, reply) => {
      const { id: roomId } = request.params as { id: string };
      const body = (request.body || {}) as {
        role: 'agent' | 'human';
        identity: string;
        ttlSeconds?: number;
      };

      if (!body.role || !body.identity) {
        reply.status(400).send({ error: 'Missing role or identity' });
        return;
      }

      const apiKeyHeader = request.headers['x-api-key'] as string;

      const apiKeyRows =
        await sql`SELECT tenant_id FROM api_keys WHERE key = ${apiKeyHeader}`;
      if (apiKeyRows.length === 0 || !apiKeyRows[0].tenant_id) {
        reply.status(403).send({ error: 'API key not linked to a tenant' });
        return;
      }
      const tenantId = apiKeyRows[0].tenant_id;

      const roomRows = await sql`SELECT tenant_id FROM rooms WHERE id = ${roomId}`;
      if (roomRows.length === 0) {
        reply.status(404).send({ error: 'Room not found' });
        return;
      }
      if (roomRows[0].tenant_id && roomRows[0].tenant_id !== tenantId) {
        reply.status(403).send({ error: 'Room does not belong to caller tenant' });
        return;
      }

      const ttlSeconds = body.ttlSeconds ?? 14400;

      const claims: AgentJwtClaims = {
        role: body.role,
        identity: body.identity,
        room: roomId,
      };
      const gatewayToken = jwt.sign(claims, roomkitApiKey, { expiresIn: ttlSeconds });

      const { token: livekitToken, expiresAt } = generateLiveKitToken({
        room: roomId,
        identity: body.identity,
        role: body.role,
        ttlSeconds,
      });

      return { gatewayToken, livekitToken, expiresAt };
    }
  );

  fastify.get(
    '/v1/tenants/me',
    { preHandler: authenticateApiKey },
    async (request, reply) => {
      const apiKeyHeader = request.headers['x-api-key'] as string;
      const rows = await sql`
        SELECT t.id, t.name, t.created_at
        FROM tenants t
        JOIN api_keys k ON k.tenant_id = t.id
        WHERE k.key = ${apiKeyHeader}
      `;
      if (rows.length === 0) {
        reply.status(404).send({ error: 'No tenant linked to api key' });
        return;
      }
      const row = rows[0];
      return { tenantId: row.id, name: row.name, createdAt: row.created_at };
    }
  );
}
