export type RoomEvent =
  | { type: 'room.joined'; participantId: string; role: 'agent' | 'human'; at: number }
  | {
      type: 'participant.joined';
      participantId: string;
      displayName: string;
      role: 'agent' | 'human';
      at: number;
    }
  | { type: 'participant.left'; participantId: string; reason: string; at: number }
  | { type: 'speech.started'; participantId: string; at: number }
  | { type: 'speech.ended'; participantId: string; at: number }
  | {
      type: 'transcript.partial';
      participantId: string;
      text: string;
      chunkId: string;
      at: number;
    }
  | {
      type: 'transcript.final';
      participantId: string;
      text: string;
      chunkId: string;
      confidence?: number;
      at: number;
    }
  | { type: 'chat.message'; participantId: string; text: string; at: number }
  | { type: 'recording.started'; egressId: string; at: number }
  | { type: 'recording.stopped'; egressId: string; durationMs: number; at: number }
  // Room-lifecycle additions (additive, ignore-if-unknown for older SDKs).
  | { type: 'room.inactivity.warning'; closesInMs: number; at: number }
  | { type: 'room.inactivity.cancelled'; at: number }
  | { type: 'room.closed'; reason: string; at: number }
  | { type: 'error'; code: string; message: string; recoverable: boolean };
