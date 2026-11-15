import React, { useEffect, useRef, useState } from 'react';
import {
  OFF_PUCK_QUIZ_PRESETS,
  ROLES_LIST,
  computeDisplacedStart,
} from '../curriculum/OffPuckChallenges';
import {
  TACTICAL_SCENARIOS,
  TacticalScenarioId,
  buildEntitiesFromSolution,
  solveTacticalPositions,
} from '../curriculum/PositionModel';
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
  PlayerPosition,
  RinkOrientation,
  SkaterEntity,
  TelestratorCue,
  Vec2,
} from '../types/hockey';

interface PositionLabModeProps {
  role: PlayerPosition;
  onSelectRole: (r: PlayerPosition) => void;
  orientation: RinkOrientation;
  federation: FederationProfile;
  onScoreOffPuck: (pillar: IqPillarId, grade: 'GOLD' | 'SILVER' | 'TURNOVER') => void;
}

export const PositionLabMode: React.FC<PositionLabModeProps> = ({
  role,
  onSelectRole,
  orientation,
  federation,
  onScoreOffPuck,
}) => {
  const [subMode, setSubMode] = useState<'TABLE' | 'QUIZ'>('TABLE');
  const [cursorStyle, setCursorStyle] = useState<'grab' | 'grabbing' | 'pointer'>('grab');
  const [scenarioId, setScenarioId] = useState<TacticalScenarioId>('DZ_COVERAGE');
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizStatus, setQuizStatus] = useState<string>(OFF_PUCK_QUIZ_PRESETS[0].prompt);
  const [quizResult, setQuizResult] = useState<'GOLD' | 'SILVER' | 'TURNOVER' | null>(null);
  const [telestrator, setTelestrator] = useState<TelestratorCue | null>(null);
  const [hudProbe, setHudProbe] = useState({
    px: 0,
    py: 0,
    cIceX: 50,
    youX: 0,
    youY: 0,
    homeX: 0,
    homeY: 0,
  });

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useArenaCanvasSize(wrapRef, canvasRef);
  const vpRef = useRef<ViewportTransform | null>(null);
  const draggingRef = useRef<boolean>(false);

  const activeScenario =
    subMode === 'QUIZ'
      ? TACTICAL_SCENARIOS.find(
          (s) => s.id === OFF_PUCK_QUIZ_PRESETS[quizIdx % OFF_PUCK_QUIZ_PRESETS.length].scenario
        )!
      : TACTICAL_SCENARIOS.find((s) => s.id === scenarioId) ?? TACTICAL_SCENARIOS[0];

  const effectiveRole: PlayerPosition =
    activeScenario.id === 'HALF_3V3' && !['C', 'LW', 'LD'].includes(role) ? 'C' : role;

  const puckPosRef = useRef<Vec2>({ ...activeScenario.defaultPuck });
  const skatersRef = useRef<SkaterEntity[]>([]);
  const userDragPosRef = useRef<Vec2>({ x: 50, y: 120 });
  const trueHomeRef = useRef<Vec2>({ x: 50, y: 150 });

  useEffect(() => {
    setTelestrator(null);
    setQuizResult(null);
    if (subMode === 'TABLE') {
      puckPosRef.current = { ...activeScenario.defaultPuck };
      const sol = solveTacticalPositions(activeScenario.id, puckPosRef.current, effectiveRole);
      skatersRef.current = buildEntitiesFromSolution(sol, puckPosRef.current, effectiveRole);
      soundEngine.emitCaption(sol.roleCue, 'cue', 'TACTICAL TABLE');
    } else {
      const q = OFF_PUCK_QUIZ_PRESETS[quizIdx % OFF_PUCK_QUIZ_PRESETS.length];
      puckPosRef.current = { ...q.puck };
      const sol = solveTacticalPositions(q.scenario, q.puck, effectiveRole);
      const entities = buildEntitiesFromSolution(sol, q.puck, effectiveRole);
      const homeSpot = sol.targets[effectiveRole] ?? { x: 50, y: 150 };
      trueHomeRef.current = { ...homeSpot };
      const displaced = computeDisplacedStart(homeSpot);
      userDragPosRef.current = displaced;
      entities.forEach((e) => {
        if (e.id === effectiveRole) e.pos = { ...displaced };
      });
      skatersRef.current = entities;
      setQuizStatus(q.prompt);
      soundEngine.playSkateCarve(q.prompt);
    }
  }, [subMode, scenarioId, quizIdx, effectiveRole, activeScenario.defaultPuck, activeScenario.id]);

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const canvas = canvasRef.current;
      const { width: cw, height: ch, dpr } = sizeRef.current;
      if (canvas && cw > 0 && ch > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const vp = createViewport(cw, ch, activeScenario.zone, orientation, federation);
          vpRef.current = vp;

          const sol = solveTacticalPositions(activeScenario.id, puckPosRef.current, effectiveRole);
          trueHomeRef.current = sol.targets[effectiveRole] ?? trueHomeRef.current;

          skatersRef.current.forEach((sk) => {
            const target =
              subMode === 'QUIZ' && sk.id === effectiveRole
                ? userDragPosRef.current
                : sol.targets[sk.id];
            if (!target) return;
            sk.pos.x += (target.x - sk.pos.x) * Math.min(1, dt * 10);
            sk.pos.y += (target.y - sk.pos.y) * Math.min(1, dt * 10);
            const ang = Math.atan2(puckPosRef.current.y - sk.pos.y, puckPosRef.current.x - sk.pos.x);
            sk.bodyAngle = ang;
            sk.hipAngle = ang;
            sk.stickAngle = ang + 0.2;
          });

          const puckScreen = iceToScreen(vp, puckPosRef.current);
          const youSk = skatersRef.current.find((s) => s.id === effectiveRole);
          const cSk = skatersRef.current.find((s) => s.id === 'C');
          const youScreen = youSk ? iceToScreen(vp, youSk.pos) : puckScreen;
          const homeScreen = iceToScreen(vp, trueHomeRef.current);
          setHudProbe({
            px: Math.round(puckScreen.x),
            py: Math.round(puckScreen.y),
            cIceX: Math.round(cSk?.pos.x ?? 50),
            youX: Math.round(youScreen.x),
            youY: Math.round(youScreen.y),
            homeX: Math.round(homeScreen.x),
            homeY: Math.round(homeScreen.y),
          });

          const supportLines = sol.supportPairs
            .map(([aId, bId]) => {
              const sa = skatersRef.current.find((s) => s.id === aId);
              const sb = skatersRef.current.find((s) => s.id === bId);
              return sa && sb ? { a: sa.pos, b: sb.pos, color: 'rgba(14, 165, 233, 0.45)', dashed: true } : null;
            })
            .filter(Boolean) as Array<{ a: Vec2; b: Vec2; color: string; dashed?: boolean }>;

          const highlightZones = [];
          if (sol.houseZone && subMode === 'TABLE') {
            highlightZones.push({
              center: sol.houseZone.center,
              radius: sol.houseZone.radius,
              color: 'rgba(16, 185, 129, 0.14)',
              label: sol.houseZone.label,
            });
          }
          if (subMode === 'QUIZ' && quizResult) {
            highlightZones.push({
              center: trueHomeRef.current,
              radius: 8,
              color: 'rgba(16, 185, 129, 0.34)',
              label: 'HOME',
            });
          }

          renderRinkScene(ctx, vp, {
            skaters: skatersRef.current,
            puck: {
              pos: puckPosRef.current,
              vel: { x: 0, y: 0 },
              z: subMode === 'TABLE' ? 0.35 : 0,
              vz: 0,
              ownerId: null,
              flightType: 'CARRY',
              trail: [],
            },
            supportLines,
            highlightZones,
            telestrator,
            nowMs: now,
          });
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [activeScenario, effectiveRole, orientation, federation, subMode, quizResult, telestrator, sizeRef]);

  const updateDragSpot = (clientX: number, clientY: number) => {
    if (!vpRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const ice = screenToIce(vpRef.current, { x: clientX - rect.left, y: clientY - rect.top });
    if (subMode === 'TABLE') puckPosRef.current = ice;
    else if (!quizResult) userDragPosRef.current = ice;
  };

  const endDrag = (pointerId?: number) => {
    if (pointerId !== undefined && canvasRef.current?.hasPointerCapture(pointerId)) {
      canvasRef.current.releasePointerCapture(pointerId);
    }
    setCursorStyle('grab');
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const sol = solveTacticalPositions(activeScenario.id, puckPosRef.current, effectiveRole);
    if (subMode === 'TABLE') {
      soundEngine.playSkateCarve(sol.roleCue);
      return;
    }
    if (quizResult) return;
    const errDist = distanceIce(userDragPosRef.current, trueHomeRef.current);
    if (errDist <= 14) {
      setQuizResult('GOLD');
      setQuizStatus(`🥇 GOLD SPATIAL LOCK (${Math.round(errDist)}ft) — ${sol.roleCue}`);
      soundEngine.playGoalHorn(`Gold Spatial Lock! ${sol.roleCue}`);
      onScoreOffPuck(activeScenario.pillar, 'GOLD');
    } else if (errDist <= 24) {
      setQuizResult('SILVER');
      setQuizStatus(`🥈 SILVER POSITION (${Math.round(errDist)}ft) — ${sol.roleCue}`);
      soundEngine.playPostPing(`Silver Support! ${sol.roleCue}`);
      onScoreOffPuck(activeScenario.pillar, 'SILVER');
    } else {
      setQuizResult('TURNOVER');
      setQuizStatus(`⏪ OUT OF STRUCTURE — ${sol.roleCue}`);
      setTelestrator({
        from: { ...userDragPosRef.current },
        to: { ...trueHomeRef.current },
        headline: sol.roleCue,
        kind: 'REWIND',
      });
      soundEngine.playShinBlock(sol.roleCue);
      onScoreOffPuck(activeScenario.pillar, 'TURNOVER');
    }
  };

  return (
    <div className="mode-stage">
      <div className="mode-hud-bar wrap-bar">
        <div className="segmented-toggle" role="tablist" aria-label="Position Lab Sub-Modes">
          <button
            type="button"
            className={`touch-btn ${subMode === 'TABLE' ? 'active-pill' : ''}`}
            onClick={() => setSubMode('TABLE')}
            data-testid="poslab-submode-table"
          >
            🧲 Tactical Table (Drag Puck)
          </button>
          <button
            type="button"
            className={`touch-btn ${subMode === 'QUIZ' ? 'active-pill' : ''}`}
            onClick={() => setSubMode('QUIZ')}
            data-testid="poslab-submode-quiz"
          >
            📍 Where Do I Belong?
          </button>
        </div>

        <div className="role-strip">
          {ROLES_LIST.map((r) => (
            <button
              key={r}
              type="button"
              className={`touch-btn role-chip ${role === r ? 'active-pill' : ''}`}
              onClick={() => onSelectRole(r)}
              data-testid={`poslab-role-${r}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {subMode === 'TABLE' ? (
        <div className="scenario-filter-strip">
          {TACTICAL_SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              type="button"
              className={`touch-btn filter-chip ${scenarioId === sc.id ? 'active-pill' : ''}`}
              onClick={() => setScenarioId(sc.id)}
              data-testid={`poslab-scenario-${sc.id}`}
            >
              {sc.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="scenario-filter-strip quiz-banner-strip">
          <span className="hud-title-text" data-testid="poslab-quiz-status">
            {quizStatus}
          </span>
          <button
            type="button"
            className="touch-btn secondary-btn"
            onClick={() => setQuizIdx((i) => i + 1)}
            data-testid="poslab-next-quiz"
          >
            Next Off-Puck Rep ▶
          </button>
        </div>
      )}

      <div className="canvas-arena-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="rink-canvas"
          style={{ cursor: cursorStyle }}
          data-testid="poslab-canvas"
          data-submode={subMode}
          data-puck-x={hudProbe.px}
          data-puck-y={hudProbe.py}
          data-c-ice-x={hudProbe.cIceX}
          data-you-x={hudProbe.youX}
          data-you-y={hudProbe.youY}
          data-home-x={hudProbe.homeX}
          data-home-y={hudProbe.homeY}
          onPointerDown={(e) => {
            draggingRef.current = true;
            setCursorStyle('grabbing');
            canvasRef.current?.setPointerCapture(e.pointerId);
            updateDragSpot(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) updateDragSpot(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => endDrag(e.pointerId)}
          onPointerCancel={(e) => {
            if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
              canvasRef.current.releasePointerCapture(e.pointerId);
            }
            draggingRef.current = false;
            setCursorStyle('grab');
          }}
        />
      </div>
    </div>
  );
};
