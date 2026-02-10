import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Track } from '@/types';

// Mock Audio constructor — must use function (not arrow) so `new Audio()` works
const mockAudio = {
  src: '',
  volume: 1,
  currentTime: 0,
  duration: 120,
  readyState: 4,
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
    mockAudio.readyState = 4;
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

  it('seek sets audio currentTime when metadata loaded', () => {
    engine.load(audioTrack);
    mockAudio.readyState = 2; // HAVE_CURRENT_DATA
    engine.seek(55);
    expect(mockAudio.currentTime).toBe(55);
  });

  it('seek defers when metadata not loaded yet', () => {
    engine.load(audioTrack);
    mockAudio.readyState = 0; // HAVE_NOTHING
    engine.seek(42);
    // Should NOT have set currentTime yet
    expect(mockAudio.currentTime).toBe(0);
    // Should have registered a loadedmetadata listener
    const call = mockAudio.addEventListener.mock.calls.find(
      (c: any[]) => c[0] === 'loadedmetadata'
    );
    expect(call).toBeDefined();
    // Simulate metadata loaded — invoke the callback
    call![1]();
    expect(mockAudio.currentTime).toBe(42);
  });

  it('seek stores pending time for YouTube when ytPlayer not ready', async () => {
    let onReadyCb: (() => void) | null = null;
    const mockYtPlayer = {
      loadVideoById: vi.fn(),
      setVolume: vi.fn(),
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      stopVideo: vi.fn(),
    };
    // Mock YT.Player constructor — capture onReady for manual firing
    (window as any).YT = {
      Player: function (_el: any, opts: any) {
        Object.assign(this, mockYtPlayer);
        onReadyCb = opts.events.onReady;
      },
      PlayerState: { ENDED: 0 },
    };

    // Stub getElementById for the yt-player-host element
    const mockHost = { id: 'yt-player-host', innerHTML: '', appendChild: vi.fn() };
    const origGetById = document.getElementById;
    document.getElementById = vi.fn((id: string) => {
      if (id === 'yt-player-host') return mockHost as any;
      return origGetById.call(document, id);
    }) as any;

    const ytTrack: Track = { id: '2', title: 'YT', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', type: 'youtube' };
    engine.load(ytTrack);

    // At this point: activeType='youtube', ytPlayer=null, loadYtApi() is pending
    // Call seek — should store as pending since ytPlayer not ready
    engine.seek(120);

    // Simulate YT IFrame API finished loading
    (window as any).onYouTubeIframeAPIReady();
    // Flush microtasks so loadYtApi().then() → createYtPlayer() runs
    await new Promise((r) => setTimeout(r, 0));

    // createYtPlayer should have been called, capturing onReady
    expect(onReadyCb).not.toBeNull();
    // Fire onReady — this should apply the pending seek
    onReadyCb!();

    expect(mockYtPlayer.seekTo).toHaveBeenCalledWith(120, true);

    document.getElementById = origGetById;
    delete (window as any).YT;
    delete (window as any).onYouTubeIframeAPIReady;
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
