'use client';

import React, { useState } from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';
import { TranscriptPanel } from './TranscriptPanel';
import { ChatPanel } from './ChatPanel';

type Tab = 'transcript' | 'chat';

export function SidePanel() {
  const [tab, setTab] = useState<Tab>('transcript');

  return (
    <aside className="rk-side w-full lg:w-80 flex flex-col gap-3 min-h-0">
      <div className="flex bg-zinc-950 border border-zinc-900 rounded-lg p-1 gap-1">
        <button
          id="tab-transcript"
          onClick={() => setTab('transcript')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-md transition-all ${
            tab === 'transcript'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Transcript
        </button>
        <button
          id="tab-chat"
          onClick={() => setTab('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-md transition-all ${
            tab === 'chat'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Chat
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {tab === 'transcript' ? <TranscriptPanel /> : <ChatPanel />}
      </div>
    </aside>
  );
}
