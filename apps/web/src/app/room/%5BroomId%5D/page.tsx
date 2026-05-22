'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  LiveKitRoom, 
  VideoConference, 
  RoomAudioRenderer,
  ControlBar,
  useToken,
  useLocalParticipant,
  useTracks,
  useDataChannel
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, MessageSquare, Bot, Sparkles, User, Settings } from 'lucide-react';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [token, setToken] = useState<string | null>(null);
  const [identity, setIdentity] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate a random human identity on join
    const randomId = `human-${Math.random().toString(36).slice(2, 6)}`;
    const randomName = `User ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    setIdentity(randomId);
    setDisplayName(randomName);

    // Fetch token from gateway
    const fetchToken = async () => {
      try {
        const response = await fetch(`/v1/rooms/${roomId}/tokens`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'dev',
          },
          body: JSON.stringify({
            role: 'human',
            identity: randomId,
            displayName: randomName,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch token');
        }

        const data = await response.json();
        setToken(data.token);
      } catch (err) {
        console.error(err);
        alert('Could not join room. Make sure room exists and gateway is running.');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [roomId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-zinc-400 font-display font-medium text-sm">Securing your endpoint...</span>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Real-time LiveKit Session wrapper */}
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl="ws://localhost:7880"
        onDisconnected={() => {
          router.push('/');
        }}
        className="flex-1 flex flex-col relative"
      >
        <RoomHeader roomId={roomId} displayName={displayName} />
        
        <div className="flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-hidden min-h-0">
          {/* Main Video Arena */}
          <div className="flex-1 flex flex-col justify-between relative bg-zinc-900/40 rounded-xl border border-zinc-900/60 p-4">
            <VideoGrid />
            <CustomControlBar roomId={roomId} />
          </div>

          {/* Interactive Right Sidebar: AI Status & Live Chat */}
          <RoomSidebar roomId={roomId} />
        </div>

        {/* Essential audio render element */}
        <RoomAudioRenderer />
      </LiveKitRoom>
    </main>
  );
}

// Sub-component: Elegant Call Header
function RoomHeader({ roomId, displayName }: { roomId: string; displayName: string }) {
  return (
    <header className="flex justify-between items-center bg-zinc-950 border-b border-zinc-900 px-6 py-4">
      <div className="flex items-center gap-3">
        <Bot className="w-6 h-6 text-indigo-400 animate-glow" />
        <div>
          <h1 className="font-display font-bold text-base text-white tracking-tight">
            room<span className="text-indigo-400">Kit</span> Space
          </h1>
          <span className="text-[10px] text-zinc-500 font-mono select-all uppercase">ID: {roomId}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-full text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          AI Active
        </div>
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-1.5 text-xs text-white">
          <User className="w-3.5 h-3.5 text-zinc-400" />
          {displayName}
        </div>
      </div>
    </header>
  );
}

// Sub-component: High-end Custom Video Grid
function VideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-center justify-center max-h-[80vh] overflow-y-auto pr-1">
      {tracks.map((trackReference) => {
        const identity = trackReference.participant.identity;
        const name = trackReference.participant.name || identity;
        const isAgent = identity.includes('agent');
        const isSpeaking = trackReference.participant.isSpeaking;

        return (
          <div 
            key={`${identity}-${trackReference.source}`} 
            className={`video-tile relative flex flex-col justify-end ${isSpeaking ? 'speaking' : ''}`}
          >
            {trackReference.publication?.track ? (
              // HTML5 native video renderer
              <video
                ref={(el) => {
                  if (el && trackReference.publication?.track) {
                    trackReference.publication.track.attach(el);
                  }
                }}
                autoPlay
                playsInline
                className="video-element"
              />
            ) : (
              // Stunning Glassmorphism placeholder when camera off
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950/60 p-4 space-y-3">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isAgent ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400' : 'bg-zinc-850 text-zinc-400'}`}>
                  {isAgent ? <Bot className="w-7 h-7" /> : <User className="w-7 h-7" />}
                </div>
                <span className="text-xs font-semibold text-zinc-400">{isAgent ? 'AI Agent' : name}</span>
              </div>
            )}

            {/* Speaking / Role tags */}
            <div className="tile-overlay select-none z-10">
              {isAgent ? (
                <span className="bg-indigo-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase">AI</span>
              ) : (
                <span className="bg-zinc-800 text-zinc-300 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">User</span>
              )}
              <span className="truncate max-w-[100px]">{isAgent ? 'Room Assistant' : name}</span>
              {isSpeaking && (
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Sub-component: Sleek Interactive Meeting Controls
function CustomControlBar({ roomId }: { roomId: string }) {
  const { localParticipant } = useLocalParticipant();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const router = useRouter();

  const toggleMic = async () => {
    const nextState = !micOn;
    await localParticipant.setMicrophoneEnabled(nextState);
    setMicOn(nextState);
  };

  const toggleCam = async () => {
    const nextState = !camOn;
    await localParticipant.setCameraEnabled(nextState);
    setCamOn(nextState);
  };

  const toggleScreen = async () => {
    const nextState = !screenOn;
    await localParticipant.setScreenShareEnabled(nextState);
    setScreenOn(nextState);
  };

  const disconnect = () => {
    localParticipant.disconnect();
    router.push('/');
  };

  return (
    <div className="flex justify-center items-center gap-4 mt-6 bg-zinc-950/80 border border-zinc-900 rounded-full px-6 py-3 max-w-fit mx-auto shadow-2xl">
      <button 
        onClick={toggleMic} 
        className={`p-3 rounded-full transition-all ${micOn ? 'bg-zinc-850 hover:bg-zinc-800 text-white' : 'bg-red-500/20 border border-red-500/40 text-red-400'}`}
        title={micOn ? 'Mute Mic' : 'Unmute Mic'}
        id="btn-toggle-mic"
      >
        {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </button>

      <button 
        onClick={toggleCam} 
        className={`p-3 rounded-full transition-all ${camOn ? 'bg-zinc-850 hover:bg-zinc-800 text-white' : 'bg-red-500/20 border border-red-500/40 text-red-400'}`}
        title={camOn ? 'Disable Camera' : 'Enable Camera'}
        id="btn-toggle-cam"
      >
        {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      </button>

      <button 
        onClick={toggleScreen} 
        className={`p-3 rounded-full transition-all ${screenOn ? 'bg-indigo-600 text-white shadow-lg' : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-300'}`}
        title="Share Screen"
        id="btn-toggle-screen"
      >
        <ScreenShare className="w-5 h-5" />
      </button>

      <button 
        onClick={disconnect} 
        className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg"
        title="End Call"
        id="btn-disconnect"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );
}

// Sub-component: In-Call Text Chat (LiveKit Data Channel)
function RoomSidebar({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<Array<{ sender: string; text: string; time: string }>>([]);
  const [inputText, setInputText] = useState('');
  
  // Set up LiveKit raw text data channel
  const { send, message: receivedMessage } = useDataChannel('roomkit_chat');

  useEffect(() => {
    if (receivedMessage) {
      try {
        const payload = JSON.parse(new TextDecoder().decode(receivedMessage.payload));
        setMessages((prev) => [...prev, {
          sender: payload.sender || 'Participant',
          text: payload.text || '',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      } catch (e) {
        // Fallback for raw text
        const text = new TextDecoder().decode(receivedMessage.payload);
        setMessages((prev) => [...prev, {
          sender: 'Remote',
          text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    }
  }, [receivedMessage]);

  const sendMessage = () => {
    if (!inputText.trim()) return;

    const payload = {
      sender: 'You',
      text: inputText,
    };

    const encoder = new TextEncoder();
    send(encoder.encode(JSON.stringify(payload)), { reliable: true });

    setMessages((prev) => [...prev, {
      sender: 'You',
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    setInputText('');
  };

  return (
    <aside className="w-full lg:w-80 flex flex-col justify-between glass-panel p-4 h-[350px] lg:h-auto max-h-[85vh]">
      {/* Sidebar header */}
      <div className="border-b border-zinc-900 pb-3 mb-3">
        <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" /> Space Chat
        </h3>
        <span className="text-[10px] text-zinc-500">Live data channel sync</span>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <Bot className="w-8 h-8 text-zinc-700 mb-2 animate-glow" />
            <span className="text-xs text-zinc-500">Chat is currently empty.</span>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div 
              key={idx} 
              className={`p-2.5 rounded-lg border text-xs max-w-[85%] ${m.sender === 'You' ? 'bg-indigo-600/10 border-indigo-500/20 text-white ml-auto' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}
            >
              <div className="flex justify-between items-center font-bold text-[10px] text-zinc-400 mb-1">
                <span>{m.sender}</span>
                <span className="font-normal opacity-70">{m.time}</span>
              </div>
              <p className="leading-relaxed break-all select-text">{m.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Inputs */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
          placeholder="Sync text message..."
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
          id="input-chat-message"
        />
        <button 
          onClick={sendMessage}
          className="btn-glowing px-4 py-2.5 text-xs"
          id="btn-send-message"
        >
          Send
        </button>
      </div>
    </aside>
  );
}
