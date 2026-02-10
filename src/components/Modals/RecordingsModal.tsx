import { useEffect } from 'react';
import { useRecordingStore } from '@/stores/recordingStore';
import RecordingPlayer from '@/components/Modals/RecordingPlayer';
import type { Recording } from '@/types';

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'Interrupted';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function RecordingViewer({ recording }: { recording: Recording }) {
  const handleBack = () => useRecordingStore.getState().closeViewer();

  return (
    <div className="recordings-viewer visible">
      <div className="recordings-viewer-toolbar">
        <button className="recordings-viewer-btn" onClick={handleBack}>← Back</button>
        <span className="recordings-viewer-info">
          {recording.sessionName} — {recording.cwd}
        </span>
        <span className="recordings-viewer-date">
          {formatDate(recording.startedAt)} — {formatDuration(recording.startedAt, recording.endedAt)}
        </span>
      </div>
      <div className="recordings-viewer-content recordings-viewer-terminal">
        <RecordingPlayer recording={recording} />
      </div>
    </div>
  );
}

export default function RecordingsModal() {
  const visible = useRecordingStore((s) => s.visible);
  const recordings = useRecordingStore((s) => s.recordings);
  const loading = useRecordingStore((s) => s.loading);
  const viewingRecording = useRecordingStore((s) => s.viewingRecording);
  const viewingLoading = useRecordingStore((s) => s.viewingLoading);

  useEffect(() => {
    if (visible) useRecordingStore.getState().load();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        useRecordingStore.getState().setVisible(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, viewingRecording]);

  if (!visible) return null;

  const handleClose = () => {
    useRecordingStore.getState().setVisible(false);
  };

  return (
    <div className="recordings-modal visible" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="recordings-panel">
        <div className="recordings-header">
          <h2>Recordings</h2>
          <button className="recordings-close" onClick={handleClose}>×</button>
        </div>

        {viewingRecording ? (
          <RecordingViewer recording={viewingRecording} />
        ) : viewingLoading ? (
          <div className="recordings-empty">Loading...</div>
        ) : (
          <div className="recordings-list">
            {loading ? (
              <div className="recordings-empty">Loading...</div>
            ) : recordings.length === 0 ? (
              <div className="recordings-empty">No recordings yet. Claude sessions are recorded automatically.</div>
            ) : (
              recordings.map((rec) => (
                <div
                  key={rec.id}
                  className="recordings-row"
                  onClick={() => useRecordingStore.getState().viewRecording(rec.id)}
                >
                  <span className="recordings-row-path">{rec.cwd}</span>
                  {rec.firstInput && <span className="recordings-row-input">{rec.firstInput}</span>}
                  <span className="recordings-row-date">{formatDate(rec.startedAt)}</span>
                  <button
                    className="recordings-row-delete"
                    title="Delete recording"
                    onClick={(e) => {
                      e.stopPropagation();
                      useRecordingStore.getState().deleteRecording(rec.id);
                    }}
                  >×</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
