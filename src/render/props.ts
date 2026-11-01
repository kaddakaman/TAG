// Drawing of static scenery: trees, rocks, buildings, walls and town features.

import { HALF_H, HALF_W, isoToScreen } from '../core/math';
import type { Prop } from '../world/map';
import { shade, shadow, type Ctx } from './sprites';

const TREE_COLORS: Record<string, [string, string, string]> = {
  oak: ['#3f7a2a', '#4f9234', '#2f6420'],
  willow: ['#7a9a4a', '#8fb05a', '#5f7f3a'],
  maple: ['#d0602a', '#e0803a', '#a84a20'],
  yew: ['#2a5a3a', '#356a46', '#1f4a2e'],
  elder: ['#7a5aa8', '#9a7ac8', '#5a3a88'],
  silver: ['#8ad0c0', '#b0e8da', '#5aa898'],
  pine: ['#2f5a3a', '#3a6c46', '#22462c'],
};

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function drawTree(ctx: Ctx, x: number, y: number, kind: string, seed: number, time: number, depleted = false): void {
  const s = 0.85 + hash(seed) * 0.35;
  const sway = Math.sin(time * 1.2 + seed) * 1.2;
  shadow(ctx, x, y, 16 * s, 0.25);
  if (depleted) {
    ctx.fillStyle = '#6a4a2a';
    ctx.beginPath();
    ctx.ellipse(x, y - 3, 6 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9a36a';
    ctx.beginPath();
    ctx.ellipse(x, y - 5, 5 * s, 2.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (kind === 'deadtree') {
    ctx.strokeStyle = '#4a3a30';
    ctx.lineCap = 'round';
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + sway * 0.3, y - 40 * s);
    ctx.stroke();
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.moveTo(x, y - 22 * s);
    ctx.lineTo(x - 14 * s, y - 34 * s);
    ctx.moveTo(x, y - 30 * s);
    ctx.lineTo(x + 12 * s, y - 44 * s);
    ctx.moveTo(x - 8 * s, y - 29 * s);
    ctx.lineTo(x - 10 * s, y - 42 * s);
    ctx.stroke();
    return;
  }
  const c = TREE_COLORS[kind] ?? TREE_COLORS.oak;
  ctx.fillStyle = kind === 'silver' ? '#d8dde6' : kind === 'elder' ? '#4a3a5a' : '#5a3a22';
  ctx.fillRect(x - 3 * s, y - 22 * s, 6 * s, 22 * s);
  if (kind === 'pine' || kind === 'yew') {
    for (let i = 0; i < 3; i++) {
      const w = (20 - i * 5) * s;
      const by = y - (16 + i * 13) * s;
      ctx.fillStyle = i % 2 ? c[1] : c[0];
      ctx.beginPath();
      ctx.moveTo(x - w + sway * (i * 0.3), by);
      ctx.lineTo(x + w + sway * (i * 0.3), by);
      ctx.lineTo(x + sway * (i * 0.5), by - 22 * s);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.moveTo(x + sway * (i * 0.5), by - 22 * s);
      ctx.lineTo(x + w + sway * (i * 0.3), by);
      ctx.lineTo(x + sway * (i * 0.3), by);
      ctx.fill();
    }
    return;
  }
  if (kind === 'willow') {
    ctx.fillStyle = c[0];
    ctx.beginPath();
    ctx.ellipse(x + sway, y - 40 * s, 20 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c[1];
    ctx.lineWidth = 2 * s;
    for (let i = 0; i < 9; i++) {
      const ox = (i - 4) * 4.5 * s;
      ctx.beginPath();
      ctx.moveTo(x + ox + sway, y - 36 * s);
      ctx.quadraticCurveTo(x + ox * 1.3 + sway * 2, y - 22 * s, x + ox * 1.2 + sway * 2.5, y - 12 * s);
      ctx.stroke();
    }
    return;
  }
  const blobs: [number, number, number, number][] = [
    [-9, -32, 12, 2],
    [9, -33, 12, 2],
    [0, -44, 14, 0],
    [-4, -36, 11, 1],
    [6, -42, 9, 1],
  ];
  for (const [bx, by, r, ci] of blobs) {
    ctx.fillStyle = c[ci];
    ctx.beginPath();
    ctx.arc(x + bx * s + sway, y + by * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === 'oak' && hash(seed + 3) > 0.7) {
    ctx.fillStyle = '#c03a2a';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + (hash(seed + i) - 0.5) * 24 * s + sway, y - (30 + hash(seed + i + 9) * 18) * s, 2.5, 2.5);
  }
}

export function drawRock(ctx: Ctx, x: number, y: number, seed: number, color = '#8a8680', ore: string | null = null, depleted = false): void {
  const s = 0.8 + hash(seed) * 0.4;
  shadow(ctx, x, y, 13 * s, 0.25);
  const base = depleted ? '#6a6660' : color;
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(x - 13 * s, y - 2 * s);
  ctx.lineTo(x - 10 * s, y - 13 * s);
  ctx.lineTo(x - 2 * s, y - 19 * s);
  ctx.lineTo(x + 8 * s, y - 16 * s);
  ctx.lineTo(x + 13 * s, y - 5 * s);
  ctx.lineTo(x + 6 * s, y + 2 * s);
  ctx.lineTo(x - 7 * s, y + 2 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(base, 0.18);
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y - 13 * s);
  ctx.lineTo(x - 2 * s, y - 19 * s);
  ctx.lineTo(x + 8 * s, y - 16 * s);
  ctx.lineTo(x + 1 * s, y - 10 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(base, -0.25);
  ctx.beginPath();
  ctx.moveTo(x + 1 * s, y - 10 * s);
  ctx.lineTo(x + 8 * s, y - 16 * s);
  ctx.lineTo(x + 13 * s, y - 5 * s);
  ctx.lineTo(x + 6 * s, y + 2 * s);
  ctx.closePath();
  ctx.fill();
  if (ore && !depleted) {
    ctx.fillStyle = ore;
    for (let i = 0; i < 6; i++) {
      const ox = (hash(seed + i * 3) - 0.5) * 18 * s;
      const oy = -4 - hash(seed + i * 7) * 12;
      ctx.beginPath();
      ctx.arc(x + ox, y + oy * s, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x - 3 * s, y - 12 * s, 1.5, 1.5);
  }
}

export function drawHerb(ctx: Ctx, x: number, y: number, color: string, seed: number, time: number, depleted = false): void {
  ctx.strokeStyle = depleted ? '#6a5a3a' : '#4a8a2a';
  ctx.lineWidth = 2;
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.35;
    const len = (depleted ? 4 : 10) + hash(seed + i) * 5;
    const sw = Math.sin(time * 2 + i + seed) * 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len + sw, y + Math.sin(a) * len);
    ctx.stroke();
    if (!depleted) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * len + sw, y + Math.sin(a) * len, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (!depleted) {
    // sparkle so it reads as gatherable
    const t = (time * 0.8 + hash(seed)) % 1;
    ctx.fillStyle = `rgba(255,255,220,${1 - t})`;
    ctx.fillRect(x - 6 + hash(seed + 5) * 12, y - 14 - t * 6, 2, 2);
  }
}

export function drawFishSpot(ctx: Ctx, x: number, y: number, time: number, seed: number, depleted = false): void {
  if (depleted) return;
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.5 + i / 3 + hash(seed)) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - t)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + t * 16, (4 + t * 16) * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const fx = Math.sin(time * 1.5 + seed) * 6;
  ctx.fillStyle = 'rgba(20,40,60,0.45)';
  ctx.beginPath();
  ctx.ellipse(x + fx, y + 2, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Draws an isometric box whose footprint is [x0,x0+w] x [y0,y0+h] in world tiles. */
export function isoBox(ctx: Ctx, x0: number, y0: number, w: number, h: number, height: number, top: string, left: string, right: string): void {
  const T = isoToScreen(x0, y0);
  const R = isoToScreen(x0 + w, y0);
  const B = isoToScreen(x0 + w, y0 + h);
  const Lp = isoToScreen(x0, y0 + h);
  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(Lp.x, Lp.y);
  ctx.lineTo(B.x, B.y);
  ctx.lineTo(B.x, B.y - height);
  ctx.lineTo(Lp.x, Lp.y - height);
  ctx.fill();
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(B.x, B.y);
  ctx.lineTo(R.x, R.y);
  ctx.lineTo(R.x, R.y - height);
  ctx.lineTo(B.x, B.y - height);
  ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(T.x, T.y - height);
  ctx.lineTo(R.x, R.y - height);
  ctx.lineTo(B.x, B.y - height);
  ctx.lineTo(Lp.x, Lp.y - height);
  ctx.fill();
}

export function drawBuilding(ctx: Ctx, p: Prop): void {
  const w = p.w ?? 4;
  const h = p.h ?? 4;
  const H = p.height ?? 70;
  const wall = p.wall ?? '#c8b090';
  const roof = p.roof ?? '#7a3a2a';
  const R = isoToScreen(p.x + w, p.y);
  const B = isoToScreen(p.x + w, p.y + h);
  const Lp = isoToScreen(p.x, p.y + h);
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.moveTo(Lp.x - 6, Lp.y + 2);
  ctx.lineTo(B.x, B.y + 8);
  ctx.lineTo(R.x + 6, R.y + 2);
  ctx.lineTo(R.x, R.y);
  ctx.lineTo(Lp.x, Lp.y);
  ctx.fill();
  // stone foundation
  isoBox(ctx, p.x, p.y, w, h, 10, '#8a8478', '#7a7468', '#5f5a50');
  // walls
  ctx.fillStyle = shade(wall, -0.05);
  ctx.beginPath();
  ctx.moveTo(Lp.x, Lp.y - 10);
  ctx.lineTo(B.x, B.y - 10);
  ctx.lineTo(B.x, B.y - H);
  ctx.lineTo(Lp.x, Lp.y - H);
  ctx.fill();
  ctx.fillStyle = shade(wall, -0.28);
  ctx.beginPath();
  ctx.moveTo(B.x, B.y - 10);
  ctx.lineTo(R.x, R.y - 10);
  ctx.lineTo(R.x, R.y - H);
  ctx.lineTo(B.x, B.y - H);
  ctx.fill();
  // timber frame
  ctx.strokeStyle = shade(wall, -0.55);
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const [a, b] of [[Lp, B], [B, R]] as const) {
    ctx.moveTo(a.x, a.y - H + 2);
    ctx.lineTo(b.x, b.y - H + 2);
    ctx.moveTo(a.x, a.y - H * 0.55);
    ctx.lineTo(b.x, b.y - H * 0.55);
    ctx.moveTo(a.x, a.y - 10);
    ctx.lineTo(a.x, a.y - H);
  }
  ctx.moveTo(R.x, R.y - 10);
  ctx.lineTo(R.x, R.y - H);
  ctx.stroke();
  // windows on both faces
  const win = (ax: number, ay: number, bx: number, by: number, t: number, lit: boolean) => {
    const cx = ax + (bx - ax) * t;
    const cy = ay + (by - ay) * t;
    const slope = (by - ay) / (bx - ax);
    ctx.fillStyle = lit ? '#ffd88a' : '#3a3a48';
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - H * 0.78 - 6 * slope);
    ctx.lineTo(cx + 6, cy - H * 0.78 + 6 * slope);
    ctx.lineTo(cx + 6, cy - H * 0.62 + 6 * slope);
    ctx.lineTo(cx - 6, cy - H * 0.62 - 6 * slope);
    ctx.fill();
  };
  win(Lp.x, Lp.y, B.x, B.y, 0.22, true);
  win(Lp.x, Lp.y, B.x, B.y, 0.78, true);
  win(B.x, B.y, R.x, R.y, 0.3, false);
  win(B.x, B.y, R.x, R.y, 0.7, true);
  // door on the left face
  {
    const t = 0.5;
    const cx = Lp.x + (B.x - Lp.x) * t;
    const cy = Lp.y + (B.y - Lp.y) * t;
    ctx.fillStyle = '#4a2e1b';
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy - 10 - 4.5);
    ctx.lineTo(cx + 9, cy - 10 + 4.5);
    ctx.lineTo(cx + 9, cy - 38 + 4.5);
    ctx.quadraticCurveTo(cx, cy - 46, cx - 9, cy - 38 - 4.5);
    ctx.fill();
    ctx.fillStyle = '#c9a35c';
    ctx.fillRect(cx + 4, cy - 24, 2.5, 2.5);
  }
  // roof (hipped)
  const over = 0.35;
  const rT = isoToScreen(p.x - over, p.y - over);
  const rR = isoToScreen(p.x + w + over, p.y - over);
  const rB = isoToScreen(p.x + w + over, p.y + h + over);
  const rL = isoToScreen(p.x - over, p.y + h + over);
  const apex = isoToScreen(p.x + w / 2, p.y + h / 2);
  const roofH = H + (w * 14) / 2 + 10;
  const ay = apex.y - roofH;
  const tri = (a: { x: number; y: number }, b: { x: number; y: number }, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - H + 4);
    ctx.lineTo(b.x, b.y - H + 4);
    ctx.lineTo(apex.x, ay);
    ctx.fill();
  };
  tri(rT, rR, shade(roof, 0.12));
  tri(rL, rT, shade(roof, 0.05));
  tri(rL, rB, roof);
  tri(rB, rR, shade(roof, -0.25));
  // ridge highlights / shingles
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    ctx.moveTo(rL.x + (apex.x - rL.x) * t, rL.y - H + 4 + (ay - (rL.y - H + 4)) * t);
    ctx.lineTo(rB.x + (apex.x - rB.x) * t, rB.y - H + 4 + (ay - (rB.y - H + 4)) * t);
    ctx.lineTo(rR.x + (apex.x - rR.x) * t, rR.y - H + 4 + (ay - (rR.y - H + 4)) * t);
  }
  ctx.stroke();
  // chimney for some buildings
  if (p.variant === 2 || p.variant === 3) {
    const c = isoToScreen(p.x + w * 0.7, p.y + h * 0.3);
    ctx.fillStyle = '#6a5a50';
    ctx.fillRect(c.x - 5, c.y - H - 40, 10, 30);
    ctx.fillStyle = 'rgba(200,200,200,0.35)';
    const t = (performance.now() / 1000) % 3;
    for (let i = 0; i < 3; i++) {
      const k = (t + i) % 3;
      ctx.beginPath();
      ctx.arc(c.x + k * 4, c.y - H - 44 - k * 12, 4 + k * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // guild hall banner
  if (p.variant === 1) {
    ctx.fillStyle = '#2a4d8b';
    ctx.fillRect(apex.x - 2, ay - 26, 3, 26);
    ctx.fillStyle = '#d9a020';
    ctx.beginPath();
    ctx.moveTo(apex.x + 1, ay - 26);
    ctx.lineTo(apex.x + 20, ay - 21);
    ctx.lineTo(apex.x + 1, ay - 15);
    ctx.fill();
  }
  // sign
  if (p.label) {
    const cx = Lp.x + (B.x - Lp.x) * 0.5;
    const cy = Lp.y + (B.y - Lp.y) * 0.5 - 56;
    ctx.font = 'bold 10px Georgia, serif';
    const tw = ctx.measureText(p.label).width;
    ctx.fillStyle = '#4a2e1b';
    ctx.fillRect(cx - tw / 2 - 5, cy - 9, tw + 10, 14);
    ctx.fillStyle = '#f0e0b0';
    ctx.textAlign = 'center';
    ctx.fillText(p.label, cx, cy + 2);
    ctx.textAlign = 'left';
  }
}

export function drawWall(ctx: Ctx, p: Prop, tower: boolean): void {
  const x0 = p.x - 0.5;
  const y0 = p.y - 0.5;
  const stone = p.variant === 1;
  const H = tower ? 62 : stone ? 40 : 34;
  if (stone) {
    isoBox(ctx, x0, y0, 1, 1, H, '#a8a29a', '#8f8a82', '#6f6a64');
    const top = isoToScreen(x0 + 0.5, y0 + 0.5);
    ctx.fillStyle = '#9a948c';
    for (const [ox, oy] of [[-10, 0], [10, 0]]) ctx.fillRect(top.x + ox - 4, top.y - H - 8 + oy, 8, 8);
    if (tower) {
      ctx.fillStyle = '#2a4d8b';
      ctx.fillRect(top.x - 1, top.y - H - 30, 2, 24);
      ctx.fillStyle = '#d9a020';
      ctx.fillRect(top.x + 1, top.y - H - 30, 12, 7);
    }
  } else {
    // palisade stakes
    const L = isoToScreen(x0, y0 + 1);
    const B = isoToScreen(x0 + 1, y0 + 1);
    const R = isoToScreen(x0 + 1, y0);
    const stake = (x: number, y: number, hh: number) => {
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(x - 3, y - hh, 6, hh);
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(x + 1, y - hh, 2, hh);
      ctx.fillStyle = '#8a6240';
      ctx.beginPath();
      ctx.moveTo(x - 3, y - hh);
      ctx.lineTo(x, y - hh - 6);
      ctx.lineTo(x + 3, y - hh);
      ctx.fill();
    };
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.5) / 4;
      stake(L.x + (B.x - L.x) * t, L.y + (B.y - L.y) * t, H + (tower ? 20 : 0) + ((p.seed + i) % 3) * 2);
      stake(B.x + (R.x - B.x) * t, B.y + (R.y - B.y) * t, H + (tower ? 20 : 0) + ((p.seed + i * 2) % 3) * 2);
    }
    if (tower) {
      const top = isoToScreen(x0 + 0.5, y0 + 0.5);
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(top.x - 18, top.y - H - 24, 36, 6);
      ctx.fillStyle = '#ff9a40';
      ctx.beginPath();
      ctx.arc(top.x, top.y - H - 30, 4 + Math.sin(performance.now() / 120) * 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawSmallProp(ctx: Ctx, p: Prop, sx: number, sy: number, time: number): void {
  const s = 0.8 + hash(p.seed) * 0.4;
  switch (p.kind) {
    case 'bush':
      shadow(ctx, sx, sy, 10, 0.2);
      ctx.fillStyle = '#3a7a2a';
      ctx.beginPath();
      ctx.arc(sx - 5 * s, sy - 6 * s, 6 * s, 0, Math.PI * 2);
      ctx.arc(sx + 5 * s, sy - 6 * s, 6 * s, 0, Math.PI * 2);
      ctx.arc(sx, sy - 10 * s, 7 * s, 0, Math.PI * 2);
      ctx.fill();
      if (hash(p.seed + 1) > 0.6) {
        ctx.fillStyle = '#c02a4a';
        ctx.fillRect(sx - 3, sy - 11, 2.5, 2.5);
        ctx.fillRect(sx + 4, sy - 7, 2.5, 2.5);
      }
      break;
    case 'flowers': {
      const cols = ['#f0e040', '#e04a6a', '#ffffff', '#8a6af0', '#f08a3a'];
      for (let i = 0; i < 5; i++) {
        const fx = sx + (hash(p.seed + i) - 0.5) * 22;
        const fy = sy + (hash(p.seed + i + 10) - 0.5) * 10;
        ctx.strokeStyle = '#3a7a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx, fy - 5);
        ctx.stroke();
        ctx.fillStyle = cols[(p.seed + i) % cols.length];
        ctx.beginPath();
        ctx.arc(fx, fy - 6, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'rock':
      drawRock(ctx, sx, sy, p.seed, '#8a8680');
      break;
    case 'grave':
      shadow(ctx, sx, sy, 9, 0.25);
      ctx.fillStyle = '#7a7a80';
      ctx.beginPath();
      ctx.moveTo(sx - 7, sy);
      ctx.lineTo(sx - 7, sy - 18);
      ctx.arc(sx, sy - 18, 7, Math.PI, 0);
      ctx.lineTo(sx + 7, sy);
      ctx.fill();
      ctx.fillStyle = '#5a5a60';
      ctx.fillRect(sx + 2, sy - 22, 5, 22);
      ctx.fillStyle = '#4a4a50';
      ctx.fillRect(sx - 3, sy - 17, 6, 1.5);
      ctx.fillRect(sx - 1, sy - 20, 1.5, 7);
      break;
    case 'bones':
      ctx.fillStyle = '#e8e4d8';
      ctx.save();
      ctx.translate(sx, sy - 2);
      ctx.rotate(hash(p.seed) * 3);
      ctx.fillRect(-8, -1.5, 16, 3);
      ctx.beginPath();
      ctx.arc(-8, 0, 2.5, 0, Math.PI * 2);
      ctx.arc(8, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(sx + 6, sy - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'deadtree':
      drawTree(ctx, sx, sy, 'deadtree', p.seed, time);
      break;
    case 'pine':
      drawTree(ctx, sx, sy, 'pine', p.seed, time);
      break;
    case 'crystal': {
      shadow(ctx, sx, sy, 9, 0.2);
      const c = hash(p.seed) > 0.5 ? '#8ad8ff' : '#d08aff';
      ctx.fillStyle = c;
      ctx.shadowColor = c;
      ctx.shadowBlur = 8;
      for (const [ox, h, wdt] of [[-5, 18, 4], [2, 26, 5], [7, 14, 3.5]] as [number, number, number][]) {
        ctx.beginPath();
        ctx.moveTo(sx + ox - wdt, sy);
        ctx.lineTo(sx + ox, sy - h);
        ctx.lineTo(sx + ox + wdt, sy);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      break;
    }
    case 'lava': {
      const glow = 0.6 + Math.sin(time * 2 + p.seed) * 0.3;
      ctx.strokeStyle = `rgba(255,${100 + glow * 60},20,${glow})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sx - 14, sy - 2);
      ctx.lineTo(sx - 4, sy + 2);
      ctx.lineTo(sx + 3, sy - 3);
      ctx.lineTo(sx + 14, sy + 1);
      ctx.moveTo(sx - 4, sy + 2);
      ctx.lineTo(sx - 2, sy + 7);
      ctx.stroke();
      break;
    }
    case 'mushroom':
      for (let i = 0; i < 3; i++) {
        const mx = sx + (hash(p.seed + i) - 0.5) * 16;
        const my = sy + (hash(p.seed + i + 4) - 0.5) * 6;
        ctx.fillStyle = '#e8e0d0';
        ctx.fillRect(mx - 1, my - 5, 2, 5);
        ctx.fillStyle = i % 2 ? '#c03a2a' : '#a08a5a';
        ctx.beginPath();
        ctx.arc(mx, my - 5, 4, Math.PI, 0);
        ctx.fill();
      }
      break;
    case 'stump':
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(sx - 7, sy - 8, 14, 8);
      ctx.fillStyle = '#c9a36a';
      ctx.beginPath();
      ctx.ellipse(sx, sy - 8, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'snow':
      ctx.fillStyle = 'rgba(240,245,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'barrel':
      shadow(ctx, sx, sy, 8, 0.25);
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(sx - 7, sy - 18, 14, 18);
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(sx - 7, sy - 14, 14, 2);
      ctx.fillRect(sx - 7, sy - 5, 14, 2);
      ctx.fillStyle = '#9a7250';
      ctx.beginPath();
      ctx.ellipse(sx, sy - 18, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'crate':
      isoBox(ctx, p.x - 0.3, p.y - 0.3, 0.6, 0.6, 16, '#a07a4a', '#8a6236', '#6a4a26');
      break;
    case 'lamp': {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(sx - 1.5, sy - 34, 3, 34);
      ctx.fillRect(sx - 5, sy - 38, 10, 5);
      const g = ctx.createRadialGradient(sx, sy - 36, 1, sx, sy - 36, 22);
      g.addColorStop(0, 'rgba(255,220,140,0.55)');
      g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 22, sy - 58, 44, 44);
      break;
    }
    case 'banner':
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(sx - 1.5, sy - 46, 3, 46);
      ctx.fillStyle = p.color ?? '#2a4d8b';
      ctx.beginPath();
      ctx.moveTo(sx + 1.5, sy - 46);
      ctx.lineTo(sx + 16 + Math.sin(time * 3 + p.seed) * 2, sy - 44);
      ctx.lineTo(sx + 14 + Math.sin(time * 3 + p.seed + 1) * 2, sy - 28);
      ctx.lineTo(sx + 1.5, sy - 30);
      ctx.fill();
      ctx.fillStyle = '#d9a020';
      ctx.beginPath();
      ctx.arc(sx + 8, sy - 37, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'board':
      shadow(ctx, sx, sy, 12, 0.25);
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(sx - 14, sy - 34, 3, 34);
      ctx.fillRect(sx + 11, sy - 34, 3, 34);
      ctx.fillStyle = '#9a7250';
      ctx.fillRect(sx - 16, sy - 40, 32, 22);
      ctx.fillStyle = '#f0e8d0';
      ctx.fillRect(sx - 13, sy - 37, 8, 9);
      ctx.fillRect(sx - 3, sy - 38, 7, 11);
      ctx.fillRect(sx + 6, sy - 36, 8, 8);
      ctx.fillStyle = '#c03a2a';
      ctx.fillRect(sx - 10, sy - 36, 2, 2);
      ctx.fillRect(sx, sy - 37, 2, 2);
      break;
    case 'anvil':
      shadow(ctx, sx, sy, 10, 0.3);
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(sx - 5, sy - 10, 10, 10);
      ctx.fillStyle = '#3a3a40';
      ctx.fillRect(sx - 10, sy - 16, 20, 6);
      ctx.beginPath();
      ctx.moveTo(sx + 10, sy - 16);
      ctx.lineTo(sx + 16, sy - 14);
      ctx.lineTo(sx + 10, sy - 12);
      ctx.fill();
      // forge glow
      ctx.fillStyle = `rgba(255,${120 + Math.sin(time * 6) * 30},40,0.8)`;
      ctx.beginPath();
      ctx.arc(sx - 20, sy - 6, 5 + Math.sin(time * 8) * 1, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'range':
      isoBox(ctx, p.x - 0.4, p.y - 0.4, 0.8, 0.8, 20, '#4a4a50', '#6a6a70', '#505058');
      ctx.fillStyle = `rgba(255,${130 + Math.sin(time * 7) * 40},40,0.9)`;
      ctx.beginPath();
      ctx.arc(sx, sy - 22, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(sx - 7, sy - 26, 14, 3);
      break;
    case 'chest':
    case 'stash': {
      const stash = p.kind === 'stash';
      isoBox(ctx, p.x - 0.35, p.y - 0.3, 0.7, 0.6, 14, stash ? '#5a4a8a' : '#8a5a2a', stash ? '#4a3a7a' : '#7a4a20', stash ? '#3a2a6a' : '#5a3a18');
      ctx.fillStyle = '#d9a020';
      ctx.fillRect(sx - 2, sy - 12, 4, 4);
      if (stash) {
        ctx.fillStyle = `rgba(160,140,255,${0.3 + Math.sin(time * 3) * 0.15})`;
        ctx.beginPath();
        ctx.arc(sx, sy - 10, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'well':
      isoBox(ctx, p.x - 0.4, p.y - 0.4, 0.8, 0.8, 14, '#3a5a8a', '#8a8478', '#6a6458');
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(sx - 12, sy - 40, 3, 30);
      ctx.fillRect(sx + 9, sy - 40, 3, 30);
      ctx.fillStyle = '#7a3a2a';
      ctx.beginPath();
      ctx.moveTo(sx - 16, sy - 36);
      ctx.lineTo(sx, sy - 48);
      ctx.lineTo(sx + 16, sy - 36);
      ctx.fill();
      break;
    case 'stall':
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(sx - 14, sy - 30, 3, 30);
      ctx.fillRect(sx + 11, sy - 30, 3, 30);
      isoBox(ctx, p.x - 0.4, p.y - 0.3, 0.8, 0.6, 12, '#9a7250', '#8a6236', '#6a4a26');
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#e8e0d0' : '#c03a2a';
        ctx.fillRect(sx - 16 + i * 8, sy - 36, 8, 8);
      }
      break;
    case 'fountain': {
      const w = p.w ?? 2;
      isoBox(ctx, p.x, p.y, w, w, 14, '#4a8ac0', '#a8a29a', '#8a847c');
      const c = isoToScreen(p.x + w / 2, p.y + w / 2);
      ctx.fillStyle = '#a8a29a';
      ctx.fillRect(c.x - 3, c.y - 36, 6, 24);
      for (let i = 0; i < 6; i++) {
        const t = (time * 1.4 + i / 6) % 1;
        const a = (i / 6) * Math.PI * 2;
        ctx.fillStyle = `rgba(180,220,255,${1 - t})`;
        ctx.beginPath();
        ctx.arc(c.x + Math.cos(a) * t * 16, c.y - 36 + t * 22 - Math.sin(t * Math.PI) * 10, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'pillar':
    case 'ruin':
      isoBox(ctx, p.x - 0.3, p.y - 0.3, 0.6, 0.6, 40, '#a8a29a', '#8f8a82', '#6f6a64');
      break;
    default:
      break;
  }
}

export function drawWaystone(ctx: Ctx, x: number, y: number, time: number, active: boolean): void {
  shadow(ctx, x, y, 14, 0.3);
  ctx.fillStyle = '#5a5a68';
  ctx.beginPath();
  ctx.moveTo(x - 14, y);
  ctx.lineTo(x, y + 7);
  ctx.lineTo(x + 14, y);
  ctx.lineTo(x, y - 7);
  ctx.fill();
  ctx.fillStyle = '#6a6a7a';
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 2);
  ctx.lineTo(x - 4, y - 46);
  ctx.lineTo(x, y - 54);
  ctx.lineTo(x + 4, y - 46);
  ctx.lineTo(x + 7, y - 2);
  ctx.fill();
  ctx.fillStyle = '#4a4a58';
  ctx.beginPath();
  ctx.moveTo(x, y - 54);
  ctx.lineTo(x + 4, y - 46);
  ctx.lineTo(x + 7, y - 2);
  ctx.lineTo(x, y);
  ctx.fill();
  const glow = active ? 0.7 + Math.sin(time * 3) * 0.3 : 0.25;
  ctx.fillStyle = `rgba(120,220,255,${glow})`;
  ctx.shadowColor = '#7ad8ff';
  ctx.shadowBlur = active ? 14 : 0;
  for (let i = 0; i < 3; i++) ctx.fillRect(x - 2, y - 40 + i * 11, 4, 6);
  ctx.shadowBlur = 0;
  if (active) {
    const t = (time * 0.6) % 1;
    ctx.strokeStyle = `rgba(120,220,255,${1 - t})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + t * 20, (10 + t * 20) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawCampfire(ctx: Ctx, x: number, y: number, time: number): void {
  const g = ctx.createRadialGradient(x, y - 6, 2, x, y - 6, 70);
  g.addColorStop(0, 'rgba(255,170,60,0.35)');
  g.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 70, y - 76, 140, 140);
  ctx.fillStyle = '#5a3a20';
  ctx.save();
  ctx.translate(x, y);
  for (const a of [-0.5, 0.5, 1.6]) {
    ctx.save();
    ctx.rotate(a);
    ctx.fillRect(-10, -2, 20, 4);
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = '#7a7470';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 13, y + Math.sin(a) * 6.5, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    const f = Math.sin(time * 10 + i * 2) * 3;
    ctx.fillStyle = ['#ff3a1a', '#ff8a2a', '#ffd040'][i];
    ctx.beginPath();
    ctx.moveTo(x - 7 + i * 2, y - 2);
    ctx.quadraticCurveTo(x - 4 + f, y - 18 + i * 4, x + f * 0.5, y - 26 + i * 6);
    ctx.quadraticCurveTo(x + 4 + f, y - 14 + i * 4, x + 7 - i * 2, y - 2);
    ctx.fill();
  }
}

export { HALF_H, HALF_W };
