import { AgeTier, IqPillarId, PlayBlueprint, PlayerProfile } from '../types/hockey';
import { createInitialMastery } from './PillarsData';

export interface AdaptiveDifficultyParams {
  iqScore: number;
  tierLabel: string;
  skaterSpeedScale: number;
  bulletTimeScale: number;
  readWindowMs: number;
  scanWindowMs: number;
  deceptionIntensity: number;
  showAssistRings: boolean;
}

export interface RedemptionEntry {
  play: PlayBlueprint;
  playsUntilTrigger: number;
}

export function getBaselineIqForAge(age: AgeTier): number {
  switch (age) {
    case '8U':
      return 160;
    case '10U':
      return 320;
    case '12U':
      return 480;
    case '14U':
      return 650;
    case '16U_JR':
      return 820;
  }
}

export function createDefaultProfile(): PlayerProfile {
  return {
    ageTier: '12U',
    position: 'C',
    federation: 'USA',
    orientation: 'ATTACK_UP',
    muted: false,
    iqScore: 480,
    streak: 0,
    bestStreak: 0,
    repsCompleted: 0,
    goldCount: 0,
    silverCount: 0,
    turnoverCount: 0,
    pillarMastery: createInitialMastery(42),
  };
}

export function computeAdaptiveParams(profile: PlayerProfile): AdaptiveDifficultyParams {
  const iq = Math.max(0, Math.min(1100, profile.iqScore));
  const norm = Math.min(1, iq / 1000);

  const tierLabel =
    iq < 240
      ? 'Novice Edge'
      : iq < 450
        ? 'Developing Playmaker'
        : iq < 680
          ? 'Varsity / AA Tactician'
          : iq < 860
            ? 'AAA / Junior Reader'
            : 'Pro / Elite Vision';

  return {
    iqScore: iq,
    tierLabel,
    skaterSpeedScale: Number((0.76 + norm * 0.54).toFixed(2)),
    bulletTimeScale: 0.25,
    readWindowMs: Math.round(3700 - norm * 2150),
    scanWindowMs: Math.round(1600 - norm * 800), // 1.6s Novice -> 0.8s Pro
    deceptionIntensity: Number(Math.max(0, (norm - 0.2) * 1.25).toFixed(2)),
    showAssistRings: profile.ageTier === '8U' || profile.ageTier === '10U' || iq < 430,
  };
}

export function mirrorBlueprint(play: PlayBlueprint): PlayBlueprint {
  const mirrorAngle = (ang?: number): number | undefined => {
    if (ang === undefined) return undefined;
    return Math.atan2(Math.sin(ang), -Math.cos(ang));
  };

  return {
    ...play,
    id: `${play.id}_redeem`,
    title: `${play.title} (Redemption Flip)`,
    isMirroredRedemption: true,
    skaters: play.skaters.map((s) => ({
      ...s,
      start: { x: 100 - s.start.x, y: s.start.y },
      rollInTo: { x: 100 - s.rollInTo.x, y: s.rollInTo.y },
      path: s.path?.map((pt) => ({ x: 100 - pt.x, y: pt.y })),
      hipCommitAngle: mirrorAngle(s.hipCommitAngle),
      stickLaneAngle: mirrorAngle(s.stickLaneAngle),
    })),
    goldOption: {
      ...play.goldOption,
      targetSpot: { x: 100 - play.goldOption.targetSpot.x, y: play.goldOption.targetSpot.y },
    },
    silverOption: {
      ...play.silverOption,
      targetSpot: {
        x: 100 - play.silverOption.targetSpot.x,
        y: play.silverOption.targetSpot.y,
      },
    },
  };
}

export function applyRepResultToProfile(
  prev: PlayerProfile,
  pillar: IqPillarId,
  grade: 'GOLD' | 'SILVER' | 'TURNOVER'
): PlayerProfile {
  const streak = grade === 'TURNOVER' ? 0 : prev.streak + 1;
  const streakBonus = Math.min(8, streak * 2);
  const deltaIq =
    grade === 'GOLD' ? 18 + streakBonus : grade === 'SILVER' ? 9 : -10;
  const deltaPillar = grade === 'GOLD' ? 12 : grade === 'SILVER' ? 6 : -4;

  const currentMastery = prev.pillarMastery[pillar] ?? 40;
  const updatedMastery = Math.max(8, Math.min(100, currentMastery + deltaPillar));

  return {
    ...prev,
    iqScore: Math.max(40, Math.min(1150, prev.iqScore + deltaIq)),
    streak,
    bestStreak: Math.max(prev.bestStreak, streak),
    repsCompleted: prev.repsCompleted + 1,
    goldCount: prev.goldCount + (grade === 'GOLD' ? 1 : 0),
    silverCount: prev.silverCount + (grade === 'SILVER' ? 1 : 0),
    turnoverCount: prev.turnoverCount + (grade === 'TURNOVER' ? 1 : 0),
    pillarMastery: {
      ...prev.pillarMastery,
      [pillar]: updatedMastery,
    },
  };
}

export class RedemptionQueueManager {
  private queue: RedemptionEntry[] = [];

  public scheduleRedemption(play: PlayBlueprint): void {
    const baseId = play.id.replace('_redeem', '');
    if (this.queue.some((q) => q.play.id.startsWith(baseId))) return;
    // Automatically triggers 3 plays after any mistake!
    this.queue.push({
      play: mirrorBlueprint(play),
      playsUntilTrigger: 3,
    });
  }

  public popReadyPlay(): PlayBlueprint | null {
    for (let i = 0; i < this.queue.length; i++) {
      this.queue[i].playsUntilTrigger -= 1;
    }
    const readyIdx = this.queue.findIndex((q) => q.playsUntilTrigger <= 0);
    if (readyIdx >= 0) {
      const [entry] = this.queue.splice(readyIdx, 1);
      return entry.play;
    }
    return null;
  }

  public pendingCount(): number {
    return this.queue.length;
  }
}
