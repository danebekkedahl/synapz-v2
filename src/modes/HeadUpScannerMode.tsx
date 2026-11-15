import React, { useEffect, useRef, useState } from 'react';
import { AdaptiveDifficultyParams } from '../curriculum/AdaptiveIqDirector';
import { SCAN_DRILLS, buildScannerEntities } from '../curriculum/ScannerDrills';
import { renderRinkScene } from '../engine/RinkRenderer';
import {
  ViewportTransform,
  createViewport,
  distanceIce,
  iceToScreen,
  screenToIce,
} from '../engine/RinkViewport';
import { soundEngine } from '../engine/SoundAndHaptics';
import { useArenaCanvasSize } from '../engine/useArenaCanvas';
import {
  FederationProfile,
  IqPillarId,
  PuckState,
  RinkOrientation,
  SkaterEntity,
  TelestratorCue,
  Vec2,
} from '../types/hockey';

type ScanPhase = 'SCAN_WINDOW' | 'ONE_TOUCH_FOG' | 'REVEAL';

interface HeadUpScannerModeProps {
  adaptive: AdaptiveDifficultyParams;
  orientation: RinkOrientation;
  federation: FederationProfile;
  onScoreScan: (pillar: IqPillarId, grade: 'GOLD' | 'SILVER' | 'TURNOVER') => void;
}

export const HeadUpScannerMode: React.FC<HeadUpScannerModeProps> = ({
  adaptive,
  orientation,
  federation,
  onScoreScan,
}) => {
  const [drillIdx, setDrillIdx] = useState(0);
  const [phase, setPhase] = useState<ScanPhase>('SCAN_WINDOW');
  const [cursorStyle, setCursorStyle] = useState<'pointer' | 'grabbing'>('pointer');
  const [statusText, setStatusText] = useState('👀 SCAN LANES BEFORE PUCK ARRIVES!');
  const [telestrator, setTelestrator] = useState<TelestratorCue | null>(null);
  const [probe, setProbe] = useState({ yx: 0, yy: 0, ox: 0, oy: 0 });

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useArenaCanvasSize(wrapRef, canvasRef);
  const vpRef = useRef<ViewportTransform | null>(null);
  const phaseRef = useRef<ScanPhase>('SCAN_WINDOW');
  const timerRef = useRef<number>(0);
  const dragStartRef = useRef<Vec2 | null>(null);

  const drill = SCAN_DRILLS[drillIdx % SCAN_DRILLS.length];
  const puckRef = useRef<PuckState>({
    pos: { ...drill.passFrom },
    vel: { x: 0, y: 0 },
    z: 0,
    vz: 0,
    ownerId: null,
    flightType: 'SNAP',
    trail: [],
  });
  const skatersRef = useRef<SkaterEntity[]>([]);

  const setScanPhase = (next: ScanPhase) => {
    phaseRef.current = next;
    timerRef.current = 0;
    setPhase(next);
  };

  useEffect(() => {
    setTelestrator(null);
    setScanPhase('SCAN_WINDOW');
    setStatusText(
      `👀 SHOULDER-CHECK (${(adaptive.scanWindowMs / 1000).toFixed(1)}s) — Spot the Open Outlet!`
    );
    puckRef.current = {
      pos: { ...drill.passFrom },
      vel: { x: 0, y: 0 },
      z: 0,
      vz: 0,
      ownerId: null,
      flightType: 'SNAP',
      trail: [],
    };
    skatersRef.current = buildScannerEntities(drill, adaptive.showAssistRings);
    soundEngine.playSnapPass(`${drill.title} — Scan before reception!`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillIdx]);

  const executeOneTouch = (aimIce: Vec2) => {
    if (phaseRef.current !== 'ONE_TOUCH_FOG') return;
    const aimAngle = Math.atan2(aimIce.y - drill.youPos.y, aimIce.x - drill.youPos.x);
    const goldAngle = Math.atan2(
      drill.openSpot.y - drill.youPos.y,
      drill.openSpot.x - drill.youPos.x
    );
    const angleDiff = Math.abs(
      Math.atan2(Math.sin(aimAngle - goldAngle), Math.cos(aimAngle - goldAngle))
    );

    const hitGold = distanceIce(aimIce, drill.openSpot) <= 18 || angleDiff <= 0.46;
    const hitSilver = distanceIce(aimIce, drill.silverSpot) <= 18;
    const target = hitGold ? drill.openSpot : hitSilver ? drill.silverSpot : drill.defenderJumpTo;
    const dist = Math.max(1, distanceIce(drill.youPos, target));
    puckRef.current.vel = {
      x: ((target.x - drill.youPos.x) / dist) * 68,
      y: ((target.y - drill.youPos.y) / dist) * 68,
    };

    if (hitGold) {
      setStatusText(`🥇 GOLD PRE-SCAN ONE-TOUCH! ${drill.cue}`);
      soundEngine.playGoalHorn(`One-Touch Gold! ${drill.cue}`);
      onScoreScan(drill.pillar, 'GOLD');
    } else if (hitSilver) {
      setStatusText('🥈 SILVER SAFETY TOUCH — Preserved possession!');
      soundEngine.playPostPing('Silver Safety Reset!');
      onScoreScan(drill.pillar, 'SILVER');
    } else {
      setStatusText(`⏪ JUMPED BY D1 — ${drill.cue}`);
      setTelestrator({
        from: { ...drill.youPos },
        to: { ...drill.openSpot },
        threatPos: { ...drill.defenderJumpTo },
        headline: drill.cue,
        kind: 'REWIND',
      });
      soundEngine.playShinBlock(drill.cue);
      onScoreScan(drill.pillar, 'TURNOVER');
    }
    setScanPhase('REVEAL');
  };

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    const scanDurSec = adaptive.scanWindowMs / 1000;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const canvas = canvasRef.current;
      const { width: cw, height: ch, dpr } = sizeRef.current;
      if (canvas && cw > 0 && ch > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const vp = createViewport(cw, ch, drill.zone, orientation, federation);
          vpRef.current = vp;

          timerRef.current += dt;
          if (phaseRef.current === 'SCAN_WINDOW') {
            const t = Math.min(1, timerRef.current / scanDurSec);
            puckRef.current.pos = {
              x: drill.passFrom.x + (drill.youPos.x - drill.passFrom.x) * t,
              y: drill.passFrom.y + (drill.youPos.y - drill.passFrom.y) * t,
            };
            const openSk = skatersRef.current.find((s) => s.id === 'OPEN');
            const baitSk = skatersRef.current.find((s) => s.id === 'BAITED');
            const jumpSk = skatersRef.current.find((s) => s.id === 'JUMPER');
            if (openSk) openSk.pos.y = drill.openSpot.y + (1 - t) * 10;
            if (baitSk) baitSk.pos.y = drill.baitedSpot.y + (1 - t) * 8;
            if (jumpSk) {
              jumpSk.pos.x = 50 + (drill.defenderJumpTo.x - 50) * t;
              jumpSk.pos.y = drill.defenderJumpTo.y - 8 + 8 * t;
            }
            if (t >= 1) {
              setScanPhase('ONE_TOUCH_FOG');
              setStatusText('🌫 HEAD UP — ONE-TOUCH FLICK TO OPEN LANE!');
              soundEngine.playBulletTimeHush('Head Up — One-Touch It!');
            }
          } else if (phaseRef.current === 'ONE_TOUCH_FOG') {
            const ys = iceToScreen(vp, drill.youPos);
            const os = iceToScreen(vp, drill.openSpot);
            setProbe({
              yx: Math.round(ys.x),
              yy: Math.round(ys.y),
              ox: Math.round(os.x),
              oy: Math.round(os.y),
            });
            if (timerRef.current >= 2.6) executeOneTouch(drill.baitedSpot);
          } else if (phaseRef.current === 'REVEAL') {
            puckRef.current.pos.x += puckRef.current.vel.x * dt;
            puckRef.current.pos.y += puckRef.current.vel.y * dt;
            if (timerRef.current >= 1.65) {
              timerRef.current = -999;
              setDrillIdx((i) => i + 1);
            }
          }

          renderRinkScene(ctx, vp, {
            skaters: skatersRef.current,
            puck: puckRef.current,
            showAssistRings: phaseRef.current === 'SCAN_WINDOW' && adaptive.showAssistRings,
            fogAround:
              phaseRef.current === 'ONE_TOUCH_FOG'
                ? { center: drill.youPos, clearRadius: 11.5, alpha: 0.94 }
                : null,
            telestrator: phaseRef.current === 'REVEAL' ? telestrator : null,
            nowMs: now,
          });
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [drill, adaptive, orientation, federation, telestrator, sizeRef]);

  return (
    <div className="mode-stage">
      <div className="mode-hud-bar">
        <div className="hud-pill-group">
          <span className={`phase-chip phase-${phase.toLowerCase()}`} data-testid="scan-phase-chip">
            {phase === 'SCAN_WINDOW' && '👀 SHOULDER-CHECK'}
            {phase === 'ONE_TOUCH_FOG' && '🌫 ONE-TOUCH NOW'}
            {phase === 'REVEAL' && '⚡ LANE REVEAL'}
          </span>
          <span className="hud-title-text" data-testid="scan-status-text">
            {statusText}
          </span>
        </div>
        <button
          type="button"
          className="touch-btn secondary-btn"
          onClick={() => setDrillIdx((i) => i + 1)}
          data-testid="scan-next-btn"
        >
          Next Scan ▶
        </button>
      </div>

      <div className="canvas-arena-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="rink-canvas"
          style={{ cursor: cursorStyle }}
          data-testid="scanner-canvas"
          data-scan-phase={phase}
          data-you-x={probe.yx}
          data-you-y={probe.yy}
          data-open-x={probe.ox}
          data-open-y={probe.oy}
          onPointerDown={(e) => {
            if (!vpRef.current || !canvasRef.current) return;
            const r = canvasRef.current.getBoundingClientRect();
            dragStartRef.current = screenToIce(vpRef.current, {
              x: e.clientX - r.left,
              y: e.clientY - r.top,
            });
            setCursorStyle('grabbing');
            canvasRef.current.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
              canvasRef.current.releasePointerCapture(e.pointerId);
            }
            setCursorStyle('pointer');
            if (!vpRef.current || !canvasRef.current) return;
            const r = canvasRef.current.getBoundingClientRect();
            const endIce = screenToIce(vpRef.current, {
              x: e.clientX - r.left,
              y: e.clientY - r.top,
            });
            const startIce = dragStartRef.current;
            dragStartRef.current = null;
            if (startIce && distanceIce(startIce, endIce) > 6) {
              const vx = endIce.x - startIce.x;
              const vy = endIce.y - startIce.y;
              executeOneTouch({ x: drill.youPos.x + vx * 1.4, y: drill.youPos.y + vy * 1.4 });
            } else {
              executeOneTouch(endIce);
            }
          }}
          onPointerCancel={(e) => {
            if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
              canvasRef.current.releasePointerCapture(e.pointerId);
            }
            dragStartRef.current = null;
            setCursorStyle('pointer');
          }}
        />
      </div>
    </div>
  );
};
