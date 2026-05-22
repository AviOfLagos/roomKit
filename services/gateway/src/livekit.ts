import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
const livekitUrl = process.env.LIVEKIT_URL || 'http://localhost:7880';

export function getRoomServiceClient() {
  return new RoomServiceClient(livekitUrl, apiKey, apiSecret);
}

export function generateLiveKitToken(options: {
  room: string;
  identity: string;
  role: 'human' | 'agent';
  ttlSeconds?: number;
}) {
  const { room, identity, role, ttlSeconds = 14400 } = options;

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: ttlSeconds,
  });

  const grants = {
    roomJoin: true,
    room: room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  };

  if (role === 'agent') {
    // Agents might want to be hidden or have admin privileges depending on implementation
    // For Phase 1, we treat them as first class participants.
  }

  at.addGrant(grants);
  return {
    token: at.toJwt(),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  };
}

export async function forceEndRoom(roomName: string) {
  const client = getRoomServiceClient();
  try {
    await client.deleteRoom(roomName);
  } catch (error: any) {
    console.error(`Error deleting room ${roomName} from LiveKit:`, error.message);
  }
}
