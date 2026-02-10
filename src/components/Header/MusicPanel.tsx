import { useState, useRef, useEffect, useCallback } from 'react';
import { usePlayerStore } from '@/stores/playerStore';
import * as audioEngine from '@/lib/audioEngine';
import type { RepeatMode } from '@/types';

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MusicPanel() {
  const tracks = usePlayerStore((s) => s.tracks);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const playing = usePlayerStore((s) => s.playing);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const addingTrack = usePlayerStore((s) => s.addingTrack);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const setRepeatMode = usePlayerStore((s) => s.setRepeatMode);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const addTrack = usePlayerStore((s) => s.addTrack);
  const removeTrack = usePlayerStore((s) => s.removeTrack);
  const selectTrack = usePlayerStore((s) => s.selectTrack);
  const reorderTracks = usePlayerStore((s) => s.reorderTracks);
  const setPanelOpen = usePlayerStore((s) => s.setPanelOpen);

  const [newTrackUrl, setNewTrackUrl] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  // Progress bar state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const rafRef = useRef<number>(0);

  const currentTrack = tracks.find((t) => t.id === currentTrackId);

  // Poll playback position
  const tick = useCallback(() => {
    setCurrentTime(audioEngine.getCurrentTime());
    setDuration(audioEngine.getDuration());
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (playing) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
      // Update once when paused so the bar shows current pos
      setCurrentTime(audioEngine.getCurrentTime());
      setDuration(audioEngine.getDuration());
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, tick]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur = audioEngine.getDuration();
    if (dur > 0) audioEngine.seek(ratio * dur);
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  const handleAdd = () => {
    if (newTrackUrl.trim() && !addingTrack) {
      const url = newTrackUrl.trim();
      setNewTrackUrl('');
      addTrack(url);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    setDragIdx(idx);
    dragNodeRef.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx !== null && idx !== dragOverIdx) {
      setDragOverIdx(idx);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) {
      reorderTracks(dragIdx, idx);
    }
    setDragIdx(null);
    setDragOverIdx(null);
    dragNodeRef.current = null;
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
    dragNodeRef.current = null;
  };

  return (
    <div className="music-panel">
      <div className="music-panel-header">
        <span className="music-panel-title">Music</span>
        <button className="music-panel-close" onClick={() => setPanelOpen(false)}>×</button>
      </div>

      {/* Transport */}
      <div className="music-panel-transport">
        <div className="player-track-name">
          {currentTrack ? currentTrack.title : 'No track'}
        </div>
        <div className="player-controls">
          <button onClick={prev} disabled={tracks.length === 0} title="Previous">⏮</button>
          <button onClick={togglePlayPause} disabled={tracks.length === 0} title={playing ? 'Pause' : 'Play'}>
            {playing ? '⏸' : '▶'}
          </button>
          <button onClick={next} disabled={tracks.length === 0} title="Next">⏭</button>
        </div>
        <div className="player-progress-row">
          <span className="player-progress-time">{formatTime(currentTime)}</span>
          <div className="player-progress-bar" onClick={handleSeek}>
            <div className="player-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="player-progress-time">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Mode */}
      <div className="music-panel-mode">
        <div className="music-mode-row">
          <span className="music-mode-label">Order</span>
          <button
            className={`music-mode-btn${!shuffle ? ' active' : ''}`}
            onClick={() => { if (shuffle) toggleShuffle(); }}
          >Sequential</button>
          <button
            className={`music-mode-btn${shuffle ? ' active' : ''}`}
            onClick={() => { if (!shuffle) toggleShuffle(); }}
          >Random</button>
        </div>
        <div className="music-mode-row">
          <span className="music-mode-label">Repeat</span>
          {(['none', 'all', 'one'] as RepeatMode[]).map((mode) => (
            <button
              key={mode}
              className={`music-mode-btn${repeatMode === mode ? ' active' : ''}`}
              onClick={() => setRepeatMode(mode)}
            >{mode === 'none' ? 'Off' : mode === 'all' ? 'All' : 'One'}</button>
          ))}
        </div>
      </div>

      {/* Add track */}
      <div className="music-panel-add">
        <input
          type="text"
          placeholder="YouTube or audio URL..."
          value={newTrackUrl}
          disabled={addingTrack}
          onChange={(e) => setNewTrackUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
        />
        <button disabled={addingTrack} onClick={handleAdd}>
          {addingTrack ? '...' : '+'}
        </button>
      </div>

      {/* Track list */}
      <div className="music-panel-tracks">
        {tracks.length === 0 && (
          <div className="music-panel-empty">No tracks added yet</div>
        )}
        {tracks.map((track, idx) => (
          <div
            key={track.id}
            className={
              `player-track-item${track.id === currentTrackId ? ' active' : ''}` +
              `${dragIdx === idx ? ' dragging' : ''}` +
              `${dragOverIdx === idx && dragIdx !== idx ? ' drag-over' : ''}`
            }
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            onClick={() => selectTrack(track.id)}
          >
            <span className="player-track-drag-handle">⠿</span>
            <span className="player-track-type">{track.type === 'youtube' ? '▶' : '♪'}</span>
            <span className="player-track-title">{track.title}</span>
            <button
              className="player-track-delete"
              onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}
              title="Remove track"
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
