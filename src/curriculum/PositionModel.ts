import { IceZone, IqPillarId, PlayerPosition, SkaterEntity, Vec2 } from '../types/hockey';

export type TacticalScenarioId =
  | 'FULL_ICE'
  | 'HALF_3V3'
  | 'DZ_COVERAGE'
  | 'BREAKOUT'
  | 'NZ_REGROUP'
  | 'OZ_CYCLE'
  | 'PP'
  | 'PK';

export interface TacticalScenarioMeta {
  id: TacticalScenarioId;
  label: string;
  zone: IceZone;
  pillar: IqPillarId;
  defaultPuck: Vec2;
}

export const TACTICAL_SCENARIOS: TacticalScenarioMeta[] = [
  { id: 'FULL_ICE', label: 'Full Ice', zone: 'FULL_ICE', pillar: 'NZ_GAP_CONTROL', defaultPuck: { x: 30, y: 110 } },
  { id: 'HALF_3V3', label: 'Half-Ice 3v3', zone: 'HALF_3V3', pillar: 'SMALL_AREA_3V3', defaultPuck: { x: 26, y: 44 } },
  { id: 'DZ_COVERAGE', label: 'D-Zone Coverage', zone: 'D_ZONE', pillar: 'DZ_WEAKSIDE_LOCK', defaultPuck: { x: 18, y: 174 } },
  { id: 'BREAKOUT', label: 'Breakout', zone: 'D_ZONE', pillar: 'BREAKOUT_PRESSURE', defaultPuck: { x: 28, y: 180 } },
  { id: 'NZ_REGROUP', label: 'Neutral Regroup', zone: 'NEUTRAL_ZONE', pillar: 'NZ_REGROUP', defaultPuck: { x: 66, y: 124 } },
  { id: 'OZ_CYCLE', label: 'O-Zone Cycle', zone: 'O_ZONE', pillar: 'OZ_TRIANGLES', defaultPuck: { x: 20, y: 26 } },
  { id: 'PP', label: 'PP', zone: 'O_ZONE', pillar: 'PP_UMBRELLA', defaultPuck: { x: 78, y: 38 } },
  { id: 'PK', label: 'PK', zone: 'D_ZONE', pillar: 'PK_BOX_PRESSURE', defaultPuck: { x: 22, y: 152 } },
];

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export interface TacticalSolution {
  targets: Record<string, Vec2>;
  activeRoles: string[];
  roleCue: string;
  supportPairs: Array<[string, string]>;
  houseZone?: { center: Vec2; radius: number; label: string };
}

export function solveTacticalPositions(
  scenario: TacticalScenarioId,
  puck: Vec2,
  userRole: PlayerPosition
): TacticalSolution {
  const px = clamp(puck.x, 6, 94);
  const py = clamp(puck.y, 8, 192);
  const leftSide = px < 50;
  const shiftX = (px - 50) * 0.36;

  // Goalie always tracks puck angle inside home crease (y ~ 186) or half-ice net
  const goalieHomeY = scenario === 'HALF_3V3' || scenario === 'OZ_CYCLE' || scenario === 'PP' ? 86 : 186;
  const G: Vec2 = { x: clamp(50 + (px - 50) * 0.14, 45, 55), y: goalieHomeY };

  if (scenario === 'HALF_3V3') {
    const C: Vec2 = { x: clamp(px + (leftSide ? 18 : -18), 16, 84), y: clamp(py + 8, 20, 78) };
    const LW: Vec2 = { x: clamp(leftSide ? px + 4 : 30 + shiftX, 14, 82), y: clamp(py - 6, 18, 70) };
    const LD: Vec2 = { x: clamp(50 + shiftX * 0.7, 24, 76), y: clamp(Math.max(py + 22, 58), 48, 86) };
    const D1: Vec2 = { x: clamp(50 + (px - 50) * 0.55, 22, 78), y: clamp(py * 0.78 + 5, 16, 68) };
    const D2: Vec2 = { x: clamp(50 + (C.x - 50) * 0.65, 24, 76), y: clamp(C.y - 8, 18, 66) };
    return {
      targets: { C, LW, LD, G, D1, D2, OG: { x: clamp(50 + (px - 50) * 0.12, 46, 54), y: 12 } },
      activeRoles: ['C', 'LW', 'LD', 'D1', 'D2', 'OG'],
      roleCue: '3v3 Triangle: Keep 1 close support + 1 high safety valve.',
      supportPairs: [['LW', 'C'], ['C', 'LD'], ['LD', 'LW']],
    };
  }

  if (scenario === 'PP') {
    const LD: Vec2 = { x: clamp(50 + shiftX * 0.5, 34, 66), y: 65 };
    const LW: Vec2 = { x: clamp(22 + shiftX * 0.25, 14, 38), y: 36 };
    const RW: Vec2 = { x: clamp(78 + shiftX * 0.25, 62, 86), y: 36 };
    const C: Vec2 = { x: clamp(50 + shiftX * 0.22, 40, 60), y: 37 }; // Bumper
    const RD: Vec2 = { x: clamp(50 - shiftX * 0.2, 42, 58), y: 19 }; // Net-front screen
    return {
      targets: {
        C, LW, RW, LD, RD, G,
        D1: { x: 42 + shiftX * 0.2, y: 44 },
        D2: { x: 58 + shiftX * 0.2, y: 44 },
        F1: { x: 43 + shiftX * 0.2, y: 27 },
        F2: { x: 57 + shiftX * 0.2, y: 27 },
        OG: { x: clamp(50 + (px - 50) * 0.14, 46, 54), y: 12 },
      },
      activeRoles: ['C', 'LW', 'RW', 'LD', 'RD', 'D1', 'D2', 'F1', 'F2', 'OG'],
      roleCue: `${userRole} PP Umbrella: Stretch box wide, snap bumper or backdoor.`,
      supportPairs: [['LD', 'LW'], ['LD', 'RW'], ['LW', 'C'], ['RW', 'C']],
    };
  }

  if (scenario === 'PK') {
    const LD: Vec2 = { x: clamp(42 + shiftX * 0.35, 28, 52), y: clamp(168 + (py - 160) * 0.2, 158, 178) };
    const RD: Vec2 = { x: clamp(58 + shiftX * 0.35, 48, 72), y: clamp(168 + (py - 160) * 0.2, 158, 178) };
    const C: Vec2 = { x: clamp(42 + shiftX * 0.4, 26, 54), y: clamp(148 + (py - 150) * 0.25, 138, 158) };
    const LW: Vec2 = { x: clamp(58 + shiftX * 0.4, 46, 74), y: clamp(148 + (py - 150) * 0.25, 138, 158) };
    return {
      targets: {
        C, LW, LD, RD, G,
        F1: { x: 20, y: 152 },
        F2: { x: 80, y: 152 },
        D1: { x: 50, y: 132 },
      },
      activeRoles: ['C', 'LW', 'LD', 'RD', 'G', 'F1', 'F2', 'D1'],
      roleCue: `${userRole} PK Diamond/Box: Sticks inside royal-road seam lanes first!`,
      supportPairs: [['LD', 'RD'], ['RD', 'LW'], ['LW', 'C'], ['C', 'LD']],
      houseZone: { center: { x: 50, y: 168 }, radius: 14, label: 'PK BOX' },
    };
  }

  // General 5v5 Dynamic Structure across D-Zone, Breakout, Neutral Zone, and O-Zone!
  const inDZone = py > 125 || scenario === 'DZ_COVERAGE' || scenario === 'BREAKOUT';
  const inOZone = (py < 75 && !inDZone) || scenario === 'OZ_CYCLE';

  let C: Vec2;
  let LW: Vec2;
  let RW: Vec2;
  let LD: Vec2;
  let RD: Vec2;
  let roleCue = '';

  if (inDZone) {
    if (scenario === 'BREAKOUT') {
      LD = { x: leftSide ? clamp(px, 16, 44) : 36, y: clamp(py + 4, 164, 184) };
      RD = { x: !leftSide ? clamp(px, 56, 84) : 64, y: clamp(py + 4, 164, 184) };
      LW = { x: leftSide ? 14 : 34, y: leftSide ? 146 : 142 };
      RW = { x: !leftSide ? 86 : 66, y: !leftSide ? 146 : 142 };
      C = { x: clamp(50 + shiftX * 0.75, 28, 72), y: 158 };
      roleCue = `${userRole} Breakout: Low-slow center support + flat wing on hashmarks.`;
    } else {
      // D-Zone Coverage (House + Weak-Side Lock!)
      LD = leftSide
        ? { x: clamp(px + 6, 16, 46), y: clamp(py - 2, 156, 184) }
        : { x: 46, y: 174 };
      RD = !leftSide
        ? { x: clamp(px - 6, 54, 84), y: clamp(py - 2, 156, 184) }
        : { x: 54, y: 174 };
      C = { x: clamp(50 + (px - 50) * 0.55, 26, 74), y: clamp(py - 6, 154, 176) };
      LW = leftSide
        ? { x: clamp(px + 8, 20, 44), y: 144 }
        : { x: 42, y: 154 }; // Weak-side slot lock!
      RW = !leftSide
        ? { x: clamp(px - 8, 56, 80), y: 144 }
        : { x: 58, y: 154 }; // Weak-side slot lock!
      roleCue = `${userRole} D-Zone: Protect the House; weak-side wing locks high slot!`;
    }
  } else if (inOZone) {
    // O-Zone Cycle & High F3 Triangle
    C = { x: clamp(px + (leftSide ? 14 : -14), 18, 82), y: clamp(py + 10, 22, 52) };
    LW = leftSide
      ? { x: clamp(px + 4, 14, 48), y: clamp(py + 2, 18, 48) }
      : { x: 44, y: 42 }; // High F3 balance!
    RW = !leftSide
      ? { x: clamp(px - 4, 52, 86), y: clamp(py + 2, 18, 48) }
      : { x: 56, y: 42 }; // High F3 balance!
    LD = { x: clamp(34 + shiftX * 0.45, 18, 52), y: 66 };
    RD = { x: clamp(66 + shiftX * 0.45, 48, 82), y: 66 };
    roleCue = `${userRole} O-Zone: Form close triangle + keep high F3 above circles!`;
  } else {
    // Neutral Zone Regroup / Transition
    LD = { x: clamp(35 + shiftX * 0.4, 20, 48), y: clamp(py + 16, 96, 136) };
    RD = { x: clamp(65 + shiftX * 0.4, 52, 80), y: clamp(py + 16, 96, 136) };
    C = { x: clamp(50 + shiftX * 0.55, 28, 72), y: clamp(py - 6, 78, 118) };
    LW = { x: 18, y: clamp(py - 14, 72, 112) };
    RW = { x: 82, y: clamp(py - 14, 72, 112) };
    roleCue = `${userRole} Neutral Zone: Swing underneath puck speed with flat stick!`;
  }

  return {
    targets: {
      C, LW, RW, LD, RD, G,
      F1: { x: clamp(px + (leftSide ? 8 : -8), 18, 82), y: clamp(py - 12, 24, 166) },
      D1: { x: clamp(40 + shiftX * 0.35, 24, 52), y: clamp(py - 24, 22, 140) },
      D2: { x: clamp(60 + shiftX * 0.35, 48, 76), y: clamp(py - 24, 22, 140) },
      OG: { x: clamp(50 + (px - 50) * 0.14, 46, 54), y: 12 },
    },
    activeRoles:
      scenario === 'OZ_CYCLE'
        ? ['C', 'LW', 'RW', 'LD', 'RD', 'D1', 'D2', 'OG']
        : ['C', 'LW', 'RW', 'LD', 'RD', 'G', 'F1', 'D1', 'D2'],
    roleCue,
    supportPairs: [
      ['C', 'LW'],
      ['C', 'RW'],
      ['LD', 'RD'],
      ['C', leftSide ? 'LD' : 'RD'],
    ],
    houseZone: inDZone
      ? { center: { x: 50, y: 168 }, radius: 15, label: 'HOUSE' }
      : undefined,
  };
}

export function buildEntitiesFromSolution(
  sol: TacticalSolution,
  puck: Vec2,
  userRole: PlayerPosition
): SkaterEntity[] {
  return sol.activeRoles.map((role) => {
    const pos = sol.targets[role] ?? { x: 50, y: 100 };
    const isHome = ['C', 'LW', 'RW', 'LD', 'RD', 'G'].includes(role);
    const angleToPuck = Math.atan2(puck.y - pos.y, puck.x - pos.x);
    return {
      id: role,
      label: role,
      role: role as SkaterEntity['role'],
      team: isHome ? 'HOME' : 'AWAY',
      pos: { ...pos },
      vel: { x: 0, y: 0 },
      bodyAngle: angleToPuck,
      hipAngle: angleToPuck,
      stickAngle: angleToPuck + 0.2,
      stickReach: isHome ? 6.8 : 7.8,
      isUser: role === userRole,
    };
  });
}
