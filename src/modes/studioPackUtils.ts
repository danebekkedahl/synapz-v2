import { distanceIce } from '../engine/RinkViewport';
import { soundEngine } from '../engine/SoundAndHaptics';
import {
  FederationProfile,
  IceZone,
  PlayBlueprint,
  SkaterBlueprint,
  SkaterRole,
  TeamPlayPack,
  Vec2,
} from '../types/hockey';

export const INITIAL_STUDIO_SKATERS: SkaterBlueprint[] = [
  { id: 'C', label: 'C', role: 'C', team: 'HOME', start: { x: 30, y: 58 }, rollInTo: { x: 32, y: 44 } },
  { id: 'LW', label: 'LW', role: 'LW', team: 'HOME', start: { x: 68, y: 56 }, rollInTo: { x: 68, y: 30 } },
  { id: 'LD', label: 'LD', role: 'LD', team: 'HOME', start: { x: 48, y: 76 }, rollInTo: { x: 48, y: 66 } },
  {
    id: 'D1',
    label: 'D1',
    role: 'D1',
    team: 'AWAY',
    start: { x: 48, y: 46 },
    rollInTo: { x: 46, y: 38 },
    hipCommitAngle: 2.6,
    stickLaneAngle: -0.35,
  },
  { id: 'OG', label: 'OG', role: 'OG', team: 'AWAY', start: { x: 50, y: 12 }, rollInTo: { x: 50, y: 12 } },
];

export const ADDABLE_STUDIO_ROLES: Array<{ role: SkaterRole; team: 'HOME' | 'AWAY' }> = [
  { role: 'C', team: 'HOME' },
  { role: 'LW', team: 'HOME' },
  { role: 'RW', team: 'HOME' },
  { role: 'LD', team: 'HOME' },
  { role: 'RD', team: 'HOME' },
  { role: 'D1', team: 'AWAY' },
  { role: 'D2', team: 'AWAY' },
  { role: 'F1', team: 'AWAY' },
];

export function compileStudioBlueprint(args: {
  playTitle: string;
  zone: IceZone;
  federation: FederationProfile;
  carrierId: string;
  skaters: SkaterBlueprint[];
  goldSpot: Vec2;
  silverSpot: Vec2;
  voiceCaption: string;
  audioDataUrl?: string;
}): PlayBlueprint {
  const {
    playTitle,
    zone,
    federation,
    carrierId,
    skaters,
    goldSpot,
    silverSpot,
    voiceCaption,
    audioDataUrl,
  } = args;
  const def = skaters.find((s) => s.team === 'AWAY') ?? skaters[skaters.length - 1];
  const goldMate = skaters.find(
    (s) => s.team === 'HOME' && s.id !== carrierId && distanceIce(s.rollInTo, goldSpot) <= 14
  );
  const silverMate = skaters.find(
    (s) => s.team === 'HOME' && s.id !== carrierId && distanceIce(s.rollInTo, silverSpot) <= 14
  );
  return {
    id: `custom_${Date.now()}`,
    title: playTitle.trim() || 'Custom Team Play',
    pillar:
      zone === 'HALF_3V3'
        ? 'SMALL_AREA_3V3'
        : zone === 'D_ZONE'
          ? 'BREAKOUT_PRESSURE'
          : 'OZ_TRIANGLES',
    zone,
    federation,
    recommendedRole: 'C',
    carrierId,
    defenderKeyId: def.id,
    skaters: skaters.map((s) => ({ ...s })),
    goldOption: {
      action: 'SNAP_PASS',
      targetId: goldMate?.id,
      targetSpot: { ...goldSpot },
      label: 'Coach Gold Read',
      praiseCue: voiceCaption.slice(0, 68) || 'Nailed Coach Gold Read!',
    },
    silverOption: {
      action: 'SNAP_PASS',
      targetId: silverMate?.id,
      targetSpot: { ...silverSpot },
      label: 'Coach Silver Outlet',
      praiseCue: 'Clean secondary outlet!',
    },
    missedCueText: voiceCaption.slice(0, 68) || 'Follow the green Gold lane!',
    coachVoiceCaption: voiceCaption,
    coachAudioDataUrl: audioDataUrl,
    isCustom: true,
  };
}

export function downloadTeamPlayPack(
  current: PlayBlueprint,
  existing: PlayBlueprint[],
  federation: FederationProfile
): void {
  const pack: TeamPlayPack = {
    version: '2.0',
    teamName: 'SYNAPZ Custom Pack',
    federation,
    createdAt: new Date().toISOString(),
    plays: [current, ...existing],
  };
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'synapz-team-play-pack.json';
  a.click();
  URL.revokeObjectURL(url);
  soundEngine.emitCaption('Exported JSON Team Play Pack!', 'gold', 'EXPORT JSON');
}
