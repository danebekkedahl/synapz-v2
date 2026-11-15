import React, { useState } from 'react';
import { Copy, Share2, X, Check } from 'lucide-react';
import {
  PlaytestNoteEntry,
  STORAGE_KEYS,
  readV2Storage,
  writeV2Storage,
} from '../engine/StorageIsolation';
import { AppModeId } from '../types/hockey';

interface PlaytestNotesModalProps {
  open: boolean;
  activeMode: AppModeId;
  onClose: () => void;
}

const NOTE_TAGS = ['Live Read', 'Position Lab', 'Scanner', 'Coach Studio', 'Device UX'];

export const PlaytestNotesModal: React.FC<PlaytestNotesModalProps> = ({
  open,
  activeMode,
  onClose,
}) => {
  const [notes, setNotes] = useState<PlaytestNoteEntry[]>(() =>
    readV2Storage<PlaytestNoteEntry[]>(STORAGE_KEYS.PLAYTEST_NOTES, [])
  );
  const [tag, setTag] = useState<string>(NOTE_TAGS[0]);
  const [draft, setDraft] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  if (!open) return null;

  const deviceSummary =
    typeof window !== 'undefined'
      ? `${window.innerWidth}×${window.innerHeight} · DPR ${(window.devicePixelRatio || 1).toFixed(1)}`
      : 'Unknown';

  const handleAddNote = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const entry: PlaytestNoteEntry = {
      id: `note_${Date.now()}`,
      tag,
      text: trimmed,
      deviceSummary: `${deviceSummary} · ${activeMode}`,
      createdAt: new Date().toLocaleTimeString(),
    };
    const updated = [entry, ...notes].slice(0, 30);
    setNotes(updated);
    writeV2Storage(STORAGE_KEYS.PLAYTEST_NOTES, updated);
    setDraft('');
  };

  const buildReportText = (): string => {
    const header = `SYNAPZ V2 Playtest Feedback (${deviceSummary})`;
    const lines = notes.map((n) => `- [${n.tag}] ${n.text} (${n.deviceSummary})`);
    if (draft.trim()) lines.unshift(`- [${tag}] ${draft.trim()} (${deviceSummary})`);
    return [header, ...lines].join('\n');
  };

  const handleCopy = async () => {
    const report = buildReportText();
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleShare = async () => {
    const report = buildReportText();
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'SYNAPZ V2 Playtest Notes', text: report });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    await handleCopy();
  };

  return (
    <div
      className="notes-modal-backdrop"
      onClick={onClose}
      data-testid="playtest-notes-backdrop"
    >
      <div
        className="notes-drawer-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Playtest Notes"
        data-testid="playtest-notes-drawer"
      >
        <div className="notes-drawer-header">
          <div>
            <strong>📝 Playtest Notes</strong>
            <span className="notes-device-sub">{deviceSummary}</span>
          </div>
          <button
            type="button"
            className="touch-btn icon-only-btn"
            onClick={onClose}
            aria-label="Close Playtest Notes"
            data-testid="close-playtest-notes-btn"
          >
            <X size={18} />
          </button>
        </div>

        <div className="notes-tag-row">
          {NOTE_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              className={`touch-btn filter-chip ${tag === t ? 'active-pill' : ''}`}
              onClick={() => setTag(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <textarea
          className="notes-textarea"
          rows={3}
          placeholder="Jot quick coaching or device feedback..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          data-testid="playtest-notes-input"
        />

        <div className="notes-action-row">
          <button
            type="button"
            className="touch-btn primary-cta-btn"
            onClick={handleAddNote}
            data-testid="save-playtest-note-btn"
          >
            + Save Note
          </button>
          <button
            type="button"
            className="touch-btn secondary-btn"
            onClick={handleCopy}
            data-testid="copy-playtest-notes-btn"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          <button
            type="button"
            className="touch-btn secondary-btn"
            onClick={handleShare}
            data-testid="share-playtest-notes-btn"
          >
            <Share2 size={16} />
            <span>Share</span>
          </button>
        </div>

        {notes.length > 0 && (
          <ul className="notes-saved-list" data-testid="playtest-notes-list">
            {notes.map((n) => (
              <li key={n.id}>
                <span className="note-pill">{n.tag}</span>
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
