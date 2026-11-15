import { PlayBlueprint, PlayerProfile } from '../types/hockey';

export const SYNAPZ_V2_PREFIX = 'synapz_v2_' as const;

export const STORAGE_KEYS = {
  BOOT_VERSION: 'synapz_v2_boot_version',
  PROFILE: 'synapz_v2_profile',
  CUSTOM_PLAYS: 'synapz_v2_custom_plays',
  PLAYTEST_NOTES: 'synapz_v2_playtest_notes',
} as const;

export interface PlaytestNoteEntry {
  id: string;
  tag: string;
  text: string;
  deviceSummary: string;
  createdAt: string;
}

function assertIsolatedKey(key: string): void {
  if (!key.startsWith(SYNAPZ_V2_PREFIX)) {
    throw new Error(`Storage isolation violation: key "${key}" must start with "${SYNAPZ_V2_PREFIX}"`);
  }
}

export function writeV2Storage<T>(key: string, value: T): void {
  assertIsolatedKey(key);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

export function readV2Storage<T>(key: string, fallback: T): T {
  assertIsolatedKey(key);
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function stampV2BootSession(): void {
  if (typeof window === 'undefined') return;
  writeV2Storage(STORAGE_KEYS.BOOT_VERSION, '2.0.0');
  try {
    window.sessionStorage.setItem('synapz_v2_session_active', '1');
  } catch {
    // Ignore private mode
  }
}

export function loadPersistedProfile(defaultFactory: () => PlayerProfile): PlayerProfile {
  const base = defaultFactory();
  const saved = readV2Storage<Partial<PlayerProfile> | null>(STORAGE_KEYS.PROFILE, null);
  if (!saved || typeof saved !== 'object') {
    writeV2Storage(STORAGE_KEYS.PROFILE, base);
    return base;
  }
  return {
    ...base,
    ...saved,
    pillarMastery: {
      ...base.pillarMastery,
      ...(saved.pillarMastery ?? {}),
    },
  };
}

export function savePersistedProfile(profile: PlayerProfile): void {
  writeV2Storage(STORAGE_KEYS.PROFILE, profile);
}

export function loadPersistedCustomPlays(): PlayBlueprint[] {
  return readV2Storage<PlayBlueprint[]>(STORAGE_KEYS.CUSTOM_PLAYS, []);
}

export function savePersistedCustomPlays(plays: PlayBlueprint[]): void {
  writeV2Storage(STORAGE_KEYS.CUSTOM_PLAYS, plays);
}
