import type { Biome } from '../data/zones';

export const T_GRASS = 0;
export const T_PATH = 1;
export const T_WATER = 2;
export const T_DEEP = 3;
export const T_SAND = 4;
export const T_PLAZA = 5;
export const T_DARK = 6;
export const T_FLOOR = 7;

export type PropKind =
  | 'tree' | 'rock' | 'bush' | 'flowers' | 'grave' | 'bones' | 'deadtree' | 'crystal' | 'lava' | 'mushroom' | 'stump' | 'pine' | 'snow'
  | 'building' | 'wall' | 'tower' | 'fountain' | 'lamp' | 'barrel' | 'crate' | 'fence' | 'board' | 'anvil' | 'range' | 'well'
  | 'banner' | 'stall' | 'chest' | 'stash' | 'pillar' | 'ruin';

export interface Prop {
  kind: PropKind;
  /** centre for 1x1 props, footprint origin for buildings */
  x: number;
  y: number;
  w?: number;
  h?: number;
  variant: number;
  seed: number;
  depth: number;
  color?: string;
  roof?: string;
  wall?: string;
  label?: string;
  height?: number;
  solid?: boolean;
}

export interface SpawnDef {
  id: string;
  enemyId: string;
  x: number;
  y: number;
  level: number;
  elite?: boolean;
  boss?: boolean;
  pack: number;
}

export interface NodeSpawn {
  id: string;
  nodeId: string;
  x: number;
  y: number;
  /** tree kind for rendering woodcutting nodes */
  variant: string;
}

export interface ExitDef {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  to: string;
  label: string;
}

export interface Station {
  kind: 'range' | 'anvil' | 'board' | 'chest' | 'stash' | 'waystone';
  x: number;
  y: number;
}

export interface ZoneMap {
  id: string;
  w: number;
  h: number;
  tiles: Uint8Array;
  shade: Uint8Array;
  solid: Uint8Array;
  opaque: Uint8Array;
  biome: Biome;
  props: Prop[];
  spawns: SpawnDef[];
  nodes: NodeSpawn[];
  exits: ExitDef[];
  /** where the player appears when arriving from the previous area */
  entry: { x: number; y: number };
  /** where the player appears when arriving back from the next area */
  backEntry: { x: number; y: number };
  waystone: { x: number; y: number } | null;
  campSpots: { x: number; y: number; level: number }[];
  stations: Station[];
  isTown: boolean;
  level: [number, number];
}

export function idx(m: ZoneMap, x: number, y: number): number {
  return y * m.w + x;
}

export function inBounds(m: ZoneMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < m.w && y < m.h;
}

export function isSolidAt(m: ZoneMap, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
  return m.solid[ty * m.w + tx] !== 0;
}

export function isOpaqueAt(m: ZoneMap, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
  return m.opaque[ty * m.w + tx] !== 0;
}

/** True if a circle of radius r at (x, y) overlaps no solid tile. */
export function circleFree(m: ZoneMap, x: number, y: number, r: number): boolean {
  return (
    !isSolidAt(m, x - r, y - r) &&
    !isSolidAt(m, x + r, y - r) &&
    !isSolidAt(m, x - r, y + r) &&
    !isSolidAt(m, x + r, y + r) &&
    !isSolidAt(m, x, y)
  );
}

export function lineOfSight(m: ZoneMap, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(d / 0.3);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isOpaqueAt(m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

/** Walkable-path line check (used for blink and dashes). */
export function walkLine(m: ZoneMap, x0: number, y0: number, x1: number, y1: number, r: number): { x: number; y: number } {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(d / 0.2));
  let lx = x0;
  let ly = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (!circleFree(m, x, y, r)) break;
    lx = x;
    ly = y;
  }
  return { x: lx, y: ly };
}

/**
 * Breadth-first distance field toward a target tile, used by enemies to
 * path around obstacles. Limited to a radius for speed.
 */
export class FlowField {
  dist: Int16Array;
  tx = -1;
  ty = -1;
  constructor(private m: ZoneMap) {
    this.dist = new Int16Array(m.w * m.h);
  }
  build(tx: number, ty: number, radius = 28): void {
    const m = this.m;
    tx = Math.floor(tx);
    ty = Math.floor(ty);
    this.tx = tx;
    this.ty = ty;
    this.dist.fill(-1);
    if (!inBounds(m, tx, ty)) return;
    const qx = new Int16Array(m.w * m.h);
    const qy = new Int16Array(m.w * m.h);
    let head = 0;
    let tail = 0;
    qx[tail] = tx;
    qy[tail++] = ty;
    this.dist[ty * m.w + tx] = 0;
    while (head < tail) {
      const x = qx[head];
      const y = qy[head++];
      const d = this.dist[y * m.w + x];
      if (d >= radius) continue;
      for (let k = 0; k < 4; k++) {
        const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
        const i = ny * m.w + nx;
        if (this.dist[i] !== -1 || m.solid[i]) continue;
        this.dist[i] = d + 1;
        qx[tail] = nx;
        qy[tail++] = ny;
      }
    }
  }
  /** Direction to step from (x, y) to approach the target, or null. */
  dir(x: number, y: number): { x: number; y: number } | null {
    const m = this.m;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (!inBounds(m, cx, cy)) return null;
    const here = this.dist[cy * m.w + cx];
    if (here < 0) return null;
    let best = here;
    let bx = 0;
    let by = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = cx + ox;
        const ny = cy + oy;
        if (!inBounds(m, nx, ny)) continue;
        const d = this.dist[ny * m.w + nx];
        if (d < 0) continue;
        // avoid cutting corners through solid tiles
        if (ox && oy && (m.solid[cy * m.w + nx] || m.solid[ny * m.w + cx])) continue;
        if (d < best) {
          best = d;
          bx = ox;
          by = oy;
        }
      }
    }
    if (!bx && !by) return null;
    const tx = cx + bx + 0.5 - x;
    const ty = cy + by + 0.5 - y;
    const l = Math.hypot(tx, ty) || 1;
    return { x: tx / l, y: ty / l };
  }
}

export function floodReachable(m: ZoneMap, sx: number, sy: number): Uint8Array {
  const seen = new Uint8Array(m.w * m.h);
  const stack: number[] = [Math.floor(sy) * m.w + Math.floor(sx)];
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i] || m.solid[i]) continue;
    seen[i] = 1;
    const x = i % m.w;
    const y = (i / m.w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < m.w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - m.w);
    if (y < m.h - 1) stack.push(i + m.w);
  }
  return seen;
}
