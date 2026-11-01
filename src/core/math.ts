// Math helpers and the isometric projection.

export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;

export interface Vec {
  x: number;
  y: number;
}

/** World tile coords -> screen pixels (before camera). */
export function isoToScreen(x: number, y: number): Vec {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H };
}

/** Screen pixels (before camera) -> world tile coords. */
export function screenToIso(sx: number, sy: number): Vec {
  const a = sx / HALF_W;
  const b = sy / HALF_H;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/**
 * Converts a screen-space direction (e.g. joystick) into a world-space direction
 * so that pushing "up" on the stick moves the character up the screen.
 */
export function screenDirToWorld(dx: number, dy: number): Vec {
  // screen = ((x - y) * HW, (x + y) * HH); invert the linear map with equal pixel speed.
  const wx = dx / HALF_W + dy / HALF_H;
  const wy = dy / HALF_H - dx / HALF_W;
  const len = Math.hypot(wx, wy);
  if (len < 1e-6) return { x: 0, y: 0 };
  const mag = Math.min(1, Math.hypot(dx, dy));
  return { x: (wx / len) * mag, y: (wy / len) * mag };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

/** Smallest signed difference between two angles. */
export function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return Math.round(n).toString();
}
