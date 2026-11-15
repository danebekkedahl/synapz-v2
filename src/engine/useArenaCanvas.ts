import { RefObject, useEffect, useRef } from 'react';

export interface CanvasSizeSnapshot {
  width: number;
  height: number;
  dpr: number;
}

/**
 * Tracks container dimensions via ResizeObserver and caps DPR cleanly at 2.0x
 * so widescreen monitors & 3x/4x mobile screens maintain crisp, undistorted geometry.
 */
export function useArenaCanvasSize(
  wrapRef: RefObject<HTMLDivElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>
): RefObject<CanvasSizeSnapshot> {
  const sizeRef = useRef<CanvasSizeSnapshot>({ width: 0, height: 0, dpr: 1 });

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const syncDimensions = () => {
      const targetWrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!targetWrap || !canvas) return;
      const cw = Math.max(1, Math.floor(targetWrap.clientWidth));
      const ch = Math.max(1, Math.floor(targetWrap.clientHeight));
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

      const targetPixelW = Math.round(cw * dpr);
      const targetPixelH = Math.round(ch * dpr);
      if (canvas.width !== targetPixelW || canvas.height !== targetPixelH) {
        canvas.width = targetPixelW;
        canvas.height = targetPixelH;
      }
      sizeRef.current = { width: cw, height: ch, dpr };
    };

    syncDimensions();
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => syncDimensions())
        : null;
    ro?.observe(wrap);
    window.addEventListener('resize', syncDimensions);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', syncDimensions);
    };
  }, [wrapRef, canvasRef]);

  return sizeRef;
}
