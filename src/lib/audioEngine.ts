import type { Track, TrackType } from '@/types';

/** Extract YouTube video ID from URL (domain-aware to avoid false positives) */
export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const match = u.pathname.match(/^\/(?:embed|v)\/([a-zA-Z0-9_-]{11})/);
      return match ? match[1] : null;
    }
  } catch {
    // Invalid URL
  }
  return null;
}

// Module-level singleton state
let audioEl: HTMLAudioElement | null = null;
let ytPlayer: any = null;
let ytReady = false;
let ytApiLoading = false;
let activeType: TrackType | null = null;
let endedCallback: (() => void) | null = null;
let currentVolume = 0.5;
let pendingYtTrack: Track | null = null;
let pendingSeekTime: number | null = null;

function getAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.addEventListener('ended', () => {
      if (endedCallback && activeType === 'audio') endedCallback();
    });
  }
  return audioEl;
}

function ensureYtHost(): HTMLElement {
  let host = document.getElementById('yt-player-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'yt-player-host';
    document.body.appendChild(host);
  }
  return host;
}

function loadYtApi(): Promise<void> {
  if (ytReady) return Promise.resolve();
  if (ytApiLoading) return new Promise((resolve) => {
    const check = setInterval(() => { if (ytReady) { clearInterval(check); resolve(); } }, 100);
  });
  ytApiLoading = true;
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      ytApiLoading = false;
      console.warn('Failed to load YouTube IFrame API');
      reject(new Error('YT API load failed'));
    };
    (window as any).onYouTubeIframeAPIReady = () => {
      ytReady = true;
      ytApiLoading = false;
      resolve();
    };
    document.head.appendChild(script);
  });
}

function createYtPlayer(videoId: string) {
  if (ytPlayer) {
    ytPlayer.loadVideoById(videoId);
    ytPlayer.setVolume(currentVolume * 100);
    return;
  }
  const host = ensureYtHost();
  // YT.Player replaces the host div — need a child div
  const container = document.createElement('div');
  host.innerHTML = '';
  host.appendChild(container);

  ytPlayer = new (window as any).YT.Player(container, {
    height: '0',
    width: '0',
    videoId,
    playerVars: { autoplay: 1, controls: 0 },
    events: {
      onReady: () => {
        ytPlayer.setVolume(currentVolume * 100);
        if (pendingSeekTime !== null) {
          ytPlayer.seekTo(pendingSeekTime, true);
          pendingSeekTime = null;
        }
      },
      onStateChange: (event: any) => {
        if (event.data === (window as any).YT.PlayerState.ENDED) {
          if (endedCallback) endedCallback();
        }
      },
      onError: () => {
        // Skip errored videos
        if (endedCallback) endedCallback();
      },
    },
  });
}

/** Load a track into the engine */
export function load(track: Track) {
  // Stop whatever was playing
  stop();
  activeType = track.type;

  if (track.type === 'audio') {
    const audio = getAudio();
    audio.src = track.url;
    audio.volume = currentVolume;
  } else {
    const videoId = extractYouTubeId(track.url);
    if (!videoId) return;
    if (!ytReady) {
      pendingYtTrack = track;
      loadYtApi().then(() => {
        if (pendingYtTrack === track) {
          createYtPlayer(videoId);
          pendingYtTrack = null;
        }
      }).catch(() => {
        activeType = null;
      });
    } else {
      createYtPlayer(videoId);
    }
  }
}

/** Play current track. Returns false if autoplay was blocked. */
export async function play(): Promise<boolean> {
  if (activeType === 'audio') {
    const audio = getAudio();
    try {
      await audio.play();
      return true;
    } catch {
      return false;
    }
  } else if (activeType === 'youtube' && ytPlayer?.playVideo) {
    ytPlayer.playVideo();
    return true;
  }
  return false;
}

/** Pause current track */
export function pause() {
  if (activeType === 'audio') {
    getAudio().pause();
  } else if (activeType === 'youtube' && ytPlayer?.pauseVideo) {
    ytPlayer.pauseVideo();
  }
}

/** Stop and unload current track */
export function stop() {
  if (activeType === 'audio' && audioEl) {
    audioEl.pause();
    audioEl.src = '';
  } else if (activeType === 'youtube' && ytPlayer?.stopVideo) {
    ytPlayer.stopVideo();
  }
  activeType = null;
  pendingSeekTime = null;
}

/** Set volume 0-1 */
export function setVolume(v: number) {
  currentVolume = Math.max(0, Math.min(1, v));
  if (audioEl) audioEl.volume = currentVolume;
  if (ytPlayer?.setVolume) ytPlayer.setVolume(currentVolume * 100);
}

/** Register ended callback */
export function onEnded(cb: () => void) {
  endedCallback = cb;
  // Also ensure Audio element has the listener
  if (audioEl) {
    audioEl.removeEventListener('ended', handleAudioEnded);
    audioEl.addEventListener('ended', handleAudioEnded);
  }
}

function handleAudioEnded() {
  if (endedCallback && activeType === 'audio') endedCallback();
}

/** Get current active type */
export function getActiveType(): TrackType | null {
  return activeType;
}

/** Get current playback position in seconds */
export function getCurrentTime(): number {
  if (activeType === 'audio' && audioEl) return audioEl.currentTime;
  if (activeType === 'youtube' && ytPlayer?.getCurrentTime) return ytPlayer.getCurrentTime();
  return 0;
}

/** Get track duration in seconds */
export function getDuration(): number {
  if (activeType === 'audio' && audioEl) return audioEl.duration || 0;
  if (activeType === 'youtube' && ytPlayer?.getDuration) return ytPlayer.getDuration();
  return 0;
}

/** Seek to position in seconds (defers if audio metadata not loaded yet or YT player not ready) */
export function seek(time: number) {
  if (activeType === 'audio' && audioEl) {
    if (audioEl.readyState >= 1) {
      audioEl.currentTime = time;
    } else {
      audioEl.addEventListener('loadedmetadata', () => {
        if (audioEl) audioEl.currentTime = time;
      }, { once: true });
    }
  } else if (activeType === 'youtube') {
    if (ytPlayer?.seekTo) {
      ytPlayer.seekTo(time, true);
    } else {
      pendingSeekTime = time;
    }
  }
}

export interface TrackInfo {
  title: string;
  type: 'youtube' | 'audio';
  playable: boolean;
  cleanUrl: string;
}

/** Fetch track metadata — verifies playability and extracts title */
export async function fetchTrackInfo(url: string): Promise<TrackInfo> {
  const videoId = extractYouTubeId(url);

  if (videoId) {
    // Build a clean YouTube URL (strip list, t, start_radio params)
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
      const res = await fetch(oembedUrl);
      if (!res.ok) {
        return { title: 'Unknown', type: 'youtube', playable: false, cleanUrl };
      }
      const data = await res.json();
      return { title: data.title || 'Unknown', type: 'youtube', playable: true, cleanUrl };
    } catch {
      return { title: 'Unknown', type: 'youtube', playable: false, cleanUrl };
    }
  }

  // Audio URL — extract filename as title
  let title = 'Unknown';
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() || '';
    // Remove extension
    title = filename.replace(/\.[^.]+$/, '') || new URL(url).hostname;
  } catch {
    // invalid URL
  }
  return { title, type: 'audio', playable: true, cleanUrl: url };
}

/** Clean up everything */
export function destroy() {
  stop();
  if (audioEl) {
    audioEl.removeEventListener('ended', handleAudioEnded);
    audioEl = null;
  }
  if (ytPlayer?.destroy) {
    ytPlayer.destroy();
    ytPlayer = null;
  }
  endedCallback = null;
  activeType = null;
}
