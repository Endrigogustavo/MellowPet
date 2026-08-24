export type SpotifyPlayerStateEvent = {
  trackName: string | null;
  artistName: string | null;
  trackUri: string | null;
  isPaused: boolean;
  positionMs: number;
  durationMs: number;
};

export type SpotifyConnectionChangedEvent = {
  connected: boolean;
  error: string | null;
};

export type MellowSpotifyModuleEvents = {
  onPlayerStateChanged: (event: SpotifyPlayerStateEvent) => void;
  onConnectionChanged: (event: SpotifyConnectionChangedEvent) => void;
};
