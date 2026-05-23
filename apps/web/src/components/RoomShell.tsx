'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { Bot, User } from 'lucide-react';
import { LIVEKIT_URL } from '../lib/api';
import { VideoGrid } from './VideoGrid';
import { CallControlBar } from './CallControlBar';
import { SidePanel } from './SidePanel';

type Props = {
  roomId: string;
  token: string;
  displayName: string;
};

export function RoomShell({ roomId, token, displayName }: Props) {
  const router = useRouter();

  return (
    <main className="rk-room min-h-screen bg-zinc-950 flex flex-col">
      <LiveKitRoom
        token={token}
        serverUrl={LIVEKIT_URL}
        connect
        audio
        video
        onDisconnected={() => {
          router.push(`/room/${encodeURIComponent(roomId)}/ended`);
        }}
        className="flex-1 flex flex-col min-h-0"
      >
        <header className="rk-room-header flex justify-between items-center bg-zinc-950 border-b border-zinc-900 px-6 py-4">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-indigo-400 animate-glow" />
            <div>
              <h1 className="font-display font-bold text-base text-white tracking-tight">
                room<span className="text-indigo-400">Kit</span>
              </h1>
              <span className="text-[10px] text-zinc-500 font-mono uppercase select-all">
                ID: {roomId}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-1.5 text-xs text-white">
            <User className="w-3.5 h-3.5 text-zinc-400" />
            {displayName}
          </div>
        </header>

        <div className="rk-room-body flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-hidden min-h-0">
          <section className="flex-1 flex flex-col min-h-0 bg-zinc-900/40 rounded-xl border border-zinc-900/60 p-4">
            <VideoGrid />
            <CallControlBar roomId={roomId} />
          </section>

          <SidePanel />
        </div>

        <RoomAudioRenderer />
      </LiveKitRoom>
    </main>
  );
}
