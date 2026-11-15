export interface Vec2 {
  x: number; // 0..100 across rink width (50 = center ice)
  y: number; // 0..200 along rink length (0 = top attack boards, 200 = bottom defend boards)
}

export type IceZone =
  | 'FULL_ICE'
  | 'HALF_3V3'
  | 'D_ZONE'
  | 'NEUTRAL_ZONE'
  | 'O_ZONE';

export type RinkOrientation = 'ATTACK_UP' | 'BROADCAST';

export type FederationProfile = 'USA' | 'CAN' | 'IIHF';

export type AgeTier = '8U' | '10U' | '12U' | '14U' | '16U_JR';

export type PlayerPosition = 'C' | 'LW' | 'RW' | 'LD' | 'RD' | 'G';

export type SkaterRole =
  | PlayerPosition
  | 'D1'
  | 'D2'
  | 'D3'
  | 'F1'
  | 'F2'
  | 'OG';

export type AppModeId =
  | 'LIVE_READ'
  | 'POSITION_LAB'
  | 'HEAD_UP_SCAN'
  | 'MY_IQ'
  | 'COACH_STUDIO';

export type IqPillarId =
  | 'DZ_HOUSE'
  | 'DZ_WEAKSIDE_LOCK'
  | 'BREAKOUT_PRESSURE'
  | 'D_TO_D_ESCAPE'
  | 'NZ_REGROUP'
  | 'NZ_GAP_CONTROL'
  | 'ZONE_ENTRY_SPEED'
  | 'ENTRY_DELAY_HIGH'
  | 'OZ_TRIANGLES'
  | 'OZ_BLUE_WALK'
  | 'RUSH_2V1'
  | 'RUSH_3V2'
  | 'SMALL_AREA_3V3'
  | 'PP_UMBRELLA'
  | 'PK_BOX_PRESSURE'
  | 'SHOOTER_GOALIE_READ';

export type PillarQuadrant =
  | 'D-Zone & Breakouts'
  | 'Neutral Zone & Entries'
  | 'O-Zone & Odd-Man Rushes'
  | '3v3 & Special Teams';

export interface IqPillarMeta {
  id: IqPillarId;
  code: string;
  shortTitle: string;
  title: string;
  quadrant: PillarQuadrant;
  cueSummary: string;
  saturdayHabit: string;
}

export interface SkaterEntity {
  id: string;
  label: string;
  role: SkaterRole;
  team: 'HOME' | 'AWAY';
  pos: Vec2;
  vel: Vec2;
  bodyAngle: number;  // Torso/shoulder direction (radians)
  hipAngle: number;   // Defender/skater hip commitment angle (radians)
  stickAngle: number; // Active stick shaft & blade angle (radians)
  stickReach: number; // Reach in logical ice units
  isUser?: boolean;
  hasPuck?: boolean;
  assistTier?: 'GOLD' | 'SILVER' | 'NONE';
  path?: Vec2[];
}

export type PuckFlightType =
  | 'CARRY'
  | 'SNAP'
  | 'SAUCER'
  | 'BANK'
  | 'SHOT'
  | 'LOOSE';

export interface PuckState {
  pos: Vec2;
  vel: Vec2;
  z: number;  // Elevation above ice (0 = ice, >1.2 clears defender stick blades)
  vz: number; // Vertical velocity
  ownerId: string | null;
  flightType: PuckFlightType;
  trail: Array<{ x: number; y: number; z: number }>;
}

export interface SkateParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export interface TelestratorCue {
  from: Vec2;
  to: Vec2;
  curvedVia?: Vec2;
  threatPos?: Vec2;
  headline: string; // Concise < 12 words
  kind: 'GOLD' | 'SILVER' | 'REWIND';
}

export type GestureActionType = 'SNAP_PASS' | 'SAUCER_PASS' | 'BANK_PASS' | 'SKATE_CARRY' | 'SHOT';

export interface ReadOptionSpec {
  action: GestureActionType;
  targetId?: string;
  targetSpot: Vec2;
  label: string;
  praiseCue: string; // < 12 words
}

export interface SkaterBlueprint {
  id: string;
  label: string;
  role: SkaterRole;
  team: 'HOME' | 'AWAY';
  start: Vec2;
  rollInTo: Vec2;
  path?: Vec2[];
  hipCommitAngle?: number;
  stickLaneAngle?: number;
  deceptionSweep?: boolean;
}

export interface PlayBlueprint {
  id: string;
  title: string;
  pillar: IqPillarId;
  zone: IceZone;
  federation?: FederationProfile;
  recommendedRole: PlayerPosition;
  carrierId: string;
  skaters: SkaterBlueprint[];
  defenderKeyId: string;
  goldOption: ReadOptionSpec;
  silverOption: ReadOptionSpec;
  missedCueText: string; // Strictly < 12 words
  coachVoiceCaption?: string;
  coachAudioDataUrl?: string;
  isMirroredRedemption?: boolean;
  isCustom?: boolean;
}

export interface TeamPlayPack {
  version: '2.0';
  teamName: string;
  federation: FederationProfile;
  createdAt: string;
  plays: PlayBlueprint[];
}

export interface PlayerProfile {
  ageTier: AgeTier;
  position: PlayerPosition;
  federation: FederationProfile;
  orientation: RinkOrientation;
  muted: boolean;
  iqScore: number; // 0..1000+
  streak: number;
  bestStreak: number;
  repsCompleted: number;
  goldCount: number;
  silverCount: number;
  turnoverCount: number;
  pillarMastery: Record<IqPillarId, number>; // 0..100 mastery per pillar
}

export interface CaptionEvent {
  id: number;
  text: string;
  tone: 'cue' | 'gold' | 'silver' | 'turnover' | 'voice';
  sfxTag: string;
  timestamp: number;
}
