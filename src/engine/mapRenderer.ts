import type { Direction, LevelData, Tower, TowerType, Waypoint } from '../types';
import {
  TILE_W, TILE_H, CANVAS_WIDTH, CANVAS_HEIGHT,
  GRID_COLS, GRID_ROWS, GRID_PERSPECTIVE_MAX_DEG,
  GRID_ROTATE_X_DEG, GRID_PERSP_D,
  TILE_GAP, TILE_RADIUS,
} from '../constants';

// ── Per-column perspective ────────────────────────────────────────────────────
// Each column c has a unique skewX angle that scales linearly from the centre:
//   angle(c) = (c − CENTER) / CENTER × MAX_DEG
// Centre column → 0°, left edge → −MAX°, right edge → +MAX°.

const CENTER_COL = GRID_COLS / 2;
const MAX_RAD    = GRID_PERSPECTIVE_MAX_DEG * Math.PI / 180;

// ── rotateX projection constants ─────────────────────────────────────────────
const ROT_RAD   = GRID_ROTATE_X_DEG * Math.PI / 180;
const SIN_ROT   = Math.sin(ROT_RAD);
const COS_ROT   = Math.cos(ROT_RAD);
const OX        = CANVAS_WIDTH  / 2;  // transform origin X
const OY        = CANVAS_HEIGHT / 2;  // transform origin Y

/** Per-column skewX: vertical lines fan outward from centre column. */
export function perspTanAt(c: number): number {
  return Math.tan((c - CENTER_COL) / CENTER_COL * MAX_RAD);
}

/**
 * Apply rotateX perspective projection to a canvas point (x, y).
 * Top recedes, bottom comes toward viewer.
 *   scale   = D / (D − y_rel × sin θ)
 *   screen  = (ox + x_rel × scale,  oy + y_rel × cos θ × scale)
 */
function applyRotX(x: number, y: number): [number, number] {
  const xr    = x - OX;
  const yr    = y - OY;
  const scale = GRID_PERSP_D / (GRID_PERSP_D - yr * SIN_ROT);
  return [OX + xr * scale, OY + yr * COS_ROT * scale];
}

/**
 * Inverse of applyRotX — maps a screen point back to canvas space.
 *   y_rel = sy_rel × D / (cos θ × D + sin θ × sy_rel)
 */
function invertRotX(sx: number, sy: number): [number, number] {
  const sxr   = sx - OX;
  const syr   = sy - OY;
  const yr    = syr * GRID_PERSP_D / (COS_ROT * GRID_PERSP_D + SIN_ROT * syr);
  const scale = GRID_PERSP_D / (GRID_PERSP_D - yr * SIN_ROT);
  return [OX + sxr / scale, OY + yr];
}

/** Screen position of grid-corner (c, r): skewX fan → rotateX projection. */
function perspCorner(c: number, r: number): [number, number] {
  const y = r * TILE_H;
  const x = c * TILE_W + y * perspTanAt(c);
  return applyRotX(x, y);
}

/** Screen centre of tile (col, row). */
function perspCenter(col: number, row: number): [number, number] {
  const cy = (row + 0.5) * TILE_H;
  const cx = (col + 0.5) * TILE_W + cy * perspTanAt(col + 0.5);
  return applyRotX(cx, cy);
}

/**
 * Compute the 4 screen corners of a tile with TILE_GAP inset applied.
 * Each edge is shrunk inward by TILE_GAP/2 px in canvas space before
 * the rotateX projection, so adjacent tiles have a visible gap between them.
 */
function tileScreenCorners(
  col: number, row: number,
): [[number,number],[number,number],[number,number],[number,number]] {
  const g  = TILE_GAP / 2;
  const x0 = col       * TILE_W + g;
  const x1 = (col + 1) * TILE_W - g;
  const y0 = row       * TILE_H + g;
  const y1 = (row + 1) * TILE_H - g;
  return [
    applyRotX(x0 + y0 * perspTanAt(col),       y0),  // TL
    applyRotX(x1 + y0 * perspTanAt(col + 1),   y0),  // TR
    applyRotX(x1 + y1 * perspTanAt(col + 1),   y1),  // BR
    applyRotX(x0 + y1 * perspTanAt(col),       y1),  // BL
  ];
}

/**
 * Trace a rounded quadrilateral path (no beginPath / fill / stroke — caller decides).
 * Each corner is rounded using a quadratic Bézier curve with the given radius.
 */
function traceRoundedQuad(
  ctx: CanvasRenderingContext2D,
  [tlX, tlY]: [number, number],
  [trX, trY]: [number, number],
  [brX, brY]: [number, number],
  [blX, blY]: [number, number],
  radius: number,
) {
  const lerp = (ax: number, ay: number, bx: number, by: number, t: number): [number, number] =>
    [ax + (bx - ax) * t, ay + (by - ay) * t];
  const len = (ax: number, ay: number, bx: number, by: number) =>
    Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);

  const tTop    = radius / len(tlX, tlY, trX, trY);
  const tRight  = radius / len(trX, trY, brX, brY);
  const tBottom = radius / len(brX, brY, blX, blY);
  const tLeft   = radius / len(blX, blY, tlX, tlY);

  const [a0x, a0y] = lerp(tlX, tlY, trX, trY, tTop);      // TL → along top
  const [a1x, a1y] = lerp(trX, trY, tlX, tlY, tTop);      // TR → along top
  const [b0x, b0y] = lerp(trX, trY, brX, brY, tRight);    // TR → along right
  const [b1x, b1y] = lerp(brX, brY, trX, trY, tRight);    // BR → along right
  const [c0x, c0y] = lerp(brX, brY, blX, blY, tBottom);   // BR → along bottom
  const [c1x, c1y] = lerp(blX, blY, brX, brY, tBottom);   // BL → along bottom
  const [d0x, d0y] = lerp(blX, blY, tlX, tlY, tLeft);     // BL → along left
  const [d1x, d1y] = lerp(tlX, tlY, blX, blY, tLeft);     // TL → along left

  ctx.moveTo(a0x, a0y);
  ctx.lineTo(a1x, a1y);
  ctx.quadraticCurveTo(trX, trY, b0x, b0y);
  ctx.lineTo(b1x, b1y);
  ctx.quadraticCurveTo(brX, brY, c0x, c0y);
  ctx.lineTo(c1x, c1y);
  ctx.quadraticCurveTo(blX, blY, d0x, d0y);
  ctx.lineTo(d1x, d1y);
  ctx.quadraticCurveTo(tlX, tlY, a0x, a0y);
  ctx.closePath();
}

/** Trace a single tile as a rounded, gap-inset quad (call fill/stroke after). */
function traceTileQuad(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const [tl, tr, br, bl] = tileScreenCorners(col, row);
  ctx.beginPath();
  traceRoundedQuad(ctx, tl, tr, br, bl, TILE_RADIUS);
}

// ── Public hit-test helper ────────────────────────────────────────────────────

/**
 * Map screen point (sx, sy) back to grid (col, row).
 * 1. Invert rotateX → canvas space (x, y)
 * 2. Row from y / TILE_H (y is unaffected by skewX)
 * 3. Column by scanning skewX boundaries at that y
 */
export function perspHitTest(sx: number, sy: number): { col: number; row: number } | null {
  const [x, y] = invertRotX(sx, sy);
  const row = Math.floor(y / TILE_H);
  if (row < 0 || row >= GRID_ROWS) return null;
  for (let c = 0; c < GRID_COLS; c++) {
    const xLeft  = c       * TILE_W + y * perspTanAt(c);
    const xRight = (c + 1) * TILE_W + y * perspTanAt(c + 1);
    if (x >= xLeft && x < xRight) return { col: c, row };
  }
  return null;
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

const ARROW_COLOR  = 'rgba(255,255,255,0.55)';
const HOVER_FILL   = 'rgba(180,230,120,0.35)';
const HOVER_STROKE = 'rgba(200,255,140,0.90)';
const GRID_LINE    = 'rgba(255,255,255,0.10)';

function buildFlowMap(waypoints: Waypoint[]): Map<string, Direction> {
  const map = new Map<string, Direction>();
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    let dir: Direction;
    if (b.col > a.col)      dir = 'east';
    else if (b.col < a.col) dir = 'west';
    else if (b.row > a.row) dir = 'south';
    else                    dir = 'north';
    if (a.col === b.col) {
      for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++)
        map.set(`${a.col},${r}`, dir);
    } else {
      for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++)
        map.set(`${c},${a.row}`, dir);
    }
  }
  return map;
}

function drawGridLines(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth   = 1;
  ctx.beginPath();

  // Draw each tile as a separate rounded card outline
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const [tl, tr, br, bl] = tileScreenCorners(col, row);
      traceRoundedQuad(ctx, tl, tr, br, bl, TILE_RADIUS);
    }
  }

  ctx.stroke();
}

function drawArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: Direction) {
  const half = Math.min(TILE_W, TILE_H) * 0.18;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(
    dir === 'east'  ? 0 :
    dir === 'south' ? Math.PI / 2 :
    dir === 'west'  ? Math.PI :
                     -Math.PI / 2
  );
  ctx.fillStyle = ARROW_COLOR;
  ctx.beginPath();
  ctx.moveTo( half,        0);
  ctx.lineTo(-half * 0.6, -half * 0.7);
  ctx.lineTo(-half * 0.6,  half * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, cx: number, cy: number, text: string) {
  const pad = 6;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + pad * 2;
  const h = 18;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 4);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(text, cx, cy);
}

function drawTowerPlaceholder(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  type: TowerType,
) {
  // Dark background fills the perspective quad
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  traceTileQuad(ctx, col, row);
  ctx.fill();

  // Icon circle at tile centre
  const [cx, cy] = perspCenter(col, row);
  ctx.fillStyle = type === 'arrow' ? '#60a5fa' : '#f97316';
  ctx.beginPath();
  ctx.arc(cx, cy - 5, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(type === 'arrow' ? 'A' : 'C', cx, cy - 5);

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '8px monospace';
  ctx.fillText(type === 'arrow' ? 'ARROW' : 'CANNON', cx, cy + 10);
}

// ── Public render entry-point ─────────────────────────────────────────────────

export interface HoveredTile { col: number; row: number }

export function renderMap(
  ctx: CanvasRenderingContext2D,
  level: LevelData,
  bgImage: HTMLImageElement | null,
  hoveredTile: HoveredTile | null = null,
  towers: Tower[] = [],
) {
  const { grid, waypoints } = level;
  const flowMap = buildFlowMap(waypoints);

  // ── Layer 1: background image ─────────────────────────────────────────────
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#2a2016';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AWAITING ASSET: map-bg.png', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  }

  // ── Layer 2: perspective grid lines ──────────────────────────────────────
  drawGridLines(ctx);

  // ── Layer 3: hover highlight (grass tiles only) ───────────────────────────
  if (hoveredTile) {
    const { col, row } = hoveredTile;
    if (grid[row]?.[col] === 'grass') {
      ctx.fillStyle = HOVER_FILL;
      traceTileQuad(ctx, col, row);
      ctx.fill();

      ctx.strokeStyle = HOVER_STROKE;
      ctx.lineWidth = 2;
      traceTileQuad(ctx, col, row);
      ctx.stroke();
    }
  }

  // ── Layer 4: path direction arrows ────────────────────────────────────────
  for (const [key, dir] of flowMap) {
    const [c, r] = key.split(',').map(Number);
    const [cx, cy] = perspCenter(c, r);
    drawArrow(ctx, cx, cy, dir);
  }

  // ── Layer 5: entrance / base labels ──────────────────────────────────────
  const entry = waypoints[0];
  const base  = waypoints[waypoints.length - 1];
  const [eCx, eCy] = perspCenter(entry.col, entry.row);
  const [bCx, bCy] = perspCenter(base.col,  base.row);
  drawLabel(ctx, eCx, eCy, 'ENTRANCE');
  drawLabel(ctx, bCx, bCy, 'BASE');

  // ── Layer 6: placed towers ────────────────────────────────────────────────
  for (const tower of towers) {
    drawTowerPlaceholder(ctx, tower.col, tower.row, tower.type);
  }
}
