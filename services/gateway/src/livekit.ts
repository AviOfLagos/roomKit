import { AccessToken, RoomServiceClient, EgressClient } from 'livekit-server-sdk';
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

const minioEndpoint = process.env.MINIO_ENDPOINT || 'localhost:9000';
const minioAccessKey = process.env.MINIO_ACCESS_KEY || 'admin';
const minioSecretKey = process.env.MINIO_SECRET_KEY || 'admin12345';
const minioBucket = process.env.MINIO_BUCKET || 'roomkit-recordings';

export function getEgressClient() {
  return new EgressClient(livekitUrl, apiKey, apiSecret);
}

export async function startRoomComposite(
  roomId: string
): Promise<{ egressId: string; url: string; filepath: string }> {
  const client = getEgressClient();
  const filepath = `recordings/${roomId}/${roomId}-${Date.now()}.mp4`;

  const fileOutput = {
    filepath,
    s3: {
      accessKey: minioAccessKey,
      secret: minioSecretKey,
      region: 'us-east-1',
      endpoint: `http://${minioEndpoint}`,
      bucket: minioBucket,
      forcePathStyle: true,
    },
  } as any;

  const info = await client.startRoomCompositeEgress(
    roomId,
    { file: fileOutput } as any,
    { layout: 'speaker' } as any
  );

  return {
    egressId: info.egressId,
    url: `s3://${minioBucket}/${filepath}`,
    filepath,
  };
}

export async function stopEgress(egressId: string): Promise<void> {
  const client = getEgressClient();
  await client.stopEgress(egressId);
}
