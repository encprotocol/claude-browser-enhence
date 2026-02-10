import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track, RepeatMode } from '@/types';
import * as audioEngine from '@/lib/audioEngine';

interface PlayerState {
  // Persisted
  tracks: Track[];
  currentTrackId: string | null;
  repeatMode: RepeatMode;
  shuffle: boolean;
  wasPlaying: boolean;

  // Transient
  playing: boolean;
  panelOpen: boolean;

  // Transient
  addingTrack: boolean;

  // Actions
  addTrack: (url: string, title?: string) => Promise<void>;
  removeTrack: (id: string) => void;
  selectTrack: (id: string) => void;
  togglePlayPause: () => void;
  next: () => void;
  prev: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  reorderTracks: (from: number, to: number) => void;
  initEngine: () => void;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      tracks: [],
      currentTrackId: null,
      repeatMode: 'all',
      shuffle: false,
      wasPlaying: false,
      playing: false,
      panelOpen: false,
      addingTrack: false,

      addTrack: async (url, title) => {
        set({ addingTrack: true });
        try {
          const info = await audioEngine.fetchTrackInfo(url);
          if (!info.playable) {
            set({ addingTrack: false });
            return;
          }
          const track: Track = {
            id: genId(),
            title: title || info.title,
            url: info.cleanUrl,
            type: info.type,
          };
          const { tracks, currentTrackId } = get();
          const isFirst = tracks.length === 0;
          set({
            tracks: [...tracks, track],
            ...(isFirst ? { currentTrackId: track.id } : {}),
            addingTrack: false,
          });
        } catch {
          set({ addingTrack: false });
        }
      },

      removeTrack: (id) => {
        const { tracks, currentTrackId } = get();
        const newTracks = tracks.filter((t) => t.id !== id);
        if (currentTrackId === id) {
          const oldIdx = tracks.findIndex((t) => t.id === id);
          const nextTrack = newTracks[oldIdx] || newTracks[oldIdx - 1] || null;
          audioEngine.stop();
          set({
            tracks: newTracks,
            currentTrackId: nextTrack ? nextTrack.id : null,
            playing: nextTrack ? get().playing : false,
          });
          if (nextTrack) {
            audioEngine.load(nextTrack);
            if (get().playing) audioEngine.play();
          }
        } else {
          set({ tracks: newTracks });
        }
      },

      selectTrack: (id) => {
        const track = get().tracks.find((t) => t.id === id);
        if (!track) return;
        set({ currentTrackId: id, playing: true, wasPlaying: true });
        audioEngine.load(track);
        audioEngine.play();
      },

      togglePlayPause: () => {
        const { playing, currentTrackId, tracks } = get();
        if (!currentTrackId && tracks.length === 0) return;

        if (playing) {
          audioEngine.pause();
          set({ playing: false, wasPlaying: false });
        } else {
          // If no current track, select the first one
          if (!currentTrackId && tracks.length > 0) {
            get().selectTrack(tracks[0].id);
            return;
          }
          // Resume without reloading — just call play()
          audioEngine.play();
          set({ playing: true, wasPlaying: true });
        }
      },

      next: () => {
        const { tracks, currentTrackId, repeatMode, shuffle } = get();
        if (tracks.length === 0) return;
        const idx = tracks.findIndex((t) => t.id === currentTrackId);

        if (repeatMode === 'one') {
          // Replay same track
          const track = tracks[idx];
          if (track) {
            audioEngine.load(track);
            audioEngine.play();
          }
          return;
        }

        let nextIdx: number;
        if (shuffle) {
          nextIdx = Math.floor(Math.random() * tracks.length);
        } else {
          nextIdx = idx + 1;
        }

        if (nextIdx >= tracks.length) {
          if (repeatMode === 'all') {
            nextIdx = 0;
          } else {
            // repeat none — stop at end
            audioEngine.stop();
            set({ playing: false, wasPlaying: false });
            return;
          }
        }

        const track = tracks[nextIdx];
        set({ currentTrackId: track.id });
        audioEngine.load(track);
        audioEngine.play();
      },

      prev: () => {
        const { tracks, currentTrackId, repeatMode } = get();
        if (tracks.length === 0) return;
        const idx = tracks.findIndex((t) => t.id === currentTrackId);

        let prevIdx = idx - 1;
        if (prevIdx < 0) {
          if (repeatMode === 'all') {
            prevIdx = tracks.length - 1;
          } else {
            prevIdx = 0;
          }
        }

        const track = tracks[prevIdx];
        set({ currentTrackId: track.id });
        audioEngine.load(track);
        audioEngine.play();
      },

      setRepeatMode: (mode) => set({ repeatMode: mode }),

      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

      setPanelOpen: (open) => set({ panelOpen: open }),

      reorderTracks: (from, to) => {
        const { tracks } = get();
        if (from === to) return;
        if (from < 0 || from >= tracks.length || to < 0 || to >= tracks.length) return;
        const newTracks = [...tracks];
        const [moved] = newTracks.splice(from, 1);
        newTracks.splice(to, 0, moved);
        set({ tracks: newTracks });
      },

      initEngine: () => {
        audioEngine.setVolume(1);
        audioEngine.onEnded(() => {
          get().next();
        });

        // Resume if wasPlaying
        const { wasPlaying, currentTrackId, tracks } = get();
        if (wasPlaying && currentTrackId) {
          const track = tracks.find((t) => t.id === currentTrackId);
          if (track) {
            audioEngine.load(track);
            audioEngine.play().then((ok) => {
              set({ playing: ok });
            });
          }
        }
      },
    }),
    {
      name: 'synesthesia-player-store',
      partialize: ({ tracks, currentTrackId, repeatMode, shuffle, wasPlaying }) => ({
        tracks, currentTrackId, repeatMode, shuffle, wasPlaying,
      }),
      onRehydrate: () => {
        return (state) => {
          if (state) state.initEngine();
        };
      },
    },
  ),
);
