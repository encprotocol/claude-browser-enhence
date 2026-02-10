import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Track } from '@/types';

// Mock Audio constructor — must use function (not arrow) so `new Audio()` works
const mockAudio = {
  src: '',
  volume: 1,
  currentTime: 0,
  duration: 120,
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
vi.stubGlobal('Audio', function () { return mockAudio; });

describe('audioEngine', () => {
  let engine: typeof import('@/lib/audioEngine');

  beforeEach(async () => {
    vi.resetModules();
    mockAudio.src = '';
    mockAudio.volume = 1;
    mockAudio.currentTime = 0;
    mockAudio.duration = 120;
    mockAudio.play.mockReset().mockResolvedValue(undefined);
    mockAudio.pause.mockReset();
    mockAudio.addEventListener.mockReset();
    mockAudio.removeEventListener.mockReset();
    engine = await import('@/lib/audioEngine');
  });

  const audioTrack: Track = {
    id: '1',
    title: 'Test Song',
    url: 'https://example.com/song.mp3',
    type: 'audio',
  };

  it('extractYouTubeId parses standard URL', () => {
    expect(engine.extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extractYouTubeId parses short URL', () => {
    expect(engine.extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extractYouTubeId returns null for non-YouTube', () => {
    expect(engine.extractYouTubeId('https://example.com/song.mp3')).toBeNull();
  });

  it('loads an audio track and sets src', () => {
    engine.load(audioTrack);
    expect(mockAudio.src).toBe('https://example.com/song.mp3');
  });

  it('play calls Audio.play()', async () => {
    engine.load(audioTrack);
    await engine.play();
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('pause calls Audio.pause()', () => {
    engine.load(audioTrack);
    engine.pause();
    expect(mockAudio.pause).toHaveBeenCalled();
  });

  it('stop pauses and resets src', () => {
    engine.load(audioTrack);
    engine.stop();
    expect(mockAudio.pause).toHaveBeenCalled();
    expect(mockAudio.src).toBe('');
  });

  it('setVolume clamps to 0-1 range for Audio', () => {
    // Need to load a track so audioEl exists
    engine.load(audioTrack);
    engine.setVolume(0.5);
    expect(mockAudio.volume).toBe(0.5);
    engine.setVolume(1.5);
    expect(mockAudio.volume).toBe(1);
    engine.setVolume(-0.5);
    expect(mockAudio.volume).toBe(0);
  });

  it('onEnded registers callback', () => {
    const cb = vi.fn();
    engine.load(audioTrack); // ensure audioEl is created
    engine.onEnded(cb);
    // The audioEl already has listener from getAudio(); onEnded also adds via removeEventListener + addEventListener
    expect(mockAudio.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
  });

  it('play catches rejected promise (autoplay policy)', async () => {
    engine.load(audioTrack);
    mockAudio.play.mockRejectedValueOnce(new Error('autoplay blocked'));
    const result = await engine.play();
    expect(result).toBe(false);
  });

  it('getActiveType returns null with no track loaded', () => {
    expect(engine.getActiveType()).toBeNull();
  });

  it('getActiveType returns audio after loading audio track', () => {
    engine.load(audioTrack);
    expect(engine.getActiveType()).toBe('audio');
  });

  it('destroy resets state', () => {
    engine.load(audioTrack);
    engine.destroy();
    expect(engine.getActiveType()).toBeNull();
  });

  it('getCurrentTime returns audio currentTime', () => {
    engine.load(audioTrack);
    mockAudio.currentTime = 42;
    expect(engine.getCurrentTime()).toBe(42);
  });

  it('getCurrentTime returns 0 when no track loaded', () => {
    expect(engine.getCurrentTime()).toBe(0);
  });

  it('getDuration returns audio duration', () => {
    engine.load(audioTrack);
    mockAudio.duration = 200;
    expect(engine.getDuration()).toBe(200);
  });

  it('getDuration returns 0 when no track loaded', () => {
    expect(engine.getDuration()).toBe(0);
  });

  it('seek sets audio currentTime', () => {
    engine.load(audioTrack);
    engine.seek(55);
    expect(mockAudio.currentTime).toBe(55);
  });

  describe('fetchTrackInfo', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('fetches YouTube title via oEmbed', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ title: 'AMBIENT TECHNO || mix 002 by Rob Jenkins' }),
      }) as any;
      const info = await engine.fetchTrackInfo('https://www.youtube.com/watch?v=2F6B9EibJjw');
      expect(info.title).toBe('AMBIENT TECHNO || mix 002 by Rob Jenkins');
      expect(info.type).toBe('youtube');
      expect(info.playable).toBe(true);
    });

    it('returns playable=false for invalid YouTube video', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as any;
      const info = await engine.fetchTrackInfo('https://www.youtube.com/watch?v=XXXXXXXXXXX');
      expect(info.playable).toBe(false);
    });

    it('extracts filename for audio URLs', async () => {
      const info = await engine.fetchTrackInfo('https://example.com/music/ambient-mix.mp3');
      expect(info.title).toBe('ambient-mix');
      expect(info.type).toBe('audio');
      expect(info.playable).toBe(true);
    });

    it('strips extra YouTube URL params from the clean URL', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ title: 'Some Video' }),
      }) as any;
      const info = await engine.fetchTrackInfo('https://www.youtube.com/watch?v=2F6B9EibJjw&list=RD2F6B9EibJjw&t=819s');
      expect(info.playable).toBe(true);
      expect(info.title).toBe('Some Video');
      const fetchCall = (globalThis.fetch as any).mock.calls[0][0] as string;
      expect(fetchCall).toContain('v%3D2F6B9EibJjw');
    });

    it('handles network errors gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error')) as any;
      const info = await engine.fetchTrackInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(info.playable).toBe(false);
    });
  });
});
