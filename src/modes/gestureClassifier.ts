import { LiveSimState } from '../engine/PhysicsEngine';
import { distanceIce } from '../engine/RinkViewport';
import { PlayBlueprint, PuckFlightType, Vec2 } from '../types/hockey';

export interface ClassifiedGesture {
  grade: 'GOLD' | 'SILVER' | 'TURNOVER';
  flight: PuckFlightType;
  targetSpot: Vec2;
  cueLabel: string;
}

export function classifyLiveReadGesture(
  ptsScreen: Vec2[],
  ptsIce: Vec2[],
  sim: LiveSimState,
  play: PlayBlueprint
): ClassifiedGesture {
  const startS = ptsScreen[0];
  const endS = ptsScreen[ptsScreen.length - 1];
  const startIce = ptsIce[0];
  const endIce = ptsIce[ptsIce.length - 1];
  const movePx = Math.hypot(endS.x - startS.x, endS.y - startS.y);

  let maxCurveDev = 0;
  if (movePx > 22 && ptsScreen.length >= 3) {
    const ux = (endS.x - startS.x) / movePx;
    const uy = (endS.y - startS.y) / movePx;
    for (const p of ptsScreen) {
      const dev = Math.abs((p.x - startS.x) * uy - (p.y - startS.y) * ux);
      if (dev > maxCurveDev) maxCurveDev = dev;
    }
  }

  const carrier = sim.skaters.find((s) => s.id === play.carrierId) ?? sim.skaters[0];
  const startedOnCarrier = distanceIce(startIce, carrier.pos) <= 12;
  const nearestMate = sim.skaters.find(
    (s) => s.team === 'HOME' && s.id !== carrier.id && distanceIce(endIce, s.pos) <= 13
  );

  let flight: PuckFlightType = 'SNAP';
  let gestureKind: 'SNAP' | 'SAUCER' | 'BANK' | 'CARRY' | 'SHOT' = 'SNAP';
  let targetSpot = nearestMate ? { ...nearestMate.pos } : { ...endIce };

  if (movePx >= 24 && maxCurveDev >= 13) {
    const touchesWall = ptsIce.some((ip) => ip.x <= 9 || ip.x >= 91);
    flight = touchesWall ? 'BANK' : 'SAUCER';
    gestureKind = touchesWall ? 'BANK' : 'SAUCER';
  } else if (endIce.y <= 18 && Math.abs(endIce.x - 50) <= 13) {
    flight = 'SHOT';
    gestureKind = 'SHOT';
    targetSpot = { x: endIce.x, y: 11 };
  } else if (startedOnCarrier && movePx >= 24 && !nearestMate) {
    flight = 'SNAP';
    gestureKind = 'CARRY';
  } else if (endIce.x <= 8 || endIce.x >= 92) {
    flight = 'BANK';
    gestureKind = 'BANK';
  }

  const goldDist = distanceIce(targetSpot, play.goldOption.targetSpot);
  const silverDist = distanceIce(targetSpot, play.silverOption.targetSpot);
  const needsSaucer = play.goldOption.action === 'SAUCER_PASS';

  if (goldDist <= 16 && (!needsSaucer || gestureKind === 'SAUCER')) {
    return {
      grade: 'GOLD',
      flight,
      targetSpot: play.goldOption.targetSpot,
      cueLabel: play.goldOption.label,
    };
  }
  if (silverDist <= 16 || (gestureKind === 'SHOT' && play.silverOption.action === 'SHOT')) {
    return {
      grade: 'SILVER',
      flight,
      targetSpot: play.silverOption.targetSpot,
      cueLabel: play.silverOption.label,
    };
  }

  const def = sim.skaters.find((s) => s.id === play.defenderKeyId);
  const interceptTarget =
    needsSaucer && goldDist <= 16 && def ? { ...def.pos } : targetSpot;
  return {
    grade: 'TURNOVER',
    flight,
    targetSpot: interceptTarget,
    cueLabel: 'Forced into defender stick',
  };
}
