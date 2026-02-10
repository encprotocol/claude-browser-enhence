import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock audioEngine before importing playerStore
vi.mock('@/lib/audioEngine', () => ({
  load: vi.fn(),
  play: vi.fn().mockResolvedValue(true),
  pause: vi.fn(),
  stop: vi.fn(),
  setVolume: vi.fn(),
  onEnded: vi.fn(),
  destroy: vi.fn(),
  getCurrentTime: vi.fn(() => 0),
  seek: vi.fn(),
  extractYouTubeId: vi.fn((url: string) => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
      if (host === 'youtube.com') return u.searchParams.get('v') || null;
    } catch { /* */ }
    return null;
  }),
  fetchTrackInfo: vi.fn(async (url: string) => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      const isYt = host === 'youtube.com' || host === 'youtu.be';
      if (isYt) {
        return { title: 'YT Video Title', type: 'youtube', playable: true, cleanUrl: url };
      }
    } catch { /* */ }
    const filename = url.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Unknown';
    return { title: filename, type: 'audio', playable: true, cleanUrl: url };
  }),
  getActiveType: vi.fn(() => null),
}));

import { usePlayerStore } from '@/stores/playerStore';
import * as audioEngine from '@/lib/audioEngine';

describe('playerStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    usePlayerStore.setState({
      tracks: [],
      currentTrackId: null,
      repeatMode: 'all',
      shuffle: false,
      playing: false,
      wasPlaying: false,
      panelOpen: false,
      savedPosition: 0,
    });
  });

  describe('addTrack', () => {
    it('adds an audio track with explicit title', async () => {
      await usePlayerStore.getState().addTrack('https://example.com/song.mp3', 'My Song');
      const { tracks } = usePlayerStore.getState();
      expect(tracks).toHaveLength(1);
      expect(tracks[0].title).toBe('My Song');
      expect(tracks[0].type).toBe('audio');
      expect(tracks[0].url).toBe('https://example.com/song.mp3');
    });

    it('adds a youtube track and fetches title', async () => {
      await usePlayerStore.getState().addTrack('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      const { tracks } = usePlayerStore.getState();
      expect(tracks).toHaveLength(1);
      expect(tracks[0].type).toBe('youtube');
      expect(tracks[0].title).toBe('YT Video Title');
    });

    it('fetches filename for audio URL when no title given', async () => {
      await usePlayerStore.getState().addTrack('https://example.com/path/song.mp3');
      expect(usePlayerStore.getState().tracks[0].title).toBe('song');
    });

    it('sets as current if first track', async () => {
      await usePlayerStore.getState().addTrack('https://example.com/a.mp3', 'A');
      expect(usePlayerStore.getState().currentTrackId).toBe(usePlayerStore.getState().tracks[0].id);
    });

    it('does not change current if adding subsequent track', async () => {
      await usePlayerStore.getState().addTrack('https://example.com/a.mp3', 'A');
      const firstId = usePlayerStore.getState().currentTrackId;
      await usePlayerStore.getState().addTrack('https://example.com/b.mp3', 'B');
      expect(usePlayerStore.getState().currentTrackId).toBe(firstId);
    });
  });

  describe('removeTrack', () => {
    it('removes a track', async () => {
      await usePlayerStore.getState().addTrack('https://example.com/a.mp3', 'A');
      await usePlayerStore.getState().addTrack('https://example.com/b.mp3', 'B');
      const id = usePlayerStore.getState().tracks[0].id;
      usePlayerStore.getState().removeTrack(id);
      expect(usePlayerStore.getState().tracks).toHaveLength(1);
    });

    it('advances to next if removing current track', async () => {
      await usePlayerStore.getState().addTrack('https://example.com/a.mp3', 'A');
      await usePlayerStore.getState().addTrack('https://example.com/b.mp3', 'B');
      const firstId = usePlayerStore.getState().tracks[0].id;
      const secondId = usePlayerStore.getState().tracks[1].id;
      // Select first, then remove it
      usePlayerStore.getState().selectTrack(firstId);
      usePlayerStore.getState().removeTrack(firstId);
      expect(usePlayerStore.getState().currentTrackId).toBe(secondId);
    });

    it('sets null if removing last track', async () => {
      await usePlayerStore.getState().addTrack('https://example.com/a.mp3', 'A');
      const id = usePlayerStore.getState().tracks[0].id;
      usePlayerStore.getState().removeTrack(id);
      expect(usePlayerStore.getState().currentTrackId).toBeNull();
    });
  });

  describe('selectTrack', () => {
    it('sets currentTrackId and calls engine.load + play', async () => {
      await usePlayerStore.getState().addTrack('https://example.com/a.mp3', 'A');
      const id = usePlayerStore.getState().tracks[0].id;
      usePlayerStore.getState().selectTrack(id);
      expect(usePlayerStore.getState().currentTrackId).toBe(id);
      expect(audioEngine.load).toHaveBeenCalled();
      expect(audioEngine.play).toHaveBeenCalled();
    });
  });

  describe('togglePlayPause', () => {
    it('toggles playing state', async () => {
      await usePlayerStore.getState().addTrack('https://example.com/a.mp3', 'A');
      expect(usePlayerStore.getState().playing).toBe(false);
      usePlayerStore.getState().togglePlayPause();
      expect(usePlayerStore.getState().playing).toBe(true);
      expect(usePlayerStore.getState().wasPlaying).toBe(true);
      usePlayerStore.getState().togglePlayPause();
      expect(usePlayerStore.getState().playing).toBe(false);
      expect(usePlayerStore.getState().wasPlaying).toBe(false);
    });

    it('does NOT reload track when resuming after pause', async () => {
      await usePlayerStore.getState().addTrack('https://example.com/a.mp3', 'A');
      const id = usePlayerStore.getState().tracks[0].id;
      usePlayerStore.getState().selectTrack(id);
      vi.clearAllMocks();

      // Pause
      usePlayerStore.getState().togglePlayPause();
      expect(audioEngine.pause).toHaveBeenCalled();

      vi.clearAllMocks();

      // Resume — should call play() but NOT load()
      usePlayerStore.getState().togglePlayPause();
      expect(audioEngine.play).toHaveBeenCalled();
      expect(audioEngine.load).not.toHaveBeenCalled();
    });
  });

  describe('next/prev', () => {
    beforeEach(async () => {
      await usePlayerStore.getState().addTrack('https://example.com/a.mp3', 'A');
      await usePlayerStore.getState().addTrack('https://example.com/b.mp3', 'B');
      await usePlayerStore.getState().addTrack('https://example.com/c.mp3', 'C');
    });

    it('next advances to next track', () => {
      const ids = usePlayerStore.getState().tracks.map((t) => t.id);
      usePlayerStore.getState().selectTrack(ids[0]);
      usePlayerStore.getState().next();
      expect(usePlayerStore.getState().currentTrackId).toBe(ids[1]);
    });

    it('next wraps around in repeat-all mode', () => {
      const ids = usePlayerStore.getState().tracks.map((t) => t.id);
      usePlayerStore.getState().selectTrack(ids[2]);
      usePlayerStore.getState().next();
      expect(usePlayerStore.getState().currentTrackId).toBe(ids[0]);
    });

    it('next stops at end in repeat-none mode', () => {
      usePlayerStore.getState().setRepeatMode('none');
      const ids = usePlayerStore.getState().tracks.map((t) => t.id);
      usePlayerStore.getState().selectTrack(ids[2]);
      usePlayerStore.getState().next();
      expect(usePlayerStore.getState().playing).toBe(false);
    });

    it('prev goes to previous track', () => {
      const ids = usePlayerStore.getState().tracks.map((t) => t.id);
      usePlayerStore.getState().selectTrack(ids[1]);
      usePlayerStore.getState().prev();
      expect(usePlayerStore.getState().currentTrackId).toBe(ids[0]);
    });

    it('prev wraps around in repeat-all mode', () => {
      const ids = usePlayerStore.getState().tracks.map((t) => t.id);
      usePlayerStore.getState().selectTrack(ids[0]);
      usePlayerStore.getState().prev();
      expect(usePlayerStore.getState().currentTrackId).toBe(ids[2]);
    });
  });

  describe('repeat and shuffle', () => {
    it('setRepeatMode changes mode', () => {
      usePlayerStore.getState().setRepeatMode('one');
      expect(usePlayerStore.getState().repeatMode).toBe('one');
    });

    it('toggleShuffle toggles shuffle', () => {
      expect(usePlayerStore.getState().shuffle).toBe(false);
      usePlayerStore.getState().toggleShuffle();
      expect(usePlayerStore.getState().shuffle).toBe(true);
    });
  });

  describe('panel', () => {
    it('togglePanel toggles open state', () => {
      expect(usePlayerStore.getState().panelOpen).toBe(false);
      usePlayerStore.getState().togglePanel();
      expect(usePlayerStore.getState().panelOpen).toBe(true);
      usePlayerStore.getState().togglePanel();
      expect(usePlayerStore.getState().panelOpen).toBe(false);
    });

    it('setPanelOpen sets explicit state', () => {
      usePlayerStore.getState().setPanelOpen(true);
      expect(usePlayerStore.getState().panelOpen).toBe(true);
      usePlayerStore.getState().setPanelOpen(false);
      expect(usePlayerStore.getState().panelOpen).toBe(false);
    });
  });

  describe('reorderTracks', () => {
    beforeEach(async () => {
      await usePlayerStore.getState().addTrack('https://example.com/a.mp3', 'A');
      await usePlayerStore.getState().addTrack('https://example.com/b.mp3', 'B');
      await usePlayerStore.getState().addTrack('https://example.com/c.mp3', 'C');
    });

    it('moves a track from one index to another', () => {
      // Move C (index 2) to index 0
      usePlayerStore.getState().reorderTracks(2, 0);
      const titles = usePlayerStore.getState().tracks.map((t) => t.title);
      expect(titles).toEqual(['C', 'A', 'B']);
    });

    it('moves a track forward', () => {
      // Move A (index 0) to index 2
      usePlayerStore.getState().reorderTracks(0, 2);
      const titles = usePlayerStore.getState().tracks.map((t) => t.title);
      expect(titles).toEqual(['B', 'C', 'A']);
    });

    it('no-ops when from === to', () => {
      usePlayerStore.getState().reorderTracks(1, 1);
      const titles = usePlayerStore.getState().tracks.map((t) => t.title);
      expect(titles).toEqual(['A', 'B', 'C']);
    });

    it('no-ops for out-of-bounds indices', () => {
      usePlayerStore.getState().reorderTracks(-1, 1);
      const titles = usePlayerStore.getState().tracks.map((t) => t.title);
      expect(titles).toEqual(['A', 'B', 'C']);

      usePlayerStore.getState().reorderTracks(0, 5);
      const titles2 = usePlayerStore.getState().tracks.map((t) => t.title);
      expect(titles2).toEqual(['A', 'B', 'C']);
    });
  });

  describe('current track title derivation', () => {
    it('returns current track when playing', async () => {
      await usePlayerStore.getState().addTrack('https://example.com/a.mp3', 'Song A');
      const { tracks, currentTrackId } = usePlayerStore.getState();
      const current = tracks.find((t) => t.id === currentTrackId);
      expect(current).toBeDefined();
      expect(current!.title).toBe('Song A');
    });

    it('returns null title when no track selected', () => {
      const { tracks, currentTrackId } = usePlayerStore.getState();
      const current = tracks.find((t) => t.id === currentTrackId);
      expect(current).toBeUndefined();
    });
  });

  describe('position persistence', () => {
    it('savePosition stores the current engine time', () => {
      (audioEngine.getCurrentTime as ReturnType<typeof vi.fn>).mockReturnValue(42);
      usePlayerStore.getState().savePosition();
      expect(usePlayerStore.getState().savedPosition).toBe(42);
    });

    it('initEngine seeks to savedPosition when resuming', () => {
      usePlayerStore.setState({
        wasPlaying: true,
        currentTrackId: 'test-id',
        tracks: [{ id: 'test-id', title: 'Test', url: 'https://example.com/a.mp3', type: 'audio' }],
        savedPosition: 42,
      });
      usePlayerStore.getState().initEngine();
      expect(audioEngine.load).toHaveBeenCalled();
      expect(audioEngine.seek).toHaveBeenCalledWith(42);
    });

    it('initEngine does not seek when savedPosition is 0', () => {
      usePlayerStore.setState({
        wasPlaying: true,
        currentTrackId: 'test-id',
        tracks: [{ id: 'test-id', title: 'Test', url: 'https://example.com/a.mp3', type: 'audio' }],
        savedPosition: 0,
      });
      usePlayerStore.getState().initEngine();
      expect(audioEngine.load).toHaveBeenCalled();
      expect(audioEngine.seek).not.toHaveBeenCalled();
    });

    it('pause saves the current position', async () => {
      (audioEngine.getCurrentTime as ReturnType<typeof vi.fn>).mockReturnValue(30);
      await usePlayerStore.getState().addTrack('https://example.com/a.mp3', 'A');
      usePlayerStore.getState().togglePlayPause(); // play
      usePlayerStore.getState().togglePlayPause(); // pause
      expect(usePlayerStore.getState().savedPosition).toBe(30);
    });

    it('periodic saving updates savedPosition during playback', () => {
      vi.useFakeTimers();
      (audioEngine.getCurrentTime as ReturnType<typeof vi.fn>).mockReturnValue(60);
      usePlayerStore.setState({ playing: true });
      usePlayerStore.getState().initEngine();

      // Advance 5 seconds — should trigger periodic save
      vi.advanceTimersByTime(5000);
      expect(usePlayerStore.getState().savedPosition).toBe(60);

      // Update mock time and advance again
      (audioEngine.getCurrentTime as ReturnType<typeof vi.fn>).mockReturnValue(65);
      vi.advanceTimersByTime(5000);
      expect(usePlayerStore.getState().savedPosition).toBe(65);

      // When not playing, should not update
      usePlayerStore.setState({ playing: false });
      (audioEngine.getCurrentTime as ReturnType<typeof vi.fn>).mockReturnValue(99);
      vi.advanceTimersByTime(5000);
      expect(usePlayerStore.getState().savedPosition).toBe(65);

      vi.useRealTimers();
    });
  });

  describe('initEngine', () => {
    it('wires onEnded callback', () => {
      usePlayerStore.getState().initEngine();
      expect(audioEngine.onEnded).toHaveBeenCalledWith(expect.any(Function));
      expect(audioEngine.setVolume).toHaveBeenCalledWith(1);
    });
  });
});
