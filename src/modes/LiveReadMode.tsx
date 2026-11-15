import React, { useEffect, useRef, useState } from 'react';
import { AdaptiveDifficultyParams } from '../curriculum/AdaptiveIqDirector';
import {
  LiveSimState,
  instantiateBlueprint,
  launchPuckAction,
  stepConsequence,
  stepRollIn,
} from '../engine/PhysicsEngine';
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
  PlayBlueprint,
  PuckFlightType,
  RinkOrientation,
  TelestratorCue,
  Vec2,
} from '../types/hockey';
import { classifyLiveReadGesture } from './gestureClassifier';

export type LivePhase = 'ROLL_IN' | 'READ_WINDOW' | 'CONSEQUENCE' | 'REWIND';

interface LiveReadModeProps {
  play: PlayBlueprint;
  adaptive: AdaptiveDifficultyParams;
  orientation: RinkOrientation;
  federation: FederationProfile;
  onCompleteRep: (grade: 'GOLD' | 'SILVER' | 'TURNOVER', play: PlayBlueprint) => void;
  onNextPlay: () => void;
}

export const LiveReadMode: React.FC<LiveReadModeProps> = ({
  play,
  adaptive,
  orientation,
  federation,
  onCompleteRep,
  onNextPlay,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useArenaCanvasSize(wrapRef, canvasRef);
  const vpRef = useRef<ViewportTransform | null>(null);
  const simRef = useRef<LiveSimState>(instantiateBlueprint(play, adaptive.showAssistRings));
  const phaseRef = useRef<LivePhase>('ROLL_IN');
  const phaseTimerRef = useRef<number>(0);
  const resolvedRef = useRef<boolean>(false);
  const gradeRef = useRef<'GOLD' | 'SILVER' | 'TURNOVER'>('GOLD');
  const dragPointsRef = useRef<Vec2[]>([]);
  const dragIceRef = useRef<Vec2[]>([]);

  const [phase, setPhase] = useState<LivePhase>('ROLL_IN');
  const [cursorStyle, setCursorStyle] = useState<'default' | 'pointer' | 'grab' | 'grabbing'>('pointer');
  const [bannerText, setBannerText] = useState<string>(play.title);
  const [resultBadge, setResultBadge] = useState<'GOLD' | 'SILVER' | 'TURNOVER' | null>(null);
  const [rewindCue, setRewindCue] = useState<TelestratorCue | null>(null);
  const [hudCoords, setHudCoords] = useState({ gx: 0, gy: 0, cx: 0, cy: 0, dx: 0, dy: 0 });

  const setLivePhase = (next: LivePhase) => {
    phaseRef.current = next;
    phaseTimerRef.current = 0;
    setPhase(next);
  };

  useEffect(() => {
    simRef.current = instantiateBlueprint(play, adaptive.showAssistRings);
    resolvedRef.current = false;
    setResultBadge(null);
    setRewindCue(null);
    setBannerText(play.isMirroredRedemption ? `🔁 ${play.title}` : play.title);
    setLivePhase('ROLL_IN');
    soundEngine.playSkateCarve(
      play.coachVoiceCaption ?? `${play.title} — Watch defender hips & stick!`
    );
    if (play.coachAudioDataUrl && play.coachVoiceCaption) {
      soundEngine.playCoachAudio(play.coachAudioDataUrl, play.coachVoiceCaption);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const triggerConsequence = (
    grade: 'GOLD' | 'SILVER' | 'TURNOVER',
    flight: PuckFlightType,
    targetIce: Vec2,
    cueLabel: string
  ) => {
    if (phaseRef.current !== 'READ_WINDOW') return;
    gradeRef.current = grade;
    setResultBadge(grade);

    if (flight === 'SAUCER') soundEngine.playSaucerWhoosh(`Saucer launched — ${cueLabel}`);
    else if (flight === 'SHOT') soundEngine.playSnapPass(`Quick release shot — ${cueLabel}`);
    else soundEngine.playSnapPass(`${flight === 'BANK' ? 'Board bank' : 'Snap pass'} — ${cueLabel}`);

    const sim = simRef.current;
    if (play.goldOption.action === 'SKATE_CARRY' && grade === 'GOLD') {
      const carrier = sim.skaters.find((s) => s.id === play.carrierId);
      if (carrier) {
        carrier.bodyAngle = Math.atan2(targetIce.y - carrier.pos.y, targetIce.x - carrier.pos.x);
      }
      launchPuckAction(sim, 'SNAP', { x: 50, y: 11 });
    } else {
      launchPuckAction(sim, flight, targetIce);
    }
    setLivePhase('CONSEQUENCE');
  };

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const canvas = canvasRef.current;
      const { width: cw, height: ch, dpr } = sizeRef.current;
      if (canvas && cw > 0 && ch > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const vp = createViewport(cw, ch, play.zone, orientation, federation);
          vpRef.current = vp;

          const sim = simRef.current;
          phaseTimerRef.current += dt;
          const rollDur = 1.65;

          if (phaseRef.current === 'ROLL_IN') {
            stepRollIn(sim, play, dt, rollDur, adaptive.skaterSpeedScale, adaptive.deceptionIntensity);
            if (sim.elapsedRollIn >= rollDur) {
              setLivePhase('READ_WINDOW');
              setBannerText('25% BULLET-TIME — Tap, Curve-Saucer, Drag, or Flick!');
              soundEngine.playBulletTimeHush('Bullet-Time Read: Read stick & hip angle now!');
            }
          } else if (phaseRef.current === 'READ_WINDOW') {
            sim.skaters.forEach((sk) => {
              sk.pos.x = Math.max(5, Math.min(95, sk.pos.x + Math.cos(sk.bodyAngle) * 2.2 * dt * adaptive.bulletTimeScale));
              sk.pos.y = Math.max(8, Math.min(192, sk.pos.y + Math.sin(sk.bodyAngle) * 2.2 * dt * adaptive.bulletTimeScale));
            });
            const carrier = sim.skaters.find((s) => s.id === play.carrierId) ?? sim.skaters[0];
            if (sim.puck.ownerId === carrier.id) {
              sim.puck.pos.x = carrier.pos.x + Math.cos(carrier.stickAngle) * 4.4;
              sim.puck.pos.y = carrier.pos.y + Math.sin(carrier.stickAngle) * 4.4;
            }
            const def = sim.skaters.find((s) => s.id === play.defenderKeyId);
            const gs = iceToScreen(vp, play.goldOption.targetSpot);
            const cs = iceToScreen(vp, carrier.pos);
            const ds = def ? iceToScreen(vp, def.pos) : { x: cs.x, y: cs.y - 40 };
            setHudCoords({
              gx: Math.round(gs.x),
              gy: Math.round(gs.y),
              cx: Math.round(cs.x),
              cy: Math.round(cs.y),
              dx: Math.round(ds.x),
              dy: Math.round(ds.y),
            });

            if (phaseTimerRef.current * 1000 >= adaptive.readWindowMs) {
              triggerConsequence('TURNOVER', 'SNAP', def ? { ...def.pos } : { x: 50, y: 100 }, 'Held too long');
            }
          } else if (phaseRef.current === 'CONSEQUENCE') {
            stepConsequence(sim, play, dt, gradeRef.current);
            if (phaseTimerRef.current >= 1.75 && !resolvedRef.current) {
              resolvedRef.current = true;
              const finalGrade = sim.outcome?.grade ?? gradeRef.current;
              onCompleteRep(finalGrade, play);
              if (finalGrade === 'GOLD') {
                soundEngine.playGoalHorn(play.goldOption.praiseCue);
                setBannerText(`🥇 GOLD READ — ${play.goldOption.praiseCue}`);
                onNextPlay();
              } else if (finalGrade === 'SILVER') {
                soundEngine.playPostPing(play.silverOption.praiseCue);
                setBannerText(`🥈 SILVER READ — ${play.silverOption.praiseCue}`);
                onNextPlay();
              } else {
                soundEngine.playShinBlock(play.missedCueText);
                simRef.current = instantiateBlueprint(play, true);
                stepRollIn(simRef.current, play, rollDur, rollDur, 1, 0);
                const carrier =
                  simRef.current.skaters.find((s) => s.id === play.carrierId) ?? simRef.current.skaters[0];
                const def = simRef.current.skaters.find((s) => s.id === play.defenderKeyId);
                setRewindCue({
                  from: { ...carrier.pos },
                  to: { ...play.goldOption.targetSpot },
                  curvedVia:
                    play.goldOption.action === 'SAUCER_PASS'
                      ? {
                          x: (carrier.pos.x + play.goldOption.targetSpot.x) * 0.5,
                          y: Math.min(carrier.pos.y, play.goldOption.targetSpot.y) - 10,
                        }
                      : undefined,
                  threatPos: def ? { ...def.pos } : undefined,
                  headline: play.missedCueText,
                  kind: 'REWIND',
                });
                setBannerText(`⏪ TELESTRATOR REWIND: ${play.missedCueText}`);
                setLivePhase('REWIND');
              }
            }
          } else if (phaseRef.current === 'REWIND' && phaseTimerRef.current >= 1.85) {
            phaseTimerRef.current = -999;
            onNextPlay();
          }

          renderRinkScene(ctx, vp, {
            skaters: simRef.current.skaters,
            puck: simRef.current.puck,
            particles: simRef.current.particles,
            showAssistRings: adaptive.showAssistRings,
            bulletTimeTint: phaseRef.current === 'READ_WINDOW' ? 0.9 : 0,
            telestrator: phaseRef.current === 'REWIND' ? rewindCue : null,
            drawnPaths:
              dragIceRef.current.length > 1
                ? [{ points: dragIceRef.current, color: '#38bdf8', dashed: true }]
                : undefined,
            nowMs: now,
          });
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [play, adaptive, orientation, federation, rewindCue, sizeRef]);

  const finishGesture = (pointerId?: number) => {
    if (pointerId !== undefined && canvasRef.current?.hasPointerCapture(pointerId)) {
      canvasRef.current.releasePointerCapture(pointerId);
    }
    const pts = dragPointsRef.current;
    const icePts = dragIceRef.current;
    dragPointsRef.current = [];
    dragIceRef.current = [];
    setCursorStyle('pointer');
    if (pts.length === 0 || phaseRef.current !== 'READ_WINDOW') return;
    const g = classifyLiveReadGesture(pts, icePts, simRef.current, play);
    triggerConsequence(g.grade, g.flight, g.targetSpot, g.cueLabel);
  };

  return (
    <div className="mode-stage">
      <div className="mode-hud-bar">
        <div className="hud-pill-group">
          <span className={`phase-chip phase-${phase.toLowerCase()}`} data-testid="live-phase-chip">
            {phase === 'ROLL_IN' && '▶ LIVE ROLL-IN'}
            {phase === 'READ_WINDOW' && '⚡ 25% BULLET-TIME'}
            {phase === 'CONSEQUENCE' && '🏒 100% LIVE OUTCOME'}
            {phase === 'REWIND' && '⏪ TELESTRATOR REWIND'}
          </span>
          <span className="hud-title-text" data-testid="live-banner-text">
            {bannerText}
          </span>
        </div>
        <div className="hud-gesture-strip" aria-label="Touch & Mouse Gestures">
          <span className="gesture-tag">👆 Click/Tap = Snap</span>
          <span className="gesture-tag">↪ Curve-Drag = Saucer</span>
          <span className="gesture-tag">✊ Drag Carrier = Skate</span>
          <button
            type="button"
            className="touch-btn secondary-btn"
            onClick={onNextPlay}
            data-testid="live-next-btn"
          >
            Skip / Next ▶
          </button>
        </div>
      </div>

      <div className="canvas-arena-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="rink-canvas"
          style={{ cursor: cursorStyle }}
          data-testid="live-read-canvas"
          data-phase={phase}
          data-play-id={play.id}
          data-gold-action={play.goldOption.action}
          data-gold-x={hudCoords.gx}
          data-gold-y={hudCoords.gy}
          data-carrier-x={hudCoords.cx}
          data-carrier-y={hudCoords.cy}
          data-def-x={hudCoords.dx}
          data-def-y={hudCoords.dy}
          onPointerDown={(e) => {
            if (phaseRef.current !== 'READ_WINDOW' || !vpRef.current || !canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const sp = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            dragPointsRef.current = [sp];
            dragIceRef.current = [screenToIce(vpRef.current, sp)];
            setCursorStyle('grabbing');
            canvasRef.current.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!vpRef.current || !canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const sp = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            const ice = screenToIce(vpRef.current, sp);
            if (dragPointsRef.current.length > 0) {
              dragPointsRef.current.push(sp);
              dragIceRef.current.push(ice);
              return;
            }
            if (phaseRef.current === 'READ_WINDOW') {
              const carrier = simRef.current.skaters.find((s) => s.id === play.carrierId);
              if (carrier && distanceIce(ice, carrier.pos) <= 10) setCursorStyle('grab');
              else setCursorStyle('pointer');
            } else {
              setCursorStyle('default');
            }
          }}
          onPointerUp={(e) => finishGesture(e.pointerId)}
          onPointerCancel={(e) => {
            if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
              canvasRef.current.releasePointerCapture(e.pointerId);
            }
            dragPointsRef.current = [];
            dragIceRef.current = [];
            setCursorStyle('pointer');
          }}
        />
        {resultBadge && phase === 'REWIND' && (
          <div className="rewind-floating-card" data-testid="telestrator-rewind-card">
            <strong>⏪ MISSED CUE:</strong> {play.missedCueText}
          </div>
        )}
      </div>
    </div>
  );
};
