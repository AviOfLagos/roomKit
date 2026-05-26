import WebSocket, { RawData } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { generateLiveKitToken } from '../livekit.js';
import { startSupervisedProcess, SupervisorHandle } from './supervisor.js';
import dotenv from 'dotenv';

dotenv.config();

const roomkitApiKey = process.env.ROOMKIT_API_KEY || 'dev';

interface BridgeSession {
  roomId: string;
  clientSocket: WebSocket;
  bridgeSocket: WebSocket | null;
  supervisor: SupervisorHandle;
  pendingData: Array<{ isBinary: boolean; data: RawData }>;
}

// Active session store
const activeBridges = new Map<string, BridgeSession>();

export function setupWebSocketBridge(fastify: any) {
  // 1. External Builder Ingress WebSocket
  // wss://<host>/v1/rooms/:id/agent?token=<jwt-with-role=agent>
  fastify.get('/v1/rooms/:id/agent', { websocket: true }, async (connection: WebSocket, req: any) => {
    const { id: roomId } = req.params;
    const token = req.query.token;
    const streamMode = req.query.stream === 'per-track' ? 'per-track' : 'mixed';
    const targetParticipantId = typeof req.query.participantId === 'string' ? req.query.participantId : '';

    if (!token) {
      connection.send(JSON.stringify({ type: 'error', code: 'auth.missing_token', message: 'Missing token query parameter', recoverable: false }));
      connection.close();
      return;
    }

    if (streamMode === 'per-track' && !targetParticipantId) {
      connection.send(JSON.stringify({ type: 'error', code: 'stream.missing_participant', message: 'per-track stream requires participantId query parameter', recoverable: false }));
      connection.close();
      return;
    }

    try {
      // Decode and verify JWT token (signed with ROOMKIT_API_KEY)
      const decoded = jwt.verify(token, roomkitApiKey) as { role: string; identity: string };
      if (decoded.role !== 'agent') {
        connection.send(JSON.stringify({ type: 'error', code: 'auth.invalid_role', message: 'Token must have role=agent', recoverable: false }));
        connection.close();
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

      const pyArgs = [
        scriptPath,
        '--room', roomId,
        '--token', lkToken,
        '--local-ws', localWsUrl,
        '--stream', streamMode,
      ];
      if (streamMode === 'per-track') {
        pyArgs.push('--participant-id', targetParticipantId);
      }

      console.log(`[Bridge Ingress] Spawning Python bridge. ID: ${bridgeId}, Room: ${roomId}, stream: ${streamMode}${targetParticipantId ? ` (participantId=${targetParticipantId})` : ''}, localWs: ${localWsUrl}`);

      const supervisor = startSupervisedProcess({
        command: 'python3',
        args: pyArgs,
        bridgeId,
        onStdout: (data) => console.log(`[Bridge Python stdout ${bridgeId}]: ${data.toString().trim()}`),
        onStderr: (data) => console.error(`[Bridge Python stderr ${bridgeId}]: ${data.toString().trim()}`),
        onRestart: (attempt) => {
          // Notify the BYO client that we're reconnecting; payload conforms to RoomEvent 'error'
          // shape with recoverable=true so the SDK can surface the blip without tearing down.
          try {
            connection.send(JSON.stringify({
              type: 'error',
              code: 'bridge.restarted',
              message: `Python bridge restarted (attempt ${attempt})`,
              recoverable: true,
            }));
          } catch { /* ignore */ }
        },
        onGaveUp: (code, signal) => {
          console.error(`[Bridge Python ${bridgeId}] supervisor gave up. Exit code=${code} signal=${signal}.`);
          try {
            connection.send(JSON.stringify({
              type: 'error',
              code: 'bridge.exhausted',
              message: 'Python bridge restart budget exhausted',
              recoverable: false,
            }));
          } catch { /* ignore */ }
          cleanupSession(bridgeId);
        },
      });

      // Create session
      const session: BridgeSession = {
        roomId,
        clientSocket: connection,
        bridgeSocket: null,
        supervisor,
        pendingData: [],
      };

      activeBridges.set(bridgeId, session);

      // Listen for data from client
      connection.on('message', (message: RawData, isBinary: boolean) => {
        if (session.bridgeSocket) {
          session.bridgeSocket.send(message, { binary: isBinary });
        } else {
          session.pendingData.push({ isBinary, data: message });
        }
      });

      connection.on('close', () => {
        console.log(`[Bridge Ingress] Client socket closed: ${bridgeId}`);
        cleanupSession(bridgeId);
      });

      connection.on('error', (err: Error) => {
        console.error(`[Bridge Ingress] Client socket error: ${bridgeId}`, err);
        cleanupSession(bridgeId);
      });

    } catch (err: any) {
      console.error('[Bridge Ingress] Auth failed:', err.message);
      connection.send(JSON.stringify({ type: 'error', code: 'auth.failed', message: 'Token verification failed', recoverable: false }));
      connection.close();
    }
  });

  // 2. Local Python Helper Egress WebSocket
  // ws://localhost:3000/bridge/:bridgeId
  fastify.get('/bridge/:bridgeId', { websocket: true }, async (connection: WebSocket, req: any) => {
    const { bridgeId } = req.params;

    const session = activeBridges.get(bridgeId);
    if (!session) {
      console.warn(`[Bridge Egress] Unknown bridge connection request: ${bridgeId}`);
      connection.close();
      return;
    }

    console.log(`[Bridge Egress] Python bridge socket connected: ${bridgeId}`);
    session.bridgeSocket = connection;

    // Flush any pending data buffered from client
    if (session.pendingData.length > 0) {
      console.log(`[Bridge Egress] Flushing ${session.pendingData.length} queued messages to python bridge`);
      session.pendingData.forEach((item) => {
        connection.send(item.data, { binary: item.isBinary });
      });
      session.pendingData = [];
    }

    // Pipe from Python bridge back to external client
    connection.on('message', (message: RawData, isBinary: boolean) => {
      if (session.clientSocket && session.clientSocket.readyState === WebSocket.OPEN) {
        session.clientSocket.send(message, { binary: isBinary });
      }
    });

    connection.on('close', () => {
      console.log(`[Bridge Egress] Python bridge socket closed: ${bridgeId}`);
      cleanupSession(bridgeId);
    });

    connection.on('error', (err: Error) => {
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

  // Stop the supervisor (graceful SIGTERM to current child, no further restarts)
  try {
    session.supervisor.stop();
  } catch (e) {
    // Already dead
  }

  // Close sockets
  try {
    if (session.clientSocket.readyState !== WebSocket.CLOSED) {
      session.clientSocket.close();
    }
  } catch (e) {}

  try {
    if (session.bridgeSocket && session.bridgeSocket.readyState !== WebSocket.CLOSED) {
      session.bridgeSocket.close();
    }
  } catch (e) {}
}
