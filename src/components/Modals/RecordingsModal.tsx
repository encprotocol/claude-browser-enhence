import { useEffect, useState, useRef } from 'react';
import { useRecordingStore } from '@/stores/recordingStore';
import { useCorrectionStore } from '@/stores/correctionStore';
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

type ViewerTab = 'terminal' | 'summary';

function SummaryTab({ recording }: { recording: Recording }) {
  const summary = useRecordingStore((s) => s.summary);
  const summaryLoading = useRecordingStore((s) => s.summaryLoading);
  const summaryError = useRecordingStore((s) => s.summaryError);
  const llmConfigured = useCorrectionStore((s) => s.llmConfigured);

  const isStale = summary && recording.events.length > summary.eventCount;

  const handleGenerate = () => {
    useRecordingStore.getState().generateSummary(recording.id);
  };

  const apiUnavailable = llmConfigured === false;

  // Backward compat: old summaries have `summary` but no `abstract`/`detail`
  const abstractText = summary?.abstract || '';
  const detailText = summary?.detail || summary?.summary || '';

  if (summaryLoading) {
    return (
      <div className="recording-summary empty">
        <div className="recording-summary-loading">
          <div className="spinner" />
          Generating summary...
        </div>
      </div>
    );
  }

  if (summaryError) {
    return (
      <div className="recording-summary empty">
        <div className="recording-summary-error">{summaryError}</div>
        <button className="recording-summary-generate" onClick={handleGenerate}>
          Retry
        </button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="recording-summary empty">
        <button
          className="recording-summary-generate"
          onClick={handleGenerate}
          disabled={apiUnavailable}
        >
          Generate Summary
        </button>
        {apiUnavailable && (
          <div className="recording-summary-disabled">
            No LLM configured. Set an API key in Settings.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="recording-summary">
      {isStale && (
        <div className="recording-summary-stale">
          New activity recorded since this summary was generated.
        </div>
      )}
      {abstractText && (
        <div className="recording-summary-abstract">{abstractText}</div>
      )}
      <div className="recording-summary-detail">{detailText}</div>
      <div className="recording-summary-footer">
        <div className="recording-summary-meta">
          Generated {formatDate(summary.generatedAt)} ({summary.eventCount} events)
        </div>
        <button
          className="recording-summary-generate"
          onClick={handleGenerate}
          disabled={apiUnavailable}
        >
          Regenerate
        </button>
      </div>
    </div>
  );
}

function BringBackButton({ recording }: { recording: Recording }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const summary = useRecordingStore((s) => s.summary);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = (mode: 'transcript' | 'summary') => {
    setOpen(false);
    useRecordingStore.getState().bringBackSession(mode);
  };

  return (
    <div className="bring-back-wrapper" ref={ref}>
      <button className="recordings-viewer-btn" onClick={() => setOpen(!open)}>
        Bring Back ▾
      </button>
      {open && (
        <div className="bring-back-dropdown">
          <button className="bring-back-option" onClick={() => handleClick('transcript')}>
            Raw Transcript
          </button>
          <button
            className="bring-back-option"
            onClick={() => handleClick('summary')}
            disabled={!summary}
          >
            Summary{!summary ? ' (none)' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

function RecordingViewer({ recording }: { recording: Recording }) {
  const [activeTab, setActiveTab] = useState<ViewerTab>('terminal');
  const handleBack = () => useRecordingStore.getState().closeViewer();

  return (
    <div className="recordings-viewer visible">
      <div className="recordings-viewer-toolbar">
        <button className="recordings-viewer-btn" onClick={handleBack}>← Back</button>
        <button
          className={`recordings-viewer-btn${activeTab === 'terminal' ? ' active' : ''}`}
          onClick={() => setActiveTab('terminal')}
        >
          Terminal
        </button>
        <button
          className={`recordings-viewer-btn${activeTab === 'summary' ? ' active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <BringBackButton recording={recording} />
        <span className="recordings-viewer-info">
          {recording.sessionName} — {recording.cwd}
        </span>
        <span className="recordings-viewer-date">
          {formatDate(recording.startedAt)} — {formatDuration(recording.startedAt, recording.endedAt)}
        </span>
      </div>
      {activeTab === 'terminal' ? (
        <div className="recordings-viewer-content recordings-viewer-terminal">
          <RecordingPlayer recording={recording} />
        </div>
      ) : (
        <div className="recordings-viewer-content">
          <SummaryTab recording={recording} />
        </div>
      )}
    </div>
  );
}

export default function RecordingsModal() {
  const visible = useRecordingStore((s) => s.visible);
  const recordings = useRecordingStore((s) => s.recordings);
  const loading = useRecordingStore((s) => s.loading);
  const viewingRecording = useRecordingStore((s) => s.viewingRecording);
  const viewingLoading = useRecordingStore((s) => s.viewingLoading);
  const lastViewedId = useRecordingStore((s) => s.lastViewedId);

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
            {loading && (
              <div key="loading" className="recordings-empty">Loading...</div>
            )}
            {!loading && recordings.length === 0 && (
              <div key="empty" className="recordings-empty">No recordings yet. Claude sessions are recorded automatically.</div>
            )}
            {!loading && recordings.map((rec) => (
              <div
                key={rec.id}
                className={`recordings-row${rec.id === lastViewedId ? ' last-viewed' : ''}`}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
