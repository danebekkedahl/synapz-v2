import { TacticalScenarioId } from './PositionModel';
import { PlayerPosition, Vec2 } from '../types/hockey';

export const ROLES_LIST: PlayerPosition[] = ['C', 'LW', 'RW', 'LD', 'RD', 'G'];

export interface OffPuckQuizPreset {
  scenario: TacticalScenarioId;
  puck: Vec2;
  prompt: string;
}

export const OFF_PUCK_QUIZ_PRESETS: OffPuckQuizPreset[] = [
  {
    scenario: 'DZ_COVERAGE',
    puck: { x: 82, y: 172 },
    prompt: 'Puck in right D-corner — Drag YOU to proper D-Zone structure!',
  },
  {
    scenario: 'BREAKOUT',
    puck: { x: 24, y: 178 },
    prompt: 'Partner retrieves left corner — Drag YOU to your Breakout outlet!',
  },
  {
    scenario: 'OZ_CYCLE',
    puck: { x: 18, y: 26 },
    prompt: 'Linemate cycles deep left — Drag YOU into O-Zone triangle balance!',
  },
  {
    scenario: 'HALF_3V3',
    puck: { x: 76, y: 40 },
    prompt: '3v3 flank possession — Drag YOU into open support triangle!',
  },
  {
    scenario: 'NZ_REGROUP',
    puck: { x: 66, y: 122 },
    prompt: 'D hinges in Neutral Zone — Drag YOU into regroup lane!',
  },
];

export function computeDisplacedStart(homeSpot: Vec2): Vec2 {
  return {
    x: homeSpot.x > 50 ? Math.max(16, homeSpot.x - 28) : Math.min(84, homeSpot.x + 28),
    y: Math.max(20, Math.min(182, homeSpot.y - 18)),
  };
}
