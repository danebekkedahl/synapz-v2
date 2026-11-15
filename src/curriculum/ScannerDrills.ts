import { IceZone, IqPillarId, SkaterEntity, Vec2 } from '../types/hockey';

export interface ScanDrillSpec {
  id: string;
  title: string;
  zone: IceZone;
  pillar: IqPillarId;
  passFrom: Vec2;
  youPos: Vec2;
  openSpot: Vec2;
  openRole: 'LW' | 'RW' | 'LD';
  silverSpot: Vec2;
  baitedSpot: Vec2;
  defenderJumpTo: Vec2;
  cue: string;
}

export const SCAN_DRILLS: ScanDrillSpec[] = [
  {
    id: 'scan_nz_slash',
    title: 'NZ Shoulder-Check One-Touch',
    zone: 'NEUTRAL_ZONE',
    pillar: 'NZ_REGROUP',
    passFrom: { x: 34, y: 136 },
    youPos: { x: 50, y: 108 },
    openSpot: { x: 82, y: 86 },
    openRole: 'RW',
    silverSpot: { x: 68, y: 128 },
    baitedSpot: { x: 18, y: 88 },
    defenderJumpTo: { x: 26, y: 94 },
    cue: 'D1 jumped LW wall early — one-touch wide to RW!',
  },
  {
    id: 'scan_oz_bumper',
    title: 'Slot Bumper Pre-Scan Touch',
    zone: 'O_ZONE',
    pillar: 'PP_UMBRELLA',
    passFrom: { x: 78, y: 44 },
    youPos: { x: 50, y: 38 },
    openSpot: { x: 24, y: 27 },
    openRole: 'LW',
    silverSpot: { x: 50, y: 64 },
    baitedSpot: { x: 52, y: 20 },
    defenderJumpTo: { x: 51, y: 26 },
    cue: 'PK collapsed low crease — one-touch backdoor LW!',
  },
  {
    id: 'scan_breakout_middle',
    title: 'Breakout Center Scan & Kick',
    zone: 'D_ZONE',
    pillar: 'BREAKOUT_PRESSURE',
    passFrom: { x: 26, y: 176 },
    youPos: { x: 48, y: 156 },
    openSpot: { x: 80, y: 136 },
    openRole: 'RW',
    silverSpot: { x: 66, y: 174 },
    baitedSpot: { x: 18, y: 138 },
    defenderJumpTo: { x: 26, y: 144 },
    cue: 'F2 pinched strong boards — one-touch weak-side RW!',
  },
];

export function buildScannerEntities(
  drill: ScanDrillSpec,
  showAssistRings: boolean
): SkaterEntity[] {
  const otherRole = drill.openRole === 'RW' ? 'LW' : 'RW';
  return [
    {
      id: 'YOU',
      label: 'C',
      role: 'C',
      team: 'HOME',
      pos: { ...drill.youPos },
      vel: { x: 0, y: 0 },
      bodyAngle: -Math.PI * 0.5,
      hipAngle: -Math.PI * 0.5,
      stickAngle: 0.4,
      stickReach: 6.8,
      isUser: true,
    },
    {
      id: 'PASSER',
      label: 'LD',
      role: 'LD',
      team: 'HOME',
      pos: { ...drill.passFrom },
      vel: { x: 0, y: 0 },
      bodyAngle: -Math.PI * 0.4,
      hipAngle: -Math.PI * 0.4,
      stickAngle: -0.4,
      stickReach: 6.8,
    },
    {
      id: 'OPEN',
      label: drill.openRole,
      role: drill.openRole,
      team: 'HOME',
      pos: { x: drill.openSpot.x, y: drill.openSpot.y + 10 },
      vel: { x: 0, y: 0 },
      bodyAngle: -Math.PI * 0.5,
      hipAngle: -Math.PI * 0.5,
      stickAngle: -1.1,
      stickReach: 6.8,
      assistTier: showAssistRings ? 'GOLD' : 'NONE',
    },
    {
      id: 'BAITED',
      label: otherRole,
      role: otherRole,
      team: 'HOME',
      pos: { x: drill.baitedSpot.x, y: drill.baitedSpot.y + 8 },
      vel: { x: 0, y: 0 },
      bodyAngle: -Math.PI * 0.5,
      hipAngle: -Math.PI * 0.5,
      stickAngle: -1.1,
      stickReach: 6.8,
    },
    {
      id: 'JUMPER',
      label: 'D1',
      role: 'D1',
      team: 'AWAY',
      pos: { x: 50, y: drill.defenderJumpTo.y - 8 },
      vel: { x: 0, y: 0 },
      bodyAngle: Math.PI * 0.5,
      hipAngle: Math.PI * 0.5,
      stickAngle: Math.PI * 0.65,
      stickReach: 8.4,
    },
  ];
}
