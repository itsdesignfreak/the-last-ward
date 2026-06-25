import { useEffect, useRef } from 'react';
import {
  MAP_DITHERED_SRC, BURN_DURATION_MS, BURN_RIM_WIDTH, BURN_IRREGULAR,
} from '../constants';

interface Props {
  started: boolean;      // false = show dithered paper; true = play the burn
  onComplete: () => void;
}

/** Smooth value-noise field (coarse random grid, bilinear interpolated). */
function makeNoise(w: number, h: number): Float32Array {
  const GX = 28, GY = 22;                       // coarse grid resolution
  const grid = new Float32Array((GX + 1) * (GY + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = Math.random();
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const gy = (y / h) * GY, y0 = Math.floor(gy), fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = (x / w) * GX, x0 = Math.floor(gx), fx = gx - x0;
      const a = grid[y0 * (GX + 1) + x0],     b = grid[y0 * (GX + 1) + x0 + 1];
      const c = grid[(y0 + 1) * (GX + 1) + x0], d = grid[(y0 + 1) * (GX + 1) + x0 + 1];
      const top = a + (b - a) * fx, bot = c + (d - c) * fx;
      out[y * w + x] = top + (bot - top) * fy;
    }
  }
  return out;
}

export function BurnReveal({ started, onComplete }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const ditherRef   = useRef<ImageData | null>(null);   // source dithered pixels
  const burnOrderRef = useRef<Float32Array | null>(null); // 0 = burns first, 1 = last
  const frameRef    = useRef<ImageData | null>(null);   // reused output buffer
  const rafRef      = useRef<number>(0);
  const startedRef  = useRef(started);
  startedRef.current = started;

  // Load the dithered image, derive pixels + the burn-order field, draw frame 0.
  useEffect(() => {
    const img = new Image();
    img.src = MAP_DITHERED_SRC;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = img.naturalWidth, h = img.naturalHeight;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      ditherRef.current = ctx.getImageData(0, 0, w, h);
      frameRef.current  = ctx.createImageData(w, h);

      // Burn order = radial distance from centre, warped by smooth noise so the
      // edge tears irregularly. Normalised to ~0..1.
      const noise = makeNoise(w, h);
      const order = new Float32Array(w * h);
      const cx = w / 2, cy = h / 2;
      const maxR = Math.hypot(cx, cy);
      let mn = Infinity, mx = -Infinity;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const radial = Math.hypot(x - cx, y - cy) / maxR;          // 0 centre → 1 corner
          const v = radial + (noise[i] - 0.5) * 2 * BURN_IRREGULAR;
          order[i] = v;
          if (v < mn) mn = v; if (v > mx) mx = v;
        }
      }
      // Normalise to exactly 0..1 so the threshold sweep is well-defined and
      // nothing is pre-burned at the start.
      const inv = 1 / (mx - mn);
      for (let i = 0; i < order.length; i++) order[i] = (order[i] - mn) * inv;
      burnOrderRef.current = order;
      drawAt(-BURN_RIM_WIDTH); // show full dithered paper (nothing burned yet)
    };
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Render the burn at a given threshold T (0 = all paper, 1 = fully revealed). */
  const drawAt = (T: number) => {
    const canvas = canvasRef.current;
    const src = ditherRef.current, order = burnOrderRef.current, out = frameRef.current;
    if (!canvas || !src || !order || !out) return;
    const ctx = canvas.getContext('2d')!;
    const s = src.data, o = out.data;
    const rim = BURN_RIM_WIDTH;

    for (let i = 0, p = 0; i < order.length; i++, p += 4) {
      const d = order[i] - T;          // <0 already burned, >0 still paper
      if (d < -rim) {
        o[p + 3] = 0;                  // fully revealed (transparent)
      } else if (d < 0) {
        // charring band just inside the edge: paper fades to black ash, then out
        const t = (d + rim) / rim;     // 0 at fully gone → 1 at the hot edge
        o[p] = 20 * t; o[p + 1] = 8 * t; o[p + 2] = 0;
        o[p + 3] = (s[p + 3]) * t;
      } else if (d < rim) {
        // hot ember rim over the paper: white-hot at edge → orange outward
        const t = d / rim;             // 0 hottest → 1 cooling to paper
        o[p]     = 255;
        o[p + 1] = 210 - 150 * t;
        o[p + 2] = 130 - 130 * t;
        o[p + 3] = 255;
      } else {
        o[p] = s[p]; o[p + 1] = s[p + 1]; o[p + 2] = s[p + 2]; o[p + 3] = s[p + 3];
      }
    }
    ctx.putImageData(out, 0, 0);
  };

  // Run the burn when `started` flips true.
  useEffect(() => {
    if (!started || !burnOrderRef.current) return;
    const startMs = performance.now();
    const startT = -BURN_RIM_WIDTH, endT = 1 + BURN_RIM_WIDTH, span = endT - startT;
    const tick = (now: number) => {
      const T = startT + ((now - startMs) / BURN_DURATION_MS) * span;
      if (T >= endT) { drawAt(endT); onComplete(); return; }
      drawAt(T);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-30 h-full w-full"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
