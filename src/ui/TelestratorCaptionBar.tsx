import React, { useEffect, useState } from 'react';
import { soundEngine } from '../engine/SoundAndHaptics';
import { CaptionEvent } from '../types/hockey';

export const TelestratorCaptionBar: React.FC = () => {
  const [caption, setCaption] = useState<CaptionEvent>({
    id: 0,
    text: 'SYNAPZ Arena Ready — Tap open tape, curve-swipe to saucer, or drag to skate!',
    tone: 'cue',
    sfxTag: 'ARENA LIVE',
    timestamp: Date.now(),
  });

  useEffect(() => {
    return soundEngine.subscribeCaptions((evt) => {
      setCaption(evt);
    });
  }, []);

  return (
    <div
      className={`telestrator-caption-bar tone-${caption.tone}`}
      role="status"
      aria-live="polite"
      data-testid="telestrator-caption-bar"
    >
      <span className="caption-sfx-tag">{caption.sfxTag}</span>
      <span className="caption-message">{caption.text}</span>
    </div>
  );
};
