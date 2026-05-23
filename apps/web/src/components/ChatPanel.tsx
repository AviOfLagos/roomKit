'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useDataChannel, useLocalParticipant } from '@livekit/components-react';
import { MessageSquare, Send } from 'lucide-react';
import { ROOMKIT_CONTROL_TOPIC } from './TranscriptPanel';

type ChatMessageEvent = {
  type: 'chat.message';
  participantId: string;
  text: string;
  at: number;
};

type DisplayMessage = {
  id: string;
  participantId: string;
  text: string;
  at: number;
  mine: boolean;
};

export function ChatPanel() {
  const { localParticipant } = useLocalParticipant();
  const { send, message } = useDataChannel(ROOMKIT_CONTROL_TOPIC);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!message) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(message.payload));
    } catch {
      return;
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('type' in parsed) ||
      (parsed as { type: unknown }).type !== 'chat.message'
    ) {
      return;
    }
    const ev = parsed as ChatMessageEvent;
    // Skip our own echoes (LiveKit data channels are receive-only for the sender,
    // but message.from is set for remote messages; guard anyway).
    if (message.from?.identity === localParticipant.identity) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `${ev.participantId}-${ev.at}-${prev.length}`,
        participantId: ev.participantId,
        text: ev.text,
        at: ev.at,
        mine: false,
      },
    ]);
  }, [message, localParticipant.identity]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (text.length === 0) return;
    const ev: ChatMessageEvent = {
      type: 'chat.message',
      participantId: localParticipant.identity,
      text,
      at: Date.now(),
    };
    try {
      send(new TextEncoder().encode(JSON.stringify(ev)), { reliable: true });
    } catch (err) {
      console.warn('chat send failed', err);
    }
    setMessages((prev) => [
      ...prev,
      {
        id: `me-${ev.at}-${prev.length}`,
        participantId: ev.participantId,
        text,
        at: ev.at,
        mine: true,
      },
    ]);
    setInput('');
  };

  return (
    <div className="rk-side-panel glass-panel p-4 flex flex-col h-full min-h-0">
      <div className="border-b border-zinc-900 pb-3 mb-3">
        <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" /> Chat
        </h3>
        <span className="text-[10px] text-zinc-500">{`{ type: 'chat.message', text }`}</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500 text-center px-4">
            No messages yet.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`text-xs p-2 rounded border max-w-[90%] ${
                m.mine
                  ? 'bg-indigo-600/15 border-indigo-500/30 text-white ml-auto'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-200'
              }`}
            >
              <span className="block font-bold text-[10px] text-zinc-400 mb-0.5">
                {m.mine ? 'You' : m.participantId}
              </span>
              <span className="break-words">{m.text}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          id="input-chat-message"
          type="text"
          value={input}
          placeholder="Send a message…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendMessage();
          }}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
        />
        <button
          id="btn-send-message"
          onClick={sendMessage}
          className="btn-glowing px-3 py-2.5 text-xs flex items-center gap-1"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
