import { SocketStream } from '@fastify/websocket';
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { generateLiveKitToken } from '../livekit.js';
import dotenv from 'dotenv';

dotenv.config();

const roomkitApiKey = process.env.ROOMKIT_API_KEY || 'dev';

interface BridgeSession {
  roomId: string;
  clientSocket: SocketStream;
  bridgeSocket: SocketStream | null;
  childProcess: ChildProcess;
  pendingData: Array<{ isBinary: boolean; data: any }>;
}

// Active session store
const activeBridges = new Map<string, BridgeSession>();

export function setupWebSocketBridge(fastify: any) {
  // 1. External Builder Ingress WebSocket
  // wss://<host>/v1/rooms/:id/agent?token=<jwt-with-role=agent>
  fastify.get('/v1/rooms/:id/agent', { websocket: true }, async (connection: SocketStream, req: any) => {
    const { id: roomId } = req.params;
    const token = req.query.token;

    if (!token) {
      connection.socket.send(JSON.stringify({ type: 'error', code: 'auth.missing_token', message: 'Missing token query parameter', recoverable: false }));
      connection.socket.close();
      return;
    }

    try {
      // Decode and verify JWT token (signed with ROOMKIT_API_KEY)
      const decoded = jwt.verify(token, roomkitApiKey) as { role: string; identity: string };
      if (decoded.role !== 'agent') {
        connection.socket.send(JSON.stringify({ type: 'error', code: 'auth.invalid_role', message: 'Token must have role=agent', recoverable: false }));
        connection.socket.close();
        return;
      }

      const bridgeId = uuidv4();
      const identity = decoded.identity || `byo-agent-${uuidv4().slice(0, 4)}`;

      // Generate LiveKit token for this agent
      const { token: lkToken } = generateLiveKitToken({
        room: roomId,
        identity,
        role: 'agent',
      });

      // Spawn local Python WebRTC to WS bridge
      const scriptPath = 'src/gateway/livekit_bridge.py';
      const localWsUrl = `ws://localhost:${process.env.PORT || 3000}/bridge/${bridgeId}`;
      
      console.log(`[Bridge Ingress] Spawning Python bridge. ID: ${bridgeId}, Room: ${roomId}, localWs: ${localWsUrl}`);
      const pyProcess = spawn('python3', [
        scriptPath,
        '--room', roomId,
        '--token', lkToken,
        '--local-ws', localWsUrl
      ]);

      // Create session
      const session: BridgeSession = {
        roomId,
        clientSocket: connection,
        bridgeSocket: null,
        childProcess: pyProcess,
        pendingData: [],
      };

      activeBridges.set(bridgeId, session);

      // Log subprocess output
      pyProcess.stdout?.on('data', (data) => {
        console.log(`[Bridge Python stdout ${bridgeId}]: ${data.toString().trim()}`);
      });

      pyProcess.stderr?.on('data', (data) => {
        console.error(`[Bridge Python stderr ${bridgeId}]: ${data.toString().trim()}`);
      });

      pyProcess.on('close', (code) => {
        console.log(`[Bridge Python exit ${bridgeId}]: code ${code}`);
        cleanupSession(bridgeId);
      });

      // Listen for data from client
      connection.socket.on('message', (message, isBinary) => {
        if (session.bridgeSocket) {
          session.bridgeSocket.socket.send(message, { binary: isBinary });
        } else {
          session.pendingData.push({ isBinary, data: message });
        }
      });

      connection.socket.on('close', () => {
        console.log(`[Bridge Ingress] Client socket closed: ${bridgeId}`);
        cleanupSession(bridgeId);
      });

      connection.socket.on('error', (err) => {
        console.error(`[Bridge Ingress] Client socket error: ${bridgeId}`, err);
        cleanupSession(bridgeId);
      });

    } catch (err: any) {
      console.error('[Bridge Ingress] Auth failed:', err.message);
      connection.socket.send(JSON.stringify({ type: 'error', code: 'auth.failed', message: 'Token verification failed', recoverable: false }));
      connection.socket.close();
    }
  });

  // 2. Local Python Helper Egress WebSocket
  // ws://localhost:3000/bridge/:bridgeId
  fastify.get('/bridge/:bridgeId', { websocket: true }, async (connection: SocketStream, req: any) => {
    const { bridgeId } = req.params;

    const session = activeBridges.get(bridgeId);
    if (!session) {
      console.warn(`[Bridge Egress] Unknown bridge connection request: ${bridgeId}`);
      connection.socket.close();
      return;
    }

    console.log(`[Bridge Egress] Python bridge socket connected: ${bridgeId}`);
    session.bridgeSocket = connection;

    // Flush any pending data buffered from client
    if (session.pendingData.length > 0) {
      console.log(`[Bridge Egress] Flushing ${session.pendingData.length} queued messages to python bridge`);
      session.pendingData.forEach((item) => {
        connection.socket.send(item.data, { binary: item.isBinary });
      });
      session.pendingData = [];
    }

    // Pipe from Python bridge back to external client
    connection.socket.on('message', (message, isBinary) => {
      if (session.clientSocket && session.clientSocket.socket.readyState === session.clientSocket.socket.OPEN) {
        session.clientSocket.socket.send(message, { binary: isBinary });
      }
    });

    connection.socket.on('close', () => {
      console.log(`[Bridge Egress] Python bridge socket closed: ${bridgeId}`);
      cleanupSession(bridgeId);
    });

    connection.socket.on('error', (err) => {
      console.error(`[Bridge Egress] Python bridge socket error: ${bridgeId}`, err);
      cleanupSession(bridgeId);
    });
  });
}

function cleanupSession(bridgeId: string) {
  const session = activeBridges.get(bridgeId);
  if (!session) return;

  activeBridges.delete(bridgeId);
  console.log(`[Bridge Cleanup] Tearing down bridge: ${bridgeId}`);

  // Kill Python bridge
  try {
    session.childProcess.kill('SIGTERM');
  } catch (e) {
    // Already dead
  }

  // Close sockets
  try {
    if (session.clientSocket.socket.readyState !== session.clientSocket.socket.CLOSED) {
      session.clientSocket.socket.close();
    }
  } catch (e) {}

  try {
    if (session.bridgeSocket && session.bridgeSocket.socket.readyState !== session.bridgeSocket.socket.CLOSED) {
      session.bridgeSocket.socket.close();
    }
  } catch (e) {}
}
