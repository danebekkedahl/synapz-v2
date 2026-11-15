import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RedemptionQueueManager,
  applyRepResultToProfile,
  computeAdaptiveParams,
  createDefaultProfile,
  getBaselineIqForAge,
} from './curriculum/AdaptiveIqDirector';
import { SEED_PLAY_LIBRARY, getPlaysForPillar } from './curriculum/PlayLibrary';
import { soundEngine } from './engine/SoundAndHaptics';
import {
  loadPersistedCustomPlays,
  loadPersistedProfile,
  savePersistedCustomPlays,
  savePersistedProfile,
  stampV2BootSession,
} from './engine/StorageIsolation';
import { CoachStudioMode } from './modes/CoachStudioMode';
import { HeadUpScannerMode } from './modes/HeadUpScannerMode';
import { LiveReadMode } from './modes/LiveReadMode';
import { PositionLabMode } from './modes/PositionLabMode';
import {
  AgeTier,
  AppModeId,
  FederationProfile,
  IqPillarId,
  PlayBlueprint,
  PlayerPosition,
  PlayerProfile,
} from './types/hockey';
import { DesktopTelemetryAside } from './ui/DesktopTelemetryAside';
import { IqRadarDashboard } from './ui/IqRadarDashboard';
import { PlaytestNotesModal } from './ui/PlaytestNotesModal';
import { TabletRail } from './ui/TabletRail';
import { TelestratorCaptionBar } from './ui/TelestratorCaptionBar';
import { TopCommandBar } from './ui/TopCommandBar';

const MODE_HOTKEYS: Record<string, AppModeId> = {
  '1': 'LIVE_READ',
  '2': 'POSITION_LAB',
  '3': 'HEAD_UP_SCAN',
  '4': 'MY_IQ',
  '5': 'COACH_STUDIO',
};

export const App: React.FC = () => {
  const [profile, setProfile] = useState<PlayerProfile>(() =>
    loadPersistedProfile(createDefaultProfile)
  );
  const [activeMode, setActiveMode] = useState<AppModeId>('LIVE_READ');
  const [showHubOverlay, setShowHubOverlay] = useState<boolean>(true);
  const [notesOpen, setNotesOpen] = useState<boolean>(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState<boolean>(false);
  const [playIndex, setPlayIndex] = useState<number>(0);
  const [focusedPillar, setFocusedPillar] = useState<IqPillarId | null>(null);
  const [customPlays, setCustomPlays] = useState<PlayBlueprint[]>(() =>
    loadPersistedCustomPlays()
  );
  const [overridePlay, setOverridePlay] = useState<PlayBlueprint | null>(null);

  const redemptionRef = useRef<RedemptionQueueManager>(new RedemptionQueueManager());

  useEffect(() => {
    stampV2BootSession();
    soundEngine.installGlobalUnlock();
    soundEngine.setMuted(profile.muted);
  }, [profile.muted]);

  useEffect(() => {
    savePersistedProfile(profile);
  }, [profile]);

  useEffect(() => {
    savePersistedCustomPlays(customPlays);
  }, [customPlays]);

  const adaptive = useMemo(() => computeAdaptiveParams(profile), [profile]);

  const activePlay: PlayBlueprint = useMemo(() => {
    if (overridePlay) return overridePlay;
    const pool = getPlaysForPillar(focusedPillar, customPlays);
    return pool[playIndex % pool.length] ?? SEED_PLAY_LIBRARY[0];
  }, [overridePlay, focusedPillar, customPlays, playIndex]);

  const handleAdvancePlay = useCallback(() => {
    const readyRedemption = redemptionRef.current.popReadyPlay();
    if (readyRedemption) {
      setOverridePlay(readyRedemption);
      return;
    }
    setOverridePlay(null);
    setPlayIndex((idx) => idx + 1);
  }, []);

  // PC Keyboard Conveniences: Space = Start/Replay Shift, 1-5 = Switch Tabs, Esc = Close Modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        if (e.key === 'Escape') {
          (target as HTMLElement).blur();
          setNotesOpen(false);
          setProfileDrawerOpen(false);
        }
        return;
      }

      if (e.key === 'Escape') {
        setNotesOpen(false);
        setProfileDrawerOpen(false);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (showHubOverlay) {
          setShowHubOverlay(false);
          soundEngine.playSkateCarve('Puck dropped — Live Shift active!');
        } else {
          handleAdvancePlay();
        }
        return;
      }

      const mappedMode = MODE_HOTKEYS[e.key];
      if (mappedMode) {
        setShowHubOverlay(false);
        setActiveMode(mappedMode);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showHubOverlay, handleAdvancePlay]);

  const handleChangeAge = (ageTier: AgeTier) => {
    setProfile((prev) => ({ ...prev, ageTier, iqScore: getBaselineIqForAge(ageTier) }));
    soundEngine.emitCaption(`Switched profile to ${ageTier}`, 'cue', 'PROFILE');
  };

  const handleChangePosition = (position: PlayerPosition) => {
    setProfile((prev) => ({ ...prev, position }));
    soundEngine.emitCaption(`Role locked: ${position}`, 'cue', 'POSITION');
  };

  const handleChangeFederation = (federation: FederationProfile) => {
    setProfile((prev) => ({ ...prev, federation }));
    soundEngine.emitCaption(`Ice surface rules: ${federation}`, 'cue', 'FEDERATION');
  };

  const handleToggleOrientation = () => {
    setProfile((prev) => {
      const next = prev.orientation === 'ATTACK_UP' ? 'BROADCAST' : 'ATTACK_UP';
      soundEngine.emitCaption(
        next === 'ATTACK_UP' ? 'North-South Attack-Up View' : 'Broadcast Horizontal View',
        'cue',
        'CAMERA'
      );
      return { ...prev, orientation: next };
    });
  };

  const handleToggleMute = () => {
    setProfile((prev) => {
      const nextMuted = !prev.muted;
      soundEngine.setMuted(nextMuted);
      return { ...prev, muted: nextMuted };
    });
  };

  const handleSelectMode = (mode: AppModeId) => {
    setShowHubOverlay(false);
    setProfileDrawerOpen(false);
    setActiveMode(mode);
  };

  const handleCompleteLiveRep = (grade: 'GOLD' | 'SILVER' | 'TURNOVER', play: PlayBlueprint) => {
    setProfile((prev) => applyRepResultToProfile(prev, play.pillar, grade));
    if (grade === 'TURNOVER') redemptionRef.current.scheduleRedemption(play);
  };

  return (
    <div className="arena-shell" data-testid="synapz-arena-shell">
      <TopCommandBar
        profile={profile}
        tierLabel={adaptive.tierLabel}
        redemptionPending={redemptionRef.current.pendingCount()}
        drawerOpen={profileDrawerOpen}
        onToggleDrawer={() => setProfileDrawerOpen((v) => !v)}
        onOpenNotes={() => setNotesOpen(true)}
        onChangeAge={handleChangeAge}
        onChangePosition={handleChangePosition}
        onChangeFederation={handleChangeFederation}
        onToggleOrientation={handleToggleOrientation}
        onToggleMute={handleToggleMute}
      />

      <div className="arena-body">
        <TabletRail activeMode={activeMode} onSelectMode={handleSelectMode} />

        <main className="arena-main-stage">
          {activeMode === 'LIVE_READ' && !showHubOverlay && (
            <LiveReadMode
              play={activePlay}
              adaptive={adaptive}
              orientation={profile.orientation}
              federation={profile.federation}
              onCompleteRep={handleCompleteLiveRep}
              onNextPlay={handleAdvancePlay}
            />
          )}

          {activeMode === 'LIVE_READ' && showHubOverlay && (
            <div className="command-hub-launchpad" data-testid="command-hub-launchpad">
              <div className="hub-card">
                <span className="hub-eyebrow">UNIVERSAL ARENA HUB · PC · TABLET · PHONE</span>
                <h1>Read the Ice in 2 Seconds.</h1>
                <p>
                  Watch defender hips &amp; stick blades in live motion. Click/tap open tape to snap,
                  curve-drag to saucer over sticks, or drag to walk the seam.
                </p>
                <div className="hub-cta-grid">
                  <button
                    type="button"
                    className="touch-btn primary-cta-btn giant-drop-btn"
                    onClick={() => {
                      setShowHubOverlay(false);
                      soundEngine.playSkateCarve('Puck dropped — Live Shift active!');
                    }}
                    data-testid="drop-puck-start-btn"
                  >
                    ⚡ Drop Puck — Start Live Shift
                  </button>
                  <button
                    type="button"
                    className="touch-btn secondary-btn"
                    onClick={() => handleSelectMode('POSITION_LAB')}
                    data-testid="hub-open-poslab-btn"
                  >
                    🧲 Position &amp; Spacing Lab
                  </button>
                  <button
                    type="button"
                    className="touch-btn secondary-btn"
                    onClick={() => handleSelectMode('COACH_STUDIO')}
                    data-testid="hub-open-studio-btn"
                  >
                    📋 Coach &amp; 3v3 Studio
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeMode === 'POSITION_LAB' && (
            <PositionLabMode
              role={profile.position}
              onSelectRole={handleChangePosition}
              orientation={profile.orientation}
              federation={profile.federation}
              onScoreOffPuck={(p, g) => setProfile((prev) => applyRepResultToProfile(prev, p, g))}
            />
          )}

          {activeMode === 'HEAD_UP_SCAN' && (
            <HeadUpScannerMode
              adaptive={adaptive}
              orientation={profile.orientation}
              federation={profile.federation}
              onScoreScan={(p, g) => setProfile((prev) => applyRepResultToProfile(prev, p, g))}
            />
          )}

          {activeMode === 'MY_IQ' && (
            <IqRadarDashboard
              profile={profile}
              tierLabel={adaptive.tierLabel}
              redemptionPending={redemptionRef.current.pendingCount()}
              onTrainPillar={(p) => {
                setFocusedPillar(p);
                setOverridePlay(null);
                setShowHubOverlay(false);
                setActiveMode('LIVE_READ');
              }}
            />
          )}

          {activeMode === 'COACH_STUDIO' && (
            <CoachStudioMode
              orientation={profile.orientation}
              federation={profile.federation}
              onChangeFederation={handleChangeFederation}
              customPlays={customPlays}
              onLaunchCustomPlay={(customPlay, targetMode) => {
                setCustomPlays((prev) => [customPlay, ...prev]);
                setOverridePlay(customPlay);
                setShowHubOverlay(false);
                setActiveMode(targetMode);
              }}
              onImportPlayPack={(plays) => setCustomPlays((prev) => [...plays, ...prev])}
            />
          )}

          <TelestratorCaptionBar />
        </main>

        <DesktopTelemetryAside
          activeMode={activeMode}
          activePlay={activePlay}
          profile={profile}
          adaptive={adaptive}
          onNextShift={() => {
            setShowHubOverlay(false);
            handleAdvancePlay();
          }}
          onToggleOrientation={handleToggleOrientation}
          onOpenNotes={() => setNotesOpen(true)}
        />
      </div>

      <PlaytestNotesModal
        open={notesOpen}
        activeMode={activeMode}
        onClose={() => setNotesOpen(false)}
      />
    </div>
  );
};
