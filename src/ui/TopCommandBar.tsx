import React from 'react';
import { Volume2, VolumeX, SlidersHorizontal, Compass, MessageSquarePlus } from 'lucide-react';
import {
  AgeTier,
  FederationProfile,
  PlayerPosition,
  PlayerProfile,
} from '../types/hockey';

interface TopCommandBarProps {
  profile: PlayerProfile;
  tierLabel: string;
  redemptionPending: number;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  onOpenNotes: () => void;
  onChangeAge: (age: AgeTier) => void;
  onChangePosition: (pos: PlayerPosition) => void;
  onChangeFederation: (fed: FederationProfile) => void;
  onToggleOrientation: () => void;
  onToggleMute: () => void;
}

const AGE_OPTIONS: Array<{ id: AgeTier; label: string }> = [
  { id: '8U', label: '8U/U9' },
  { id: '10U', label: '10U/U11' },
  { id: '12U', label: '12U/U13' },
  { id: '14U', label: '14U/U15' },
  { id: '16U_JR', label: '16U–Jr' },
];

const POS_OPTIONS: PlayerPosition[] = ['C', 'LW', 'RW', 'LD', 'RD', 'G'];
const FED_OPTIONS: FederationProfile[] = ['USA', 'CAN', 'IIHF'];

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  profile,
  tierLabel,
  redemptionPending,
  drawerOpen,
  onToggleDrawer,
  onOpenNotes,
  onChangeAge,
  onChangePosition,
  onChangeFederation,
  onToggleOrientation,
  onToggleMute,
}) => {
  return (
    <header className="top-command-bar">
      <div className="brand-cluster">
        <div className="brand-badge" data-testid="brand-title">
          <span className="brand-bolt">⚡</span>
          <span className="brand-text">SYNAPZ</span>
          <span className="brand-v2">V2</span>
        </div>

        <div className="iq-score-pill" data-testid="header-iq-pill">
          <span className="iq-num">{profile.iqScore} IQ</span>
          <span className="iq-tier-sub">{tierLabel}</span>
          {profile.streak > 0 && <span className="streak-flame">🔥{profile.streak}</span>}
          {redemptionPending > 0 && (
            <span className="redeem-dot" title="Redemption Rep Queued">
              🔁{redemptionPending}
            </span>
          )}
        </div>
      </div>

      <div className="desktop-profile-controls">
        <select
          className="arena-select"
          value={profile.ageTier}
          onChange={(e) => onChangeAge(e.target.value as AgeTier)}
          aria-label="Age Tier"
          data-testid="select-age-tier"
        >
          {AGE_OPTIONS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>

        <select
          className="arena-select"
          value={profile.position}
          onChange={(e) => onChangePosition(e.target.value as PlayerPosition)}
          aria-label="Position"
          data-testid="select-position"
        >
          {POS_OPTIONS.map((p) => (
            <option key={p} value={p}>
              Pos: {p}
            </option>
          ))}
        </select>

        <select
          className="arena-select"
          value={profile.federation}
          onChange={(e) => onChangeFederation(e.target.value as FederationProfile)}
          aria-label="Federation"
          data-testid="select-federation"
        >
          {FED_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="touch-btn icon-label-btn"
          onClick={onOpenNotes}
          title="Playtest Notes (Feedback)"
          data-testid="open-playtest-notes-btn"
        >
          <MessageSquarePlus size={18} />
          <span className="hide-xs">Notes</span>
        </button>

        <button
          type="button"
          className="touch-btn icon-label-btn"
          onClick={onToggleOrientation}
          title="Toggle Attack-Up vs Broadcast View"
          data-testid="toggle-orientation-btn"
        >
          <Compass size={18} />
          <span className="hide-xs">
            {profile.orientation === 'ATTACK_UP' ? 'Attack-Up' : 'Broadcast'}
          </span>
        </button>

        <button
          type="button"
          className="touch-btn icon-only-btn"
          onClick={onToggleMute}
          aria-label={profile.muted ? 'Unmute Arena Audio' : 'Mute Arena Audio'}
          data-testid="toggle-mute-btn"
        >
          {profile.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
        </button>

        <button
          type="button"
          className="touch-btn icon-only-btn mobile-profile-trigger"
          onClick={onToggleDrawer}
          aria-label="Quick Profile Settings"
          data-testid="mobile-profile-btn"
        >
          <SlidersHorizontal size={19} />
        </button>
      </div>

      {drawerOpen && (
        <div className="mobile-profile-sheet" data-testid="mobile-profile-sheet">
          <div className="sheet-row">
            {AGE_OPTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`touch-btn filter-chip ${profile.ageTier === a.id ? 'active-pill' : ''}`}
                onClick={() => onChangeAge(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="sheet-row">
            {POS_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                className={`touch-btn role-chip ${profile.position === p ? 'active-pill' : ''}`}
                onClick={() => onChangePosition(p)}
              >
                {p}
              </button>
            ))}
            {FED_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                className={`touch-btn filter-chip ${profile.federation === f ? 'active-pill' : ''}`}
                onClick={() => onChangeFederation(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
