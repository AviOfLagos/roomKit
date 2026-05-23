'use client';

import React from 'react';
import {
  GridLayout,
  ParticipantTile,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

/**
 * Wraps the LiveKit `GridLayout` + `ParticipantTile` primitives.
 *
 * Subscribes to camera + screen-share tracks for every participant in the
 * room (including the local one), with placeholders for participants that
 * have their camera off.
 */
export function VideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <div className="rk-video-grid flex-1 min-h-0">
      <GridLayout tracks={tracks} style={{ height: '100%' }}>
        <ParticipantTile />
      </GridLayout>
    </div>
  );
}
