'use client';

import React, { useState } from 'react';
import { User, ArrowRight } from 'lucide-react';

type Props = {
  defaultName?: string;
  onSubmit: (name: string) => void;
};

export function NamePrompt({ defaultName = '', onSubmit }: Props) {
  const [name, setName] = useState(defaultName);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="glass-panel p-8 w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-white">Join the room</h2>
            <p className="text-xs text-zinc-500">Other participants will see this name.</p>
          </div>
        </div>

        <div>
          <label
            htmlFor="input-display-name"
            className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2"
          >
            Display name
          </label>
          <input
            id="input-display-name"
            type="text"
            value={name}
            autoFocus
            placeholder="Alex Doe"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        <button
          id="btn-join-room"
          onClick={submit}
          disabled={name.trim().length === 0}
          className="w-full btn-glowing py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          Join Call <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
