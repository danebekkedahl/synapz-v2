import {
  PlayBlueprint,
  PuckFlightType,
  PuckState,
  SkateParticle,
  SkaterEntity,
  Vec2,
} from '../types/hockey';
import { distanceIce } from './RinkViewport';

export interface LiveSimOutcome {
  resolved: boolean;
  grade: 'GOLD' | 'SILVER' | 'TURNOVER';
  reason: string;
  interceptedById?: string;
  scoredGoal?: boolean;
}

export interface LiveSimState {
  skaters: SkaterEntity[];
  puck: PuckState;
  particles: SkateParticle[];
  elapsedRollIn: number;
  outcome: LiveSimOutcome | null;
}

function pointToSegmentDist(p: Vec2, a: Vec2, b: Vec2): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 0.0001) return distanceIce(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / lenSq));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

export function instantiateBlueprint(
  play: PlayBlueprint,
  showAssistRings: boolean
): LiveSimState {
  const skaters: SkaterEntity[] = play.skaters.map((sb) => {
    const dx = sb.rollInTo.x - sb.start.x;
    const dy = sb.rollInTo.y - sb.start.y;
    const moveAngle = Math.hypot(dx, dy) > 0.4 ? Math.atan2(dy, dx) : -Math.PI * 0.5;
    const assistTier =
      showAssistRings && sb.id === play.goldOption.targetId
        ? 'GOLD'
        : showAssistRings && sb.id === play.silverOption.targetId
          ? 'SILVER'
          : 'NONE';

    return {
      id: sb.id,
      label: sb.label,
      role: sb.role,
      team: sb.team,
      pos: { ...sb.start },
      vel: { x: dx * 0.55, y: dy * 0.55 },
      bodyAngle: moveAngle,
      hipAngle: sb.hipCommitAngle ?? moveAngle,
      stickAngle: sb.stickLaneAngle ?? moveAngle + 0.3,
      stickReach: sb.team === 'AWAY' ? 8.2 : 6.8,
      isUser: sb.id === play.carrierId,
      hasPuck: sb.id === play.carrierId,
      assistTier,
      path: sb.path ? sb.path.map((p) => ({ ...p })) : undefined,
    };
  });

  const carrier = skaters.find((s) => s.id === play.carrierId) ?? skaters[0];
  return {
    skaters,
    puck: {
      pos: {
        x: carrier.pos.x + Math.cos(carrier.stickAngle) * 4.5,
        y: carrier.pos.y + Math.sin(carrier.stickAngle) * 4.5,
      },
      vel: { x: 0, y: 0 },
      z: 0,
      vz: 0,
      ownerId: carrier.id,
      flightType: 'CARRY',
      trail: [],
    },
    particles: [],
    elapsedRollIn: 0,
    outcome: null,
  };
}

export function launchPuckAction(
  sim: LiveSimState,
  flightType: PuckFlightType,
  target: Vec2
): void {
  sim.skaters.forEach((s) => {
    s.hasPuck = false;
  });
  const origin = { ...sim.puck.pos };
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const speed =
    flightType === 'SHOT'
      ? 92
      : flightType === 'SNAP'
        ? 74
        : flightType === 'BANK'
          ? 68
          : 56;
  const flightTime = dist / speed;

  sim.puck.ownerId = null;
  sim.puck.flightType = flightType;
  sim.puck.vel = { x: (dx / dist) * speed, y: (dy / dist) * speed };
  sim.puck.z = flightType === 'SAUCER' ? 0.15 : 0;
  // Parabolic saucer elevation: rises above stick height (~2.4) mid-flight and lands flat at target
  sim.puck.vz = flightType === 'SAUCER' ? 9.5 * Math.min(1.1, flightTime * 1.45) : 0;
  sim.puck.trail = [{ x: origin.x, y: origin.y, z: sim.puck.z }];
}

export function stepRollIn(
  sim: LiveSimState,
  play: PlayBlueprint,
  dt: number,
  rollDuration: number,
  speedScale: number,
  deceptionIntensity: number
): void {
  sim.elapsedRollIn += dt * speedScale;
  const t = Math.min(1, sim.elapsedRollIn / rollDuration);

  sim.skaters.forEach((sk, idx) => {
    const bp = play.skaters[idx];
    if (!bp) return;
    const prev = { ...sk.pos };
    if (bp.path && bp.path.length >= 2) {
      const scaled = t * (bp.path.length - 1);
      const seg = Math.min(bp.path.length - 2, Math.floor(scaled));
      const frac = scaled - seg;
      sk.pos.x = bp.path[seg].x + (bp.path[seg + 1].x - bp.path[seg].x) * frac;
      sk.pos.y = bp.path[seg].y + (bp.path[seg + 1].y - bp.path[seg].y) * frac;
    } else {
      sk.pos.x = bp.start.x + (bp.rollInTo.x - bp.start.x) * t;
      sk.pos.y = bp.start.y + (bp.rollInTo.y - bp.start.y) * t;
    }

    const mvx = sk.pos.x - prev.x;
    const mvy = sk.pos.y - prev.y;
    if (Math.hypot(mvx, mvy) > 0.02) {
      sk.bodyAngle = Math.atan2(mvy, mvx);
    }

    // Defender stick-sweep deception bait before committing at t > 0.72
    if (sk.team === 'AWAY') {
      const baseStick = bp.stickLaneAngle ?? sk.bodyAngle;
      const baitOffset =
        bp.deceptionSweep && t < 0.72
          ? Math.sin(t * Math.PI * 2.5) * 0.65 * deceptionIntensity
          : 0;
      sk.stickAngle = baseStick + baitOffset;
      sk.hipAngle = bp.hipCommitAngle ?? sk.bodyAngle;
    } else {
      sk.stickAngle = sk.bodyAngle + 0.28;
    }

    if (Math.random() < 0.22 * speedScale) {
      sim.particles.push({
        x: prev.x,
        y: prev.y,
        vx: -mvx * 4 + (Math.random() - 0.5) * 3,
        vy: -mvy * 4 + (Math.random() - 0.5) * 3,
        life: 0.35,
        maxLife: 0.35,
      });
    }
  });

  const carrier = sim.skaters.find((s) => s.id === sim.puck.ownerId);
  if (carrier) {
    sim.puck.pos.x = carrier.pos.x + Math.cos(carrier.stickAngle) * 4.4;
    sim.puck.pos.y = carrier.pos.y + Math.sin(carrier.stickAngle) * 4.4;
  }
  stepParticles(sim, dt);
}

export function stepConsequence(
  sim: LiveSimState,
  play: PlayBlueprint,
  dt: number,
  intendedGrade: 'GOLD' | 'SILVER' | 'TURNOVER'
): void {
  // Advance skaters gently in momentum stride
  sim.skaters.forEach((sk) => {
    sk.pos.x = Math.max(4, Math.min(96, sk.pos.x + Math.cos(sk.bodyAngle) * 9 * dt));
    sk.pos.y = Math.max(8, Math.min(192, sk.pos.y + Math.sin(sk.bodyAngle) * 9 * dt));
  });

  if (sim.puck.ownerId) {
    const owner = sim.skaters.find((s) => s.id === sim.puck.ownerId);
    if (owner) {
      sim.puck.pos.x = owner.pos.x + Math.cos(owner.stickAngle) * 4.4;
      sim.puck.pos.y = owner.pos.y + Math.sin(owner.stickAngle) * 4.4;
    }
    stepParticles(sim, dt);
    return;
  }

  // Advance free puck
  sim.puck.pos.x += sim.puck.vel.x * dt;
  sim.puck.pos.y += sim.puck.vel.y * dt;
  if (sim.puck.flightType === 'SAUCER') {
    sim.puck.z = Math.max(0, sim.puck.z + sim.puck.vz * dt);
    sim.puck.vz -= 19 * dt;
  }

  // Bank pass board bounce
  if (sim.puck.pos.x <= 3 || sim.puck.pos.x >= 97) {
    sim.puck.pos.x = Math.max(3, Math.min(97, sim.puck.pos.x));
    sim.puck.vel.x *= -0.88;
  }

  sim.puck.trail.push({ x: sim.puck.pos.x, y: sim.puck.pos.y, z: sim.puck.z });
  if (sim.puck.trail.length > 18) sim.puck.trail.shift();

  // Check defender stick/body interception (Saucer passes clear sticks when z > 0.95!)
  if (intendedGrade === 'TURNOVER' || sim.puck.z <= 0.95) {
    for (const def of sim.skaters) {
      if (def.team !== 'AWAY') continue;
      const tip: Vec2 = {
        x: def.pos.x + Math.cos(def.stickAngle) * def.stickReach,
        y: def.pos.y + Math.sin(def.stickAngle) * def.stickReach,
      };
      const hitStick = pointToSegmentDist(sim.puck.pos, def.pos, tip) < 2.9;
      if (hitStick && (intendedGrade === 'TURNOVER' || sim.puck.z <= 0.65)) {
        sim.puck.ownerId = def.id;
        sim.puck.vel = { x: 0, y: 0 };
        sim.puck.z = 0;
        def.hasPuck = true;
        if (!sim.outcome) {
          sim.outcome = {
            resolved: true,
            grade: 'TURNOVER',
            reason: play.missedCueText,
            interceptedById: def.id,
          };
        }
        stepParticles(sim, dt);
        return;
      }
    }
  }

  // Check opponent goal net entry (y <= 11.5, x in 45..55)
  if (sim.puck.pos.y <= 11.8 && sim.puck.pos.x >= 44.5 && sim.puck.pos.x <= 55.5) {
    sim.puck.vel = { x: 0, y: 0 };
    if (!sim.outcome) {
      sim.outcome = {
        resolved: true,
        grade: intendedGrade === 'TURNOVER' ? 'SILVER' : intendedGrade,
        reason: play.goldOption.praiseCue,
        scoredGoal: true,
      };
    }
  }

  // Check friendly reception
  for (const mate of sim.skaters) {
    if (mate.team !== 'HOME' || mate.id === play.carrierId) continue;
    if (distanceIce(sim.puck.pos, mate.pos) < 4.8 && sim.puck.z < 1.1) {
      sim.puck.ownerId = mate.id;
      sim.puck.z = 0;
      mate.hasPuck = true;
      if (!sim.outcome) {
        sim.outcome = {
          resolved: true,
          grade: intendedGrade,
          reason:
            intendedGrade === 'GOLD'
              ? play.goldOption.praiseCue
              : intendedGrade === 'SILVER'
                ? play.silverOption.praiseCue
                : play.missedCueText,
        };
      }
      break;
    }
  }

  stepParticles(sim, dt);
}

function stepParticles(sim: LiveSimState, dt: number): void {
  for (let i = sim.particles.length - 1; i >= 0; i--) {
    const p = sim.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) sim.particles.splice(i, 1);
  }
}
