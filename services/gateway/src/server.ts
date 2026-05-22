import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import roomRoutes from './routes/rooms.js';
import webhookRoutes from './routes/webhooks.js';
import { setupWebSocketBridge } from './gateway/ws-bridge.js';
import dotenv from 'dotenv';

dotenv.config();

const port = parseInt(process.env.PORT || '3000', 10);

const fastify = Fastify({
  logger: true,
});

// Setup CORS
await fastify.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
});

// Setup WebSockets
await fastify.register(websocket, {
  options: {
    maxPayload: 1048576, // 1MB payload limit
  }
});

// Custom body parser to allow raw body for webhook verification if needed
// LiveKit webhook verification can sometimes use raw body string
fastify.addContentTypeParser('application/webhook+json', { parseAs: 'string' }, (_req, body, done) => {
  done(null, body);
});

// Register WebSockets and HTTP APIs
await fastify.register(async (instance) => {
  // Bind WebSocket bridge
  setupWebSocketBridge(instance);
});

await fastify.register(roomRoutes);
await fastify.register(webhookRoutes);

const start = async () => {
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Gateway Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
