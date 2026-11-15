import React from 'react';
import { Zap, Magnet, Eye, Radar, ClipboardPen } from 'lucide-react';
import { AppModeId } from '../types/hockey';

interface TabletRailProps {
  activeMode: AppModeId;
  onSelectMode: (mode: AppModeId) => void;
}

const RAIL_ITEMS: Array<{
  id: AppModeId;
  shortLabel: string;
  fullLabel: string;
  Icon: React.ComponentType<{ size?: number }>;
}> = [
  { id: 'LIVE_READ', shortLabel: 'Live Read', fullLabel: '⚡ Live Read', Icon: Zap },
  { id: 'POSITION_LAB', shortLabel: 'Pos Lab', fullLabel: '🧲 Position Lab', Icon: Magnet },
  { id: 'HEAD_UP_SCAN', shortLabel: 'Scan', fullLabel: '👀 Head-Up Scan', Icon: Eye },
  { id: 'MY_IQ', shortLabel: 'My IQ', fullLabel: '📊 My Hockey IQ', Icon: Radar },
  { id: 'COACH_STUDIO', shortLabel: 'Studio', fullLabel: '📋 Coach Studio', Icon: ClipboardPen },
];

export const TabletRail: React.FC<TabletRailProps> = ({ activeMode, onSelectMode }) => {
  return (
    <nav className="tablet-rail" aria-label="Primary Game Modes">
      {RAIL_ITEMS.map(({ id, shortLabel, Icon }) => {
        const active = activeMode === id;
        return (
          <button
            key={id}
            type="button"
            className={`rail-item ${active ? 'rail-item-active' : ''}`}
            onClick={() => onSelectMode(id)}
            aria-current={active ? 'page' : undefined}
            data-testid={`rail-tab-${id}`}
          >
            <Icon size={22} />
            <span className="rail-label">{shortLabel}</span>
          </button>
        );
      })}
    </nav>
  );
};
