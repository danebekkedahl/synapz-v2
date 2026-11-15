import { Vec2 } from '../types/hockey';
import {
  ViewportTransform,
  angleIceToScreen,
  iceToScreen,
} from './RinkViewport';

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const cr = Math.min(r, w * 0.45, h * 0.45);
  ctx.beginPath();
  ctx.moveTo(x + cr, y);
  ctx.arcTo(x + w, y, x + w, y + h, cr);
  ctx.arcTo(x + w, y + h, x, y + h, cr);
  ctx.arcTo(x, y + h, x, y, cr);
  ctx.arcTo(x, y, x + w, y, cr);
  ctx.closePath();
}

export function drawIceSheetAndMarkings(
  ctx: CanvasRenderingContext2D,
  vp: ViewportTransform
): void {
  const fullTL = iceToScreen(vp, { x: 0, y: 0 });
  const fullBR = iceToScreen(vp, { x: 100, y: 200 });
  const rx = Math.min(fullTL.x, fullBR.x);
  const ry = Math.min(fullTL.y, fullBR.y);
  const rw = Math.abs(fullBR.x - fullTL.x);
  const rh = Math.abs(fullBR.y - fullTL.y);
  const cornerR = 18 * Math.min(vp.scaleX, vp.scaleY);

  ctx.save();
  ctx.beginPath();
  ctx.rect(vp.originX, vp.originY, vp.drawWidth, vp.drawHeight);
  ctx.clip();

  drawRoundedRect(ctx, rx, ry, rw, rh, cornerR);
  const iceGrad = ctx.createRadialGradient(
    vp.originX + vp.drawWidth * 0.5,
    vp.originY + vp.drawHeight * 0.45,
    10,
    vp.originX + vp.drawWidth * 0.5,
    vp.originY + vp.drawHeight * 0.5,
    Math.max(vp.drawWidth, vp.drawHeight) * 0.72
  );
  iceGrad.addColorStop(0, '#f5fbff');
  iceGrad.addColorStop(0.65, '#e6f2fa');
  iceGrad.addColorStop(1, '#d3e5f2');
  ctx.fillStyle = iceGrad;
  ctx.fill();
  ctx.clip();

  const line = (a: Vec2, b: Vec2, color: string, widthUnits: number, dash?: number[]) => {
    const sa = iceToScreen(vp, a);
    const sb = iceToScreen(vp, b);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, widthUnits * vp.scaleY);
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
    ctx.restore();
  };

  line({ x: 0, y: 11 }, { x: 100, y: 11 }, 'rgba(214, 48, 65, 0.78)', 0.55);
  line({ x: 0, y: 189 }, { x: 100, y: 189 }, 'rgba(214, 48, 65, 0.78)', 0.55);
  line({ x: 0, y: 75 }, { x: 100, y: 75 }, 'rgba(28, 100, 212, 0.82)', 1.25);
  line({ x: 0, y: 125 }, { x: 100, y: 125 }, 'rgba(28, 100, 212, 0.82)', 1.25);
  line({ x: 0, y: 100 }, { x: 100, y: 100 }, 'rgba(214, 48, 65, 0.85)', 1.15, [8, 5]);

  if (vp.federation !== 'IIHF') {
    line({ x: 39, y: 11 }, { x: 34, y: 0 }, 'rgba(214, 48, 65, 0.45)', 0.4);
    line({ x: 61, y: 11 }, { x: 66, y: 0 }, 'rgba(214, 48, 65, 0.45)', 0.4);
    line({ x: 39, y: 189 }, { x: 34, y: 200 }, 'rgba(214, 48, 65, 0.45)', 0.4);
    line({ x: 61, y: 189 }, { x: 66, y: 200 }, 'rgba(214, 48, 65, 0.45)', 0.4);
  }

  const drawCircle = (c: Vec2, rUnits: number, color: string) => {
    const sc = iceToScreen(vp, c);
    ctx.beginPath();
    ctx.ellipse(
      sc.x,
      sc.y,
      rUnits * (vp.orientation === 'BROADCAST' ? vp.scaleY : vp.scaleX),
      rUnits * (vp.orientation === 'BROADCAST' ? vp.scaleX : vp.scaleY),
      0,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, 0.45 * vp.scaleY);
    ctx.stroke();
  };

  drawCircle({ x: 50, y: 100 }, 15, 'rgba(28, 100, 212, 0.7)');
  [
    { x: 24, y: 33 },
    { x: 76, y: 33 },
    { x: 24, y: 167 },
    { x: 76, y: 167 },
  ].forEach((pt) => drawCircle(pt, 14.5, 'rgba(214, 48, 65, 0.62)'));

  [
    { x: 50, y: 100, col: '#1c64d4' },
    { x: 24, y: 33, col: '#d63041' },
    { x: 76, y: 33, col: '#d63041' },
    { x: 24, y: 167, col: '#d63041' },
    { x: 76, y: 167, col: '#d63041' },
    { x: 24, y: 80, col: '#d63041' },
    { x: 76, y: 80, col: '#d63041' },
    { x: 24, y: 120, col: '#d63041' },
    { x: 76, y: 120, col: '#d63041' },
  ].forEach((d) => {
    const sd = iceToScreen(vp, d);
    ctx.beginPath();
    ctx.arc(sd.x, sd.y, Math.max(2.6, 1.1 * vp.scaleY), 0, Math.PI * 2);
    ctx.fillStyle = d.col;
    ctx.fill();
  });

  [
    { y: 11, dir: 1 },
    { y: 189, dir: -1 },
  ].forEach(({ y, dir }) => {
    const gc = iceToScreen(vp, { x: 50, y });
    const startA = angleIceToScreen(vp, dir > 0 ? 0 : Math.PI);
    const rCrease = 6 * vp.scaleY;
    ctx.beginPath();
    ctx.arc(gc.x, gc.y, rCrease, startA, startA + Math.PI);
    ctx.closePath();
    ctx.fillStyle = 'rgba(56, 165, 245, 0.42)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(214, 48, 65, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    const netA = iceToScreen(vp, { x: 46, y });
    const netB = iceToScreen(vp, { x: 54, y: y - dir * 3.6 });
    const nx = Math.min(netA.x, netB.x);
    const ny = Math.min(netA.y, netB.y);
    const nw = Math.max(4, Math.abs(netB.x - netA.x));
    const nh = Math.max(4, Math.abs(netB.y - netA.y));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fillRect(nx, ny, nw, nh);
    ctx.strokeStyle = '#c81e32';
    ctx.lineWidth = 2.2;
    ctx.strokeRect(nx, ny, nw, nh);
  });

  drawRoundedRect(ctx, rx, ry, rw, rh, cornerR);
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}
