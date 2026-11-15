import React from 'react';
import { AdaptiveDifficultyParams } from '../curriculum/AdaptiveIqDirector';
import { getPillarMeta } from '../curriculum/PillarsData';
import { AppModeId, PlayBlueprint, PlayerProfile } from '../types/hockey';

interface DesktopTelemetryAsideProps {
  activeMode: AppModeId;
  activePlay: PlayBlueprint;
  profile: PlayerProfile;
  adaptive: AdaptiveDifficultyParams;
  onNextShift: () => void;
  onToggleOrientation: () => void;
  onOpenNotes: () => void;
}

export const DesktopTelemetryAside: React.FC<DesktopTelemetryAsideProps> = ({
  activeMode,
  activePlay,
  profile,
  adaptive,
  onNextShift,
  onToggleOrientation,
  onOpenNotes,
}) => {
  const pillar = getPillarMeta(activePlay.pillar);

  return (
    <aside className="desktop-telemetry-aside" aria-label="Live Shift Telemetry" data-testid="desktop-telemetry-aside">
      <div className="aside-section">
        <span className="aside-kicker">ACTIVE TACTICAL PILLAR</span>
        <strong className="aside-title">
          {pillar.code} · {pillar.shortTitle}
        </strong>
        <p className="aside-desc">{pillar.cueSummary}</p>
      </div>

      <div className="aside-section">
        <span className="aside-kicker">ADAPTIVE IQ DIRECTOR</span>
        <div className="telemetry-kv-grid">
          <div className="telemetry-kv">
            <span>Speed</span>
            <strong>{adaptive.skaterSpeedScale}x</strong>
          </div>
          <div className="telemetry-kv">
            <span>Read Win</span>
            <strong>{(adaptive.readWindowMs / 1000).toFixed(1)}s</strong>
          </div>
          <div className="telemetry-kv">
            <span>Scan Win</span>
            <strong>{(adaptive.scanWindowMs / 1000).toFixed(1)}s</strong>
          </div>
          <div className="telemetry-kv">
            <span>Bait Rate</span>
            <strong>{Math.round(adaptive.deceptionIntensity * 100)}%</strong>
          </div>
        </div>
      </div>

      <div className="aside-section">
        <span className="aside-kicker">PC KEYBOARD CONTROLS</span>
        <ul className="kbd-list">
          <li>
            <kbd>Space</kbd>
            <span>Start / Next Shift</span>
          </li>
          <li>
            <kbd>1–5</kbd>
            <span>Switch Modes ({activeMode.replace('_', ' ')})</span>
          </li>
          <li>
            <kbd>Esc</kbd>
            <span>Close Drawer / Modal</span>
          </li>
        </ul>
      </div>

      <div className="aside-actions-stack">
        <button type="button" className="touch-btn primary-cta-btn" onClick={onNextShift}>
          ↻ Next Rep / Shift
        </button>
        <button type="button" className="touch-btn secondary-btn" onClick={onToggleOrientation}>
          ↕ View: {profile.orientation === 'ATTACK_UP' ? 'Attack-Up' : 'Broadcast'}
        </button>
        <button type="button" className="touch-btn secondary-btn" onClick={onOpenNotes}>
          📝 Playtest Notes
        </button>
      </div>
    </aside>
  );
};
