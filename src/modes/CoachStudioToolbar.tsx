import React from 'react';
import { FederationProfile, IceZone, PlayBlueprint, TeamPlayPack } from '../types/hockey';
import { soundEngine } from '../engine/SoundAndHaptics';
import { ADDABLE_STUDIO_ROLES } from './studioPackUtils';

export type StudioTool = 'MOVE' | 'SKATE_PATH' | 'GOLD_READ' | 'SILVER_READ';

interface CoachStudioToolbarProps {
  zone: IceZone;
  onSetZone: (z: IceZone) => void;
  federation: FederationProfile;
  onChangeFederation: (f: FederationProfile) => void;
  tool: StudioTool;
  onSetTool: (t: StudioTool) => void;
  playTitle: string;
  onSetPlayTitle: (s: string) => void;
  voiceCaption: string;
  onSetVoiceCaption: (s: string) => void;
  recording: boolean;
  onToggleVoice: () => void;
  onAddRole: (role: (typeof ADDABLE_STUDIO_ROLES)[number]['role'], team: 'HOME' | 'AWAY') => void;
  onPlayLive: () => void;
  onExportPack: () => void;
  onImportPlays: (plays: PlayBlueprint[]) => void;
}

export const CoachStudioToolbar: React.FC<CoachStudioToolbarProps> = ({
  zone,
  onSetZone,
  federation,
  onChangeFederation,
  tool,
  onSetTool,
  playTitle,
  onSetPlayTitle,
  voiceCaption,
  onSetVoiceCaption,
  recording,
  onToggleVoice,
  onAddRole,
  onPlayLive,
  onExportPack,
  onImportPlays,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <>
      {/* Primary Studio Action Bar: Always pinned & immediately visible on tablet & phone */}
      <div className="mode-hud-bar">
        <div className="studio-primary-actions">
          <button
            type="button"
            className="touch-btn primary-cta-btn"
            onClick={onPlayLive}
            data-testid="studio-play-live-btn"
          >
            ▶ Play Live
          </button>
          <button
            type="button"
            className="touch-btn secondary-btn"
            onClick={onToggleVoice}
            data-testid="studio-voice-btn"
          >
            {recording ? '⏹ Stop' : '🎙 10s Cue'}
          </button>
          <button
            type="button"
            className="touch-btn secondary-btn"
            onClick={onExportPack}
            data-testid="studio-export-btn"
          >
            ⬇ JSON
          </button>
          <button
            type="button"
            className="touch-btn secondary-btn"
            onClick={() => fileInputRef.current?.click()}
            data-testid="studio-import-btn"
          >
            ⬆ Load
          </button>
        </div>

        <div className="studio-select-row">
          {(['USA', 'CAN', 'IIHF'] as FederationProfile[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`touch-btn filter-chip ${federation === f ? 'active-pill' : ''}`}
              onClick={() => onChangeFederation(f)}
              data-testid={`studio-fed-${f}`}
            >
              {f}
            </button>
          ))}
          {(['HALF_3V3', 'O_ZONE', 'D_ZONE', 'FULL_ICE'] as IceZone[]).map((z) => (
            <button
              key={z}
              type="button"
              className={`touch-btn filter-chip ${zone === z ? 'active-pill' : ''}`}
              onClick={() => onSetZone(z)}
              data-testid={`studio-zone-${z}`}
            >
              {z === 'HALF_3V3' ? '3v3' : z.replace('_ZONE', '').replace('_ICE', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Secondary Drawing Tools, Skater Placement & Caption Inputs */}
      <div className="studio-controls-row">
        <div className="studio-select-row">
          {(
            [
              ['MOVE', '✥ Move', 'studio-tool-move'],
              ['SKATE_PATH', '〰 Path', 'studio-tool-path'],
              ['GOLD_READ', '🥇 Gold', 'studio-tool-gold'],
              ['SILVER_READ', '🥈 Silv', 'studio-tool-silver'],
            ] as Array<[StudioTool, string, string]>
          ).map(([id, label, tid]) => (
            <button
              key={id}
              type="button"
              className={`touch-btn filter-chip ${tool === id ? 'active-pill' : ''}`}
              onClick={() => onSetTool(id)}
              data-testid={tid}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="role-strip">
          {ADDABLE_STUDIO_ROLES.map((item) => (
            <button
              key={item.role}
              type="button"
              className="touch-btn role-chip"
              onClick={() => onAddRole(item.role, item.team)}
              data-testid={`studio-add-${item.role}`}
            >
              +{item.role}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="studio-input"
          value={playTitle}
          onChange={(e) => onSetPlayTitle(e.target.value)}
          aria-label="Play Title"
          data-testid="studio-title-input"
        />
        <input
          type="text"
          className="studio-input"
          value={voiceCaption}
          onChange={(e) => onSetVoiceCaption(e.target.value)}
          aria-label="Coach Voice Caption"
          data-testid="studio-caption-input"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const parsed = JSON.parse(String(reader.result)) as TeamPlayPack;
                if (Array.isArray(parsed.plays) && parsed.plays.length > 0) {
                  onImportPlays(parsed.plays);
                }
              } catch {
                soundEngine.emitCaption('Invalid Play Pack JSON file', 'turnover', 'IMPORT ERR');
              }
            };
            reader.readAsText(file);
          }}
        />
      </div>
    </>
  );
};
