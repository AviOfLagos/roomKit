export type RoomEvent =          
  | { type: 'room.joined';       
participantId: string; role:       
'agent'|'human'; at: number }
  | { type: 'participant.joined';  
participantId: string; displayName:
 string; role: 'agent'|'human'; at:
 number }                          
  | { type: 'participant.left';
participantId: string; reason:   
string; at: number }             
  | { type: 'speech.started';
participantId: string; at: number }
    // platform-side VAD
  | { type: 'speech.ended';        
participantId: string; at: number }
  | { type: 'transcript.partial';
participantId: string; text:       
string; chunkId: string; at: number
 }                                 
  | { type: 'transcript.final';
participantId: string; text:       
string; chunkId: string;         
confidence?: number; at: number }  
  | { type: 'chat.message';
participantId: string; text:     
string; at: number }             
  | { type: 'recording.started';
egressId: string; at: number }
  | { type: 'recording.stopped';
egressId: string; durationMs:
number; at: number }
  | { type: 'error';
code: string; message: string;
recoverable: boolean };
