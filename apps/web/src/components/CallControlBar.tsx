'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff } from 'lucide-react';

type Props = {
  roomId: string;
};

/**
 * Custom control bar that calls the LiveKit local-participant helpers
 * directly. We render bespoke buttons instead of the prebuilt
 * `ControlBar` so we can match the roomKit visual style.
 */
export function CallControlBar({ roomId }: Props) {
  const router = useRouter();
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();

  const toggleMic = async () => {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  const toggleCam = async () => {
    await localParticipant.setCameraEnabled(!isCameraEnabled);
  };

  const toggleScreen = async () => {
    await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
  };

  const leave = async () => {
    try {
      await room.disconnect();
    } catch {
      /* ignore */
    }
    router.push(`/room/${encodeURIComponent(roomId)}/ended`);
  };

  return (
    <div className="rk-controlbar flex justify-center items-center gap-4 mt-4 bg-zinc-950/80 border border-zinc-900 rounded-full px-6 py-3 max-w-fit mx-auto shadow-2xl">
      <button
        id="btn-toggle-mic"
        onClick={toggleMic}
        title={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
        className={`p-3 rounded-full transition-all ${
          isMicrophoneEnabled
            ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
            : 'bg-red-500/20 border border-red-500/40 text-red-400'
        }`}
      >
        {isMicrophoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </button>

      <button
        id="btn-toggle-cam"
        onClick={toggleCam}
        title={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
        className={`p-3 rounded-full transition-all ${
          isCameraEnabled
            ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
            : 'bg-red-500/20 border border-red-500/40 text-red-400'
        }`}
      >
        {isCameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      </button>

      <button
        id="btn-toggle-screen"
        onClick={toggleScreen}
        title={isScreenShareEnabled ? 'Stop sharing' : 'Share screen'}
        className={`p-3 rounded-full transition-all ${
          isScreenShareEnabled
            ? 'bg-indigo-600 text-white shadow-lg'
            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
        }`}
      >
        <ScreenShare className="w-5 h-5" />
      </button>

      <button
        id="btn-leave-call"
        onClick={leave}
        title="Leave call"
        className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );
}
