import { usePlayerStore } from '@/stores/playerStore';
import { useFileBrowserStore } from '@/stores/fileBrowserStore';

export default function PlayerButton() {
  const playing = usePlayerStore((s) => s.playing);
  const togglePanel = usePlayerStore((s) => s.togglePanel);
  const tracks = usePlayerStore((s) => s.tracks);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);

  const currentTrack = tracks.find((t) => t.id === currentTrackId);

  const handleToggle = () => {
    const willOpen = !usePlayerStore.getState().panelOpen;
    if (willOpen) {
      useFileBrowserStore.getState().setVisible(false);
    }
    togglePanel();
  };

  return (
    <div className="player-btn-wrapper">
      <button
        className={`settings-btn${playing ? ' player-active' : ''}`}
        title="Music (⌘M)"
        onClick={handleToggle}
      >
        {playing ? '♫' : '♪'}
      </button>
      {playing && currentTrack && (
        <span className="player-now-playing" title={currentTrack.title}>
          {currentTrack.title}
        </span>
      )}
    </div>
  );
}
