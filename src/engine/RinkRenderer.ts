import {
  PuckState,
  SkateParticle,
  SkaterEntity,
  TelestratorCue,
  Vec2,
} from '../types/hockey';
import { drawIceSheetAndMarkings } from './IceMarkingsDrawer';
import {
  ViewportTransform,
  angleIceToScreen,
  iceToScreen,
} from './RinkViewport';

export interface RenderSceneOptions {
  skaters: SkaterEntity[];
  puck: PuckState;
  particles?: SkateParticle[];
  showAssistRings?: boolean;
  bulletTimeTint?: number;
  telestrator?: TelestratorCue | null;
  supportLines?: Array<{ a: Vec2; b: Vec2; color: string; dashed?: boolean }>;
  highlightZones?: Array<{ center: Vec2; radius: number; color: string; label?: string }>;
  drawnPaths?: Array<{ points: Vec2[]; color: string; dashed?: boolean }>;
  fogAround?: { center: Vec2; clearRadius: number; alpha: number } | null;
  nowMs?: number;
}

export function renderRinkScene(
  ctx: CanvasRenderingContext2D,
  vp: ViewportTransform,
  opts: RenderSceneOptions
): void {
  const pulse = 0.5 + 0.5 * Math.sin((opts.nowMs ?? performance.now()) * 0.007);
  ctx.clearRect(0, 0, vp.canvasWidth, vp.canvasHeight);
  ctx.fillStyle = '#070d17';
  ctx.fillRect(0, 0, vp.canvasWidth, vp.canvasHeight);

  drawIceSheetAndMarkings(ctx, vp);

  opts.highlightZones?.forEach((hz) => {
    const sc = iceToScreen(vp, hz.center);
    const r = hz.radius * vp.scaleY;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, r, 0, Math.PI * 2);
    ctx.fillStyle = hz.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.8;
    ctx.stroke();
    if (hz.label) {
      ctx.fillStyle = '#0b172a';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hz.label, sc.x, sc.y + 4);
    }
    ctx.restore();
  });

  opts.supportLines?.forEach((sl) => {
    const a = iceToScreen(vp, sl.a);
    const b = iceToScreen(vp, sl.b);
    ctx.save();
    ctx.strokeStyle = sl.color;
    ctx.lineWidth = 2.6;
    if (sl.dashed) ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  });

  opts.drawnPaths?.forEach((dp) => {
    if (dp.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = dp.color;
    ctx.lineWidth = 3;
    if (dp.dashed) ctx.setLineDash([6, 5]);
    ctx.beginPath();
    dp.points.forEach((pt, idx) => {
      const s = iceToScreen(vp, pt);
      if (idx === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
    ctx.restore();
  });

  opts.particles?.forEach((pt) => {
    const sp = iceToScreen(vp, pt);
    const alpha = Math.max(0, pt.life / pt.maxLife) * 0.75;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, Math.max(1.5, 0.7 * vp.scaleY), 0, Math.PI * 2);
    ctx.fill();
  });

  const skRadius = Math.max(11, 3.25 * vp.scaleY);
  opts.skaters.forEach((sk) => {
    const sp = iceToScreen(vp, sk.pos);
    const bodyA = angleIceToScreen(vp, sk.bodyAngle);
    const hipA = angleIceToScreen(vp, sk.hipAngle);
    const stickA = angleIceToScreen(vp, sk.stickAngle);

    if (opts.showAssistRings && sk.assistTier && sk.assistTier !== 'NONE') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, skRadius * (1.65 + pulse * 0.2), 0, Math.PI * 2);
      ctx.strokeStyle =
        sk.assistTier === 'GOLD' ? 'rgba(16, 185, 129, 0.85)' : 'rgba(245, 158, 11, 0.8)';
      ctx.lineWidth = 2.8;
      ctx.stroke();
      ctx.restore();
    }

    if (sk.isUser) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, skRadius * (1.48 + pulse * 0.14), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.restore();
    }

    if (sk.team === 'AWAY') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, skRadius * 1.32, hipA - 0.55, hipA + 0.55);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.82)';
      ctx.lineWidth = 3.2;
      ctx.stroke();
      ctx.restore();
    }

    const stickLen = sk.stickReach * vp.scaleY;
    const tipX = sp.x + Math.cos(stickA) * stickLen;
    const tipY = sp.y + Math.sin(stickA) * stickLen;
    const bladePerp = stickA + (sk.team === 'HOME' ? 0.52 : -0.52);
    ctx.save();
    ctx.strokeStyle = sk.team === 'HOME' ? '#0f172a' : '#7f1d1d';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(
      sp.x + Math.cos(bodyA + 1.2) * (skRadius * 0.6),
      sp.y + Math.sin(bodyA + 1.2) * (skRadius * 0.6)
    );
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(
      tipX + Math.cos(bladePerp) * (skRadius * 0.55),
      tipY + Math.sin(bladePerp) * (skRadius * 0.55)
    );
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(bodyA);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
    ctx.beginPath();
    ctx.ellipse(2, 3, skRadius * 0.85, skRadius * 1.18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = sk.team === 'HOME' ? '#0284c7' : '#e11d48';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, skRadius * 0.78, skRadius * 1.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.max(10, Math.round(skRadius * 0.76))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sk.label, sp.x, sp.y + 0.5);
  });

  const puckScreen = iceToScreen(vp, opts.puck.pos);
  if (opts.puck.trail.length > 1) {
    ctx.save();
    ctx.strokeStyle =
      opts.puck.flightType === 'SAUCER'
        ? 'rgba(14, 165, 233, 0.65)'
        : 'rgba(15, 23, 42, 0.35)';
    ctx.lineWidth = opts.puck.flightType === 'SAUCER' ? 3 : 2.2;
    if (opts.puck.flightType === 'SAUCER') ctx.setLineDash([5, 4]);
    ctx.beginPath();
    opts.puck.trail.forEach((t, idx) => {
      const ts = iceToScreen(vp, t);
      if (idx === 0) ctx.moveTo(ts.x, ts.y - t.z * 5);
      else ctx.lineTo(ts.x, ts.y - t.z * 5);
    });
    ctx.stroke();
    ctx.restore();
  }

  const puckR = Math.max(4.8, 1.45 * vp.scaleY);
  const elevPx = opts.puck.z * 5.5;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.beginPath();
  ctx.arc(puckScreen.x + elevPx * 0.35, puckScreen.y + 2, puckR * 0.95, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = opts.puck.z > 0.3 ? '#38bdf8' : '#f8fafc';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(
    puckScreen.x,
    puckScreen.y - elevPx,
    puckR * (1 + opts.puck.z * 0.16),
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.stroke();

  if (opts.fogAround && opts.fogAround.alpha > 0.01) {
    const fc = iceToScreen(vp, opts.fogAround.center);
    const clearR = opts.fogAround.clearRadius * vp.scaleY;
    const fogGrad = ctx.createRadialGradient(fc.x, fc.y, clearR * 0.75, fc.x, fc.y, clearR * 2.4);
    fogGrad.addColorStop(0, 'rgba(7, 13, 23, 0)');
    fogGrad.addColorStop(0.55, `rgba(7, 13, 23, ${(opts.fogAround.alpha * 0.82).toFixed(2)})`);
    fogGrad.addColorStop(1, `rgba(7, 13, 23, ${(opts.fogAround.alpha * 0.96).toFixed(2)})`);
    ctx.fillStyle = fogGrad;
    ctx.fillRect(vp.originX, vp.originY, vp.drawWidth, vp.drawHeight);
  }

  if (opts.telestrator) {
    const tf = iceToScreen(vp, opts.telestrator.from);
    const tt = iceToScreen(vp, opts.telestrator.to);
    if (opts.telestrator.threatPos) {
      const th = iceToScreen(vp, opts.telestrator.threatPos);
      ctx.save();
      ctx.beginPath();
      ctx.arc(th.x, th.y, skRadius * (1.7 + pulse * 0.3), 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = opts.telestrator.kind === 'REWIND' ? '#fbbf24' : '#10b981';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(tf.x, tf.y);
    if (opts.telestrator.curvedVia) {
      const tv = iceToScreen(vp, opts.telestrator.curvedVia);
      ctx.quadraticCurveTo(tv.x, tv.y, tt.x, tt.y);
    } else {
      ctx.lineTo(tt.x, tt.y);
    }
    ctx.stroke();
    const ang = Math.atan2(tt.y - tf.y, tt.x - tf.x);
    ctx.beginPath();
    ctx.moveTo(tt.x, tt.y);
    ctx.lineTo(tt.x - Math.cos(ang - 0.45) * 14, tt.y - Math.sin(ang - 0.45) * 14);
    ctx.lineTo(tt.x - Math.cos(ang + 0.45) * 14, tt.y - Math.sin(ang + 0.45) * 14);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.restore();
  }

  if (opts.bulletTimeTint && opts.bulletTimeTint > 0.02) {
    ctx.save();
    ctx.strokeStyle = `rgba(56, 189, 248, ${(opts.bulletTimeTint * 0.7).toFixed(2)})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(vp.originX + 2, vp.originY + 2, vp.drawWidth - 4, vp.drawHeight - 4);
    ctx.restore();
  }
}
