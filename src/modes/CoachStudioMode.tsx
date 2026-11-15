import React, { useEffect, useRef, useState } from 'react';
import { renderRinkScene } from '../engine/RinkRenderer';
import {
  ViewportTransform,
  createViewport,
  distanceIce,
  screenToIce,
} from '../engine/RinkViewport';
import { soundEngine } from '../engine/SoundAndHaptics';
import { useArenaCanvasSize } from '../engine/useArenaCanvas';
import {
  FederationProfile,
  IceZone,
  PlayBlueprint,
  RinkOrientation,
  SkaterBlueprint,
  SkaterEntity,
  SkaterRole,
  Vec2,
} from '../types/hockey';
import { CoachStudioToolbar, StudioTool } from './CoachStudioToolbar';
import {
  INITIAL_STUDIO_SKATERS,
  compileStudioBlueprint,
  downloadTeamPlayPack,
} from './studioPackUtils';

interface CoachStudioModeProps {
  orientation: RinkOrientation;
  federation: FederationProfile;
  onChangeFederation: (f: FederationProfile) => void;
  customPlays: PlayBlueprint[];
  onLaunchCustomPlay: (play: PlayBlueprint, targetMode: 'LIVE_READ' | 'POSITION_LAB') => void;
  onImportPlayPack: (plays: PlayBlueprint[]) => void;
}

export const CoachStudioMode: React.FC<CoachStudioModeProps> = ({
  orientation,
  federation,
  onChangeFederation,
  customPlays,
  onLaunchCustomPlay,
  onImportPlayPack,
}) => {
  const [zone, setZone] = useState<IceZone>('HALF_3V3');
  const [tool, setTool] = useState<StudioTool>('SKATE_PATH');
  const [cursorStyle, setCursorStyle] = useState<'crosshair' | 'grab' | 'grabbing' | 'pointer'>('crosshair');
  const [playTitle, setPlayTitle] = useState('Coach 3v3 Give & Go');
  const [voiceCaption, setVoiceCaption] = useState('Draw D1 wide, then snap backdoor LW!');
  const [skaters, setSkaters] = useState<SkaterBlueprint[]>(INITIAL_STUDIO_SKATERS);
  const [carrierId, setCarrierId] = useState<string>('C');
  const [goldSpot, setGoldSpot] = useState<Vec2>({ x: 68, y: 30 });
  const [silverSpot, setSilverSpot] = useState<Vec2>({ x: 48, y: 66 });
  const [recording, setRecording] = useState(false);
  const [audioDataUrl, setAudioDataUrl] = useState<string | undefined>(undefined);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useArenaCanvasSize(wrapRef, canvasRef);
  const vpRef = useRef<ViewportTransform | null>(null);
  const activeSkaterIdRef = useRef<string | null>(null);
  const strokeRef = useRef<Vec2[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    setCursorStyle(tool === 'MOVE' ? 'grab' : tool === 'SKATE_PATH' ? 'crosshair' : 'pointer');
  }, [tool]);

  useEffect(() => {
    let rafId = 0;
    const renderLoop = (now: number) => {
      const canvas = canvasRef.current;
      const { width: cw, height: ch, dpr } = sizeRef.current;
      if (canvas && cw > 0 && ch > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const vp = createViewport(cw, ch, zone, orientation, federation);
          vpRef.current = vp;

          const entities: SkaterEntity[] = skaters.map((s) => {
            const ang = Math.atan2(s.rollInTo.y - s.start.y, s.rollInTo.x - s.start.x) || -1.57;
            return {
              id: s.id,
              label: s.label,
              role: s.role,
              team: s.team,
              pos: s.start,
              vel: { x: 0, y: 0 },
              bodyAngle: ang,
              hipAngle: s.hipCommitAngle ?? ang,
              stickAngle: s.stickLaneAngle ?? ang + 0.25,
              stickReach: s.team === 'AWAY' ? 8 : 6.8,
              isUser: s.id === carrierId,
            };
          });

          const carrier = skaters.find((s) => s.id === carrierId) ?? skaters[0];
          const drawnPaths = skaters
            .filter((s) => (s.path && s.path.length > 1) || distanceIce(s.start, s.rollInTo) > 2)
            .map((s) => ({
              points: s.path && s.path.length > 1 ? s.path : [s.start, s.rollInTo],
              color: s.team === 'HOME' ? '#0284c7' : '#e11d48',
              dashed: false,
            }));

          renderRinkScene(ctx, vp, {
            skaters: entities,
            puck: {
              pos: { x: carrier.start.x + 3, y: carrier.start.y - 2 },
              vel: { x: 0, y: 0 },
              z: 0,
              vz: 0,
              ownerId: carrier.id,
              flightType: 'CARRY',
              trail: [],
            },
            drawnPaths,
            supportLines: [
              { a: carrier.rollInTo, b: goldSpot, color: '#10b981', dashed: true },
              { a: carrier.rollInTo, b: silverSpot, color: '#f59e0b', dashed: true },
            ],
            highlightZones: [
              { center: goldSpot, radius: 5.5, color: 'rgba(16, 185, 129, 0.35)', label: 'GOLD' },
              { center: silverSpot, radius: 5.2, color: 'rgba(245, 158, 11, 0.3)', label: 'SILV' },
            ],
            nowMs: now,
          });
        }
      }
      rafId = requestAnimationFrame(renderLoop);
    };
    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [zone, orientation, federation, skaters, carrierId, goldSpot, silverSpot, sizeRef]);

  const addOrFocusRole = (role: SkaterRole, team: 'HOME' | 'AWAY') => {
    const existing = skaters.find((s) => s.id === role);
    if (existing) {
      if (team === 'HOME') setCarrierId(existing.id);
      soundEngine.emitCaption(`Selected ${role} on ice`, 'cue', 'STUDIO');
      return;
    }
    const baseSpot = team === 'HOME' ? { x: 50, y: 60 } : { x: 50, y: 36 };
    setSkaters((prev) => [
      ...prev,
      { id: role, label: role, role, team, start: baseSpot, rollInTo: { x: baseSpot.x, y: baseSpot.y - 8 } },
    ]);
    soundEngine.playSkateCarve(`Placed ${role} onto ${zone}`);
  };

  const toggleVoiceRecording = async () => {
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      setRecording(false);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      soundEngine.emitCaption(`Voice Caption Paired: "${voiceCaption}"`, 'voice', 'CAPTION PAIRED');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') setAudioDataUrl(reader.result);
        };
        reader.readAsDataURL(new Blob(chunks, { type: 'audio/webm' }));
        soundEngine.emitCaption('10s Coach Voice + Caption saved!', 'voice', 'VOICE SAVED');
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setTimeout(() => {
        if (rec.state === 'recording') {
          rec.stop();
          setRecording(false);
        }
      }, 10000);
    } catch {
      soundEngine.emitCaption('Mic unavailable — Text Caption paired cleanly!', 'voice', 'CAPTION READY');
    }
  };

  const makeBlueprint = () =>
    compileStudioBlueprint({
      playTitle,
      zone,
      federation,
      carrierId,
      skaters,
      goldSpot,
      silverSpot,
      voiceCaption,
      audioDataUrl,
    });

  const endStroke = (pointerId?: number) => {
    if (pointerId !== undefined && canvasRef.current?.hasPointerCapture(pointerId)) {
      canvasRef.current.releasePointerCapture(pointerId);
    }
    activeSkaterIdRef.current = null;
    strokeRef.current = [];
    setCursorStyle(tool === 'MOVE' ? 'grab' : tool === 'SKATE_PATH' ? 'crosshair' : 'pointer');
  };

  return (
    <div className="mode-stage">
      <CoachStudioToolbar
        zone={zone}
        onSetZone={setZone}
        federation={federation}
        onChangeFederation={onChangeFederation}
        tool={tool}
        onSetTool={setTool}
        playTitle={playTitle}
        onSetPlayTitle={setPlayTitle}
        voiceCaption={voiceCaption}
        onSetVoiceCaption={setVoiceCaption}
        recording={recording}
        onToggleVoice={toggleVoiceRecording}
        onAddRole={addOrFocusRole}
        onPlayLive={() => onLaunchCustomPlay(makeBlueprint(), 'LIVE_READ')}
        onExportPack={() => downloadTeamPlayPack(makeBlueprint(), customPlays, federation)}
        onImportPlays={onImportPlayPack}
      />

      <div className="canvas-arena-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="rink-canvas"
          style={{ cursor: cursorStyle }}
          data-testid="coach-studio-canvas"
          onPointerDown={(e) => {
            if (!vpRef.current || !canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const ice = screenToIce(vpRef.current, { x: e.clientX - rect.left, y: e.clientY - rect.top });
            canvasRef.current.setPointerCapture(e.pointerId);
            if (tool === 'GOLD_READ') {
              setGoldSpot(ice);
              soundEngine.playSnapPass('Updated Gold Read target');
              return;
            }
            if (tool === 'SILVER_READ') {
              setSilverSpot(ice);
              soundEngine.playSnapPass('Updated Silver Read target');
              return;
            }
            setCursorStyle('grabbing');
            const hit = skaters.find((s) => distanceIce(s.start, ice) <= 12) ?? skaters[0];
            activeSkaterIdRef.current = hit.id;
            strokeRef.current = [ice];
          }}
          onPointerMove={(e) => {
            const activeId = activeSkaterIdRef.current;
            if (!activeId || !vpRef.current || !canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const ice = screenToIce(vpRef.current, { x: e.clientX - rect.left, y: e.clientY - rect.top });
            strokeRef.current.push(ice);
            setSkaters((prev) =>
              prev.map((s) => {
                if (s.id !== activeId) return s;
                return tool === 'MOVE'
                  ? { ...s, start: ice, rollInTo: { x: ice.x, y: Math.max(8, ice.y - 10) }, path: undefined }
                  : { ...s, path: [...strokeRef.current], rollInTo: ice };
              })
            );
          }}
          onPointerUp={(e) => endStroke(e.pointerId)}
          onPointerCancel={(e) => endStroke(e.pointerId)}
        />
      </div>
    </div>
  );
};
