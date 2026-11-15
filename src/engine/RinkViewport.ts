import { FederationProfile, IceZone, RinkOrientation, Vec2 } from '../types/hockey';

export interface ZoneCrop {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface ViewportTransform {
  canvasWidth: number;
  canvasHeight: number;
  zone: IceZone;
  orientation: RinkOrientation;
  federation: FederationProfile;
  crop: ZoneCrop;
  scaleX: number;
  scaleY: number;
  originX: number;
  originY: number;
  drawWidth: number;
  drawHeight: number;
}

export function getZoneCrop(zone: IceZone): ZoneCrop {
  switch (zone) {
    case 'O_ZONE':
      return { x0: 0, x1: 100, y0: 0, y1: 92 };
    case 'HALF_3V3':
      return { x0: 0, x1: 100, y0: 0, y1: 104 };
    case 'NEUTRAL_ZONE':
      return { x0: 0, x1: 100, y0: 46, y1: 154 };
    case 'D_ZONE':
      return { x0: 0, x1: 100, y0: 108, y1: 200 };
    case 'FULL_ICE':
    default:
      return { x0: 0, x1: 100, y0: 0, y1: 200 };
  }
}

export function createViewport(
  canvasWidth: number,
  canvasHeight: number,
  zone: IceZone,
  orientation: RinkOrientation,
  federation: FederationProfile = 'USA'
): ViewportTransform {
  const crop = getZoneCrop(zone);
  const pad = Math.max(10, Math.min(canvasWidth, canvasHeight) * 0.032);
  const availW = Math.max(80, canvasWidth - pad * 2);
  const availH = Math.max(80, canvasHeight - pad * 2);

  // IIHF rinks (30m x 60m) are 15% wider relative to length than NHL/North American (85ft x 200ft)
  const widthAspectFactor = federation === 'IIHF' ? 1.0 : 0.88;
  const logicalIceW = (crop.x1 - crop.x0) * widthAspectFactor;
  const logicalIceH = crop.y1 - crop.y0;

  const targetW = orientation === 'BROADCAST' ? logicalIceH : logicalIceW;
  const targetH = orientation === 'BROADCAST' ? logicalIceW : logicalIceH;

  const fitScale = Math.min(availW / targetW, availH / targetH);
  const drawWidth = targetW * fitScale;
  const drawHeight = targetH * fitScale;
  const originX = (canvasWidth - drawWidth) * 0.5;
  const originY = (canvasHeight - drawHeight) * 0.5;

  const scaleIceX = fitScale * widthAspectFactor;
  const scaleIceY = fitScale;

  return {
    canvasWidth,
    canvasHeight,
    zone,
    orientation,
    federation,
    crop,
    scaleX: scaleIceX,
    scaleY: scaleIceY,
    originX,
    originY,
    drawWidth,
    drawHeight,
  };
}

export function iceToScreen(vp: ViewportTransform, p: Vec2): Vec2 {
  if (vp.orientation === 'BROADCAST') {
    return {
      x: vp.originX + (vp.crop.y1 - p.y) * vp.scaleY,
      y: vp.originY + (p.x - vp.crop.x0) * vp.scaleX,
    };
  }
  return {
    x: vp.originX + (p.x - vp.crop.x0) * vp.scaleX,
    y: vp.originY + (p.y - vp.crop.y0) * vp.scaleY,
  };
}

export function screenToIce(vp: ViewportTransform, s: Vec2): Vec2 {
  let rawX: number;
  let rawY: number;
  if (vp.orientation === 'BROADCAST') {
    rawY = vp.crop.y1 - (s.x - vp.originX) / vp.scaleY;
    rawX = vp.crop.x0 + (s.y - vp.originY) / vp.scaleX;
  } else {
    rawX = vp.crop.x0 + (s.x - vp.originX) / vp.scaleX;
    rawY = vp.crop.y0 + (s.y - vp.originY) / vp.scaleY;
  }
  return {
    x: Math.max(2, Math.min(98, rawX)),
    y: Math.max(2, Math.min(198, rawY)),
  };
}

export function angleIceToScreen(vp: ViewportTransform, angleRad: number): number {
  return vp.orientation === 'BROADCAST' ? angleRad + Math.PI * 0.5 : angleRad;
}

export function distanceIce(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
