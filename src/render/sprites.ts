// Procedural drawing of characters, creatures and NPCs. Everything is drawn
// with canvas paths so player customisation (skin, hair, three clothing
// colours) is visible in game.

import type { HumanoidLook } from '../data/enemies';

export type Ctx = CanvasRenderingContext2D;

export function shade(hex: string, amt: number): string {
  // amt -1..1 darken/lighten
  const n = hex.startsWith('#') ? hex.slice(1) : hex;
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  let r = parseInt(full.slice(0, 2), 16);
  let g = parseInt(full.slice(2, 4), 16);
  let b = parseInt(full.slice(4, 6), 16);
  if (amt < 0) {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  } else {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function shadow(ctx: Ctx, x: number, y: number, w: number, alpha = 0.3): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, w, w * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

export interface HumanoidPose {
  /** facing angle in world space */
  facing: number;
  walk: number;
  moving: boolean;
  /** 0..1 progress of the attack swing (0 = none) */
  attack: number;
  hurt: boolean;
  scale: number;
  weapon?: string;
  offhand?: string;
  hat?: 'helm' | 'hood' | 'wizard' | null;
  shoulders?: string | null;
  cape?: boolean;
  glow?: string | null;
  alpha?: number;
  spin?: number;
}

/** Converts a world-space facing angle into screen space angle. */
export function screenAngle(facing: number): number {
  const cx = Math.cos(facing);
  const cy = Math.sin(facing);
  return Math.atan2((cx + cy) * 0.5, cx - cy);
}

function limb(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

export function drawWeapon(ctx: Ctx, kind: string | undefined, x: number, y: number, angle: number, s: number, glow?: string | null): void {
  if (!kind) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
  }
  switch (kind) {
    case 'sword':
      ctx.fillStyle = '#d8dde6';
      ctx.fillRect(0, -1.6 * s, 17 * s, 3.2 * s);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2 * s, -0.6 * s, 14 * s, 1 * s);
      ctx.fillStyle = '#8a6a2a';
      ctx.fillRect(-4 * s, -1.4 * s, 4 * s, 2.8 * s);
      ctx.fillStyle = '#c9a35c';
      ctx.fillRect(-0.5 * s, -4 * s, 2 * s, 8 * s);
      break;
    case 'dagger':
      ctx.fillStyle = '#d8dde6';
      ctx.beginPath();
      ctx.moveTo(0, -1.5 * s);
      ctx.lineTo(10 * s, 0);
      ctx.lineTo(0, 1.5 * s);
      ctx.fill();
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(-3.5 * s, -1.2 * s, 3.5 * s, 2.4 * s);
      break;
    case 'axe':
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(-3 * s, -1.2 * s, 18 * s, 2.4 * s);
      ctx.fillStyle = '#c8ccd4';
      ctx.beginPath();
      ctx.moveTo(10 * s, -1 * s);
      ctx.quadraticCurveTo(13 * s, -8 * s, 17 * s, -7 * s);
      ctx.lineTo(16 * s, 1 * s);
      ctx.quadraticCurveTo(13 * s, 1 * s, 10 * s, 1 * s);
      ctx.fill();
      break;
    case 'mace':
    case 'club':
      ctx.fillStyle = kind === 'club' ? '#6a4a2a' : '#7a5230';
      ctx.fillRect(-3 * s, -1.2 * s, 14 * s, 2.4 * s);
      ctx.fillStyle = kind === 'club' ? '#5a3a1a' : '#9aa0aa';
      ctx.beginPath();
      ctx.arc(13 * s, 0, (kind === 'club' ? 5 : 4) * s, 0, Math.PI * 2);
      ctx.fill();
      if (kind === 'mace') {
        ctx.fillStyle = '#c8ccd4';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.fillRect(13 * s + Math.cos(a) * 4 * s - s, Math.sin(a) * 4 * s - s, 2 * s, 2 * s);
        }
      }
      break;
    case 'spear':
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(-8 * s, -1 * s, 26 * s, 2 * s);
      ctx.fillStyle = '#d8dde6';
      ctx.beginPath();
      ctx.moveTo(18 * s, -2.5 * s);
      ctx.lineTo(25 * s, 0);
      ctx.lineTo(18 * s, 2.5 * s);
      ctx.fill();
      break;
    case 'staff':
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(-10 * s, -1.2 * s, 26 * s, 2.4 * s);
      ctx.fillStyle = glow ?? '#8ad8ff';
      ctx.beginPath();
      ctx.arc(17 * s, 0, 3.2 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'wand':
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(-2 * s, -0.9 * s, 12 * s, 1.8 * s);
      ctx.fillStyle = glow ?? '#e08aff';
      ctx.beginPath();
      ctx.arc(11 * s, 0, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'bow':
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.arc(-2 * s, 0, 11 * s, -1.2, 1.2);
      ctx.stroke();
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 0.7 * s;
      ctx.beginPath();
      ctx.moveTo(-2 * s + Math.cos(-1.2) * 11 * s, Math.sin(-1.2) * 11 * s);
      ctx.lineTo(-2 * s + Math.cos(1.2) * 11 * s, Math.sin(1.2) * 11 * s);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function drawOffhand(ctx: Ctx, kind: string | undefined, x: number, y: number, s: number, front: boolean, color: string) {
  if (!kind) return;
  if (kind === 'shield') {
    ctx.fillStyle = shade(color, -0.2);
    ctx.strokeStyle = '#c9a35c';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(x - 5 * s, y - 7 * s);
    ctx.lineTo(x + 5 * s, y - 7 * s);
    ctx.lineTo(x + 5 * s, y + 1 * s);
    ctx.quadraticCurveTo(x, y + 9 * s, x - 5 * s, y + 1 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (front) {
      ctx.fillStyle = '#c9a35c';
      ctx.beginPath();
      ctx.arc(x, y - 2 * s, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'tome') {
    ctx.fillStyle = '#5a2a6a';
    ctx.fillRect(x - 3.5 * s, y - 4 * s, 7 * s, 8 * s);
    ctx.fillStyle = '#e0c040';
    ctx.fillRect(x - 3.5 * s, y - 4 * s, 1.5 * s, 8 * s);
  } else if (kind === 'quiver') {
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(x - 2 * s, y - 8 * s, 4 * s, 11 * s);
    ctx.fillStyle = '#e8e0c8';
    for (let i = 0; i < 3; i++) ctx.fillRect(x - 1.5 * s + i * 1.4 * s, y - 11 * s, 1 * s, 4 * s);
  }
}

/**
 * Draws a humanoid at (x, y) = feet position in screen pixels.
 */
export function drawHumanoid(ctx: Ctx, x: number, y: number, look: HumanoidLook & { hairStyle?: number; female?: boolean }, pose: HumanoidPose): void {
  const s = pose.scale * (look.bulk ?? 1);
  const sa = screenAngle(pose.facing);
  const back = Math.sin(sa) < -0.2; // facing up-screen: we see the back
  const flip = Math.cos(sa) < 0 ? -1 : 1;
  const walk = pose.moving ? Math.sin(pose.walk) : 0;
  const bob = pose.moving ? Math.abs(Math.cos(pose.walk)) * 1.5 * s : 0;
  const skel = !!look.skeleton;
  const skin = look.skin;
  const hurt = pose.hurt;

  ctx.save();
  if (pose.alpha !== undefined) ctx.globalAlpha = pose.alpha;
  shadow(ctx, x, y, 10 * s);
  ctx.translate(x, y - bob);
  if (pose.spin) ctx.rotate(Math.sin(pose.spin) * 0.15);
  ctx.scale(flip, 1);

  const legC = skel ? skin : look.secondary;
  const bootC = skel ? shade(skin, -0.2) : shade(look.secondary, -0.45);
  // legs
  const lx = 3 * s;
  limb(ctx, -lx * 0.7, -12 * s, -lx + walk * 4 * s, -2 * s, (skel ? 2 : 4.2) * s, legC);
  limb(ctx, lx * 0.7, -12 * s, lx - walk * 4 * s, -2 * s, (skel ? 2 : 4.2) * s, legC);
  ctx.fillStyle = bootC;
  ctx.fillRect(-lx + walk * 4 * s - 2.5 * s, -3.5 * s, 5 * s, 3.5 * s);
  ctx.fillRect(lx - walk * 4 * s - 2.5 * s, -3.5 * s, 5 * s, 3.5 * s);

  // cape (tertiary) behind the body when facing forward
  if (pose.cape && !back) {
    ctx.fillStyle = shade(look.tertiary, -0.25);
    ctx.beginPath();
    ctx.moveTo(-6 * s, -26 * s);
    ctx.lineTo(6 * s, -26 * s);
    ctx.lineTo(8 * s + walk * s, -6 * s);
    ctx.lineTo(-8 * s + walk * s, -6 * s);
    ctx.fill();
  }

  // weapon behind body when seen from the back
  const atk = pose.attack;
  const swing = atk > 0 ? Math.sin(atk * Math.PI) : 0;
  const isBow = pose.weapon === 'bow';
  const isCaster = pose.weapon === 'staff' || pose.weapon === 'wand';
  const handX = 8 * s;
  const handY = -18 * s + (pose.moving ? walk * 2 * s : 0);
  let wAngle = isBow ? 0 : isCaster ? -1.2 : -0.6 - swing * 2.2 + (atk > 0 ? 1.4 : 0);
  if (pose.spin) wAngle = pose.spin * 3;
  if (back) {
    drawWeapon(ctx, pose.weapon, handX, handY, wAngle, s, pose.glow);
    drawOffhand(ctx, pose.offhand === 'quiver' ? undefined : pose.offhand, -8 * s, -16 * s, s, false, look.primary);
  }

  // torso
  const bodyW = (look.female ? 7 : 8) * s;
  if (skel) {
    ctx.fillStyle = skin;
    ctx.fillRect(-1.2 * s, -27 * s, 2.4 * s, 15 * s);
    ctx.strokeStyle = skin;
    ctx.lineWidth = 1.6 * s;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-5 * s, -25 * s + i * 3 * s);
      ctx.quadraticCurveTo(0, -23 * s + i * 3 * s, 5 * s, -25 * s + i * 3 * s);
      ctx.stroke();
    }
    ctx.fillStyle = look.primary;
    ctx.globalAlpha *= 0.85;
    ctx.fillRect(-6 * s, -14 * s, 12 * s, 4 * s);
    ctx.globalAlpha = pose.alpha ?? 1;
  } else {
    ctx.fillStyle = hurt ? '#ffffff' : look.primary;
    ctx.beginPath();
    ctx.moveTo(-bodyW, -27 * s);
    ctx.lineTo(bodyW, -27 * s);
    ctx.lineTo(bodyW * 0.85, -11 * s);
    ctx.lineTo(-bodyW * 0.85, -11 * s);
    ctx.closePath();
    ctx.fill();
    // shading on one side
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.moveTo(bodyW * 0.2, -27 * s);
    ctx.lineTo(bodyW, -27 * s);
    ctx.lineTo(bodyW * 0.85, -11 * s);
    ctx.lineTo(bodyW * 0.2, -11 * s);
    ctx.fill();
    // belt + trim (tertiary)
    ctx.fillStyle = look.tertiary;
    ctx.fillRect(-bodyW * 0.9, -14 * s, bodyW * 1.8, 2.6 * s);
    if (!back) {
      ctx.fillRect(-1 * s, -27 * s, 2 * s, 13 * s);
      ctx.fillStyle = shade(look.tertiary, 0.3);
      ctx.fillRect(-1.5 * s, -14.2 * s, 3 * s, 3 * s);
    }
    // skirt for robes / female
    if (look.female || pose.hat === 'wizard') {
      ctx.fillStyle = shade(look.primary, -0.1);
      ctx.beginPath();
      ctx.moveTo(-bodyW * 0.85, -12 * s);
      ctx.lineTo(bodyW * 0.85, -12 * s);
      ctx.lineTo(bodyW * 1.05, -5 * s);
      ctx.lineTo(-bodyW * 1.05, -5 * s);
      ctx.fill();
    }
  }
  // shoulders (armour)
  if (pose.shoulders) {
    ctx.fillStyle = pose.shoulders;
    ctx.beginPath();
    ctx.ellipse(-bodyW, -26 * s, 3.5 * s, 2.6 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(bodyW, -26 * s, 3.5 * s, 2.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // arms
  const armC = skel ? skin : look.primary;
  const armSwing = pose.moving ? -walk * 3 * s : 0;
  // back arm (offhand side)
  limb(ctx, -bodyW + 1 * s, -25 * s, -bodyW - 1 * s - armSwing, -15 * s, (skel ? 1.8 : 3.4) * s, armC);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(-bodyW - 1 * s - armSwing, -14.5 * s, 1.8 * s, 0, Math.PI * 2);
  ctx.fill();
  // front arm (weapon)
  const reach = atk > 0 ? swing * 4 * s : 0;
  const fx = handX + reach;
  const fy = handY - (isBow ? 3 * s : 0);
  limb(ctx, bodyW - 1 * s, -25 * s, fx, fy, (skel ? 1.8 : 3.4) * s, armC);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(fx, fy, 1.9 * s, 0, Math.PI * 2);
  ctx.fill();

  // head
  const headY = -32 * s;
  ctx.fillStyle = hurt ? '#ffffff' : skin;
  ctx.beginPath();
  ctx.arc(0, headY, 5.5 * s, 0, Math.PI * 2);
  ctx.fill();
  if (look.ears) {
    ctx.beginPath();
    ctx.moveTo(4.5 * s, headY - 1 * s);
    ctx.lineTo(9 * s, headY - 5 * s);
    ctx.lineTo(5 * s, headY + 1.5 * s);
    ctx.moveTo(-4.5 * s, headY - 1 * s);
    ctx.lineTo(-9 * s, headY - 5 * s);
    ctx.lineTo(-5 * s, headY + 1.5 * s);
    ctx.fill();
  }
  if (!back) {
    ctx.fillStyle = skel ? '#2a1a1a' : '#1a1410';
    ctx.fillRect(1.2 * s, headY - 1 * s, 1.5 * s, 1.6 * s);
    ctx.fillRect(3.6 * s, headY - 1 * s, 1.3 * s, 1.6 * s);
    if (skel) {
      ctx.fillRect(2 * s, headY + 2.5 * s, 3 * s, 1 * s);
    }
    if (look.tusks) {
      ctx.fillStyle = '#f0ead0';
      ctx.fillRect(1.5 * s, headY + 2 * s, 1.2 * s, 2.5 * s);
      ctx.fillRect(4 * s, headY + 2 * s, 1.2 * s, 2.5 * s);
    }
  }
  // hair
  const style = look.hairStyle ?? 0;
  if (!skel && !look.helmet && pose.hat !== 'helm') {
    ctx.fillStyle = look.hair;
    const female = !!look.female;
    if (!(style === 3 && !female)) {
      ctx.beginPath();
      ctx.arc(0, headY - 1 * s, 5.9 * s, Math.PI, 0);
      ctx.fill();
      if (back) {
        ctx.fillRect(-5.9 * s, headY - 1 * s, 11.8 * s, 5 * s);
      } else ctx.fillRect(-5.9 * s, headY - 1.5 * s, 3 * s, 3.5 * s);
    }
    if (female) {
      if (style === 0) ctx.fillRect(-6 * s, headY - 1 * s, back ? 12 * s : 3.5 * s, 11 * s);
      if (style === 1) {
        ctx.beginPath();
        ctx.ellipse(-6 * s, headY + 2 * s, 2.4 * s, 5 * s, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (style === 2) ctx.fillRect(-6 * s, headY - 1 * s, back ? 12 * s : 3 * s, 5.5 * s);
      if (style === 3) {
        ctx.fillRect(-6.5 * s, headY, 2.4 * s, 12 * s);
        if (back) ctx.fillRect(4 * s, headY, 2.4 * s, 12 * s);
      }
    } else {
      if (style === 1) ctx.fillRect(-6 * s, headY - 1 * s, back ? 12 * s : 3 * s, 7 * s);
      if (style === 2) {
        ctx.beginPath();
        ctx.arc(-1 * s, headY - 7 * s, 2.5 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // headwear
  const hat = look.helmet ? 'helm' : pose.hat ?? (look.hood ? 'hood' : null);
  if (hat === 'helm') {
    ctx.fillStyle = look.helmet ?? '#9aa0aa';
    ctx.beginPath();
    ctx.arc(0, headY - 0.5 * s, 6.2 * s, Math.PI * 1.05, -0.05);
    ctx.fill();
    ctx.fillRect(-6.2 * s, headY - 1 * s, 12.4 * s, 2 * s);
    if (!back) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0.5 * s, headY - 0.5 * s, 5 * s, 1.2 * s);
    }
  } else if (hat === 'hood') {
    ctx.fillStyle = shade(look.tertiary === look.primary ? look.primary : look.primary, -0.15);
    ctx.beginPath();
    ctx.arc(0, headY - 0.5 * s, 6.6 * s, Math.PI * 0.95, Math.PI * 0.05);
    ctx.lineTo(6.6 * s, headY + 4 * s);
    ctx.lineTo(-6.6 * s, headY + 4 * s);
    ctx.fill();
    if (!back) {
      ctx.fillStyle = hurt ? '#fff' : skin;
      ctx.beginPath();
      ctx.arc(1.5 * s, headY + 0.5 * s, 4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(1.2 * s, headY - 0.5 * s, 1.4 * s, 1.5 * s);
      ctx.fillRect(3.6 * s, headY - 0.5 * s, 1.3 * s, 1.5 * s);
    }
  } else if (hat === 'wizard') {
    ctx.fillStyle = look.primary;
    ctx.beginPath();
    ctx.ellipse(0, headY - 3 * s, 9 * s, 2.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5 * s, headY - 4 * s);
    ctx.lineTo(5 * s, headY - 4 * s);
    ctx.lineTo(-2 * s, headY - 17 * s);
    ctx.fill();
    ctx.fillStyle = look.tertiary;
    ctx.fillRect(-5 * s, headY - 5.5 * s, 10 * s, 1.8 * s);
  }

  // weapon & offhand in front
  if (!back) {
    drawOffhand(ctx, pose.offhand === 'quiver' ? undefined : pose.offhand, -bodyW - 2 * s, -16 * s, s, true, look.primary);
    drawWeapon(ctx, pose.weapon, fx, fy, wAngle, s, pose.glow);
  }
  if (pose.offhand === 'quiver') drawOffhand(ctx, 'quiver', back ? 0 : -4 * s, -18 * s, s, false, look.primary);
  ctx.restore();
}

// ------------------------------------------------------------------ creatures

export interface CreaturePose {
  facing: number;
  walk: number;
  moving: boolean;
  attack: number;
  hurt: boolean;
  scale: number;
  alpha?: number;
  time: number;
}

export function drawQuadruped(ctx: Ctx, x: number, y: number, c1: string, c2: string, p: CreaturePose, kind: string): void {
  const s = p.scale;
  const sa = screenAngle(p.facing);
  const flip = Math.cos(sa) < 0 ? -1 : 1;
  const back = Math.sin(sa) < -0.3;
  const w = p.moving ? Math.sin(p.walk) : 0;
  ctx.save();
  if (p.alpha !== undefined) ctx.globalAlpha = p.alpha;
  shadow(ctx, x, y, 13 * s);
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  const lunge = p.attack > 0 ? Math.sin(p.attack * Math.PI) * 5 * s : 0;
  ctx.translate(lunge, 0);
  const body = p.hurt ? '#ffffff' : c1;
  const bulky = kind === 'bear' || kind === 'boar';
  const long = kind === 'giant_rat' ? 0.9 : 1;
  // legs
  ctx.strokeStyle = shade(c1, -0.3);
  ctx.lineWidth = (bulky ? 4 : 3) * s;
  ctx.lineCap = 'round';
  for (const [lx, ph] of [[-8, 0], [-4, Math.PI], [5, Math.PI], [9, 0]] as [number, number][]) {
    const sw = p.moving ? Math.sin(p.walk + ph) * 3 * s : 0;
    ctx.beginPath();
    ctx.moveTo(lx * s * long, -8 * s);
    ctx.lineTo(lx * s * long + sw, 0);
    ctx.stroke();
  }
  // body
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -12 * s - Math.abs(w) * s, (bulky ? 13 : 12) * s * long, (bulky ? 7.5 : 5.5) * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.ellipse(0, -9.5 * s, 9 * s * long, 2.5 * s, 0, 0, Math.PI);
  ctx.fill();
  // tail
  ctx.strokeStyle = body;
  ctx.lineWidth = (kind === 'giant_rat' ? 1.5 : 3) * s;
  ctx.beginPath();
  ctx.moveTo(-12 * s * long, -13 * s);
  ctx.quadraticCurveTo(-18 * s, -16 * s + w * 2 * s, -20 * s, kind === 'giant_rat' ? -6 * s : -18 * s);
  ctx.stroke();
  // head
  const hx = 13 * s * long;
  const hy = -15 * s;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(hx, hy, (bulky ? 6.5 : 5.5) * s, (bulky ? 5.5 : 4.5) * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hx + 5 * s, hy + 1.5 * s, 4 * s, 2.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // ears
  if (kind !== 'boar') {
    ctx.beginPath();
    ctx.moveTo(hx - 2 * s, hy - 3 * s);
    ctx.lineTo(hx - 1 * s, hy - 9 * s);
    ctx.lineTo(hx + 2 * s, hy - 4 * s);
    ctx.fill();
  }
  if (kind === 'boar') {
    ctx.fillStyle = '#f0ead0';
    ctx.beginPath();
    ctx.moveTo(hx + 6 * s, hy + 3 * s);
    ctx.lineTo(hx + 9 * s, hy - 2 * s);
    ctx.lineTo(hx + 7.5 * s, hy + 3.5 * s);
    ctx.fill();
  }
  if (kind === 'hellhound' || kind === 'spirit_wolf') {
    ctx.fillStyle = c2;
    ctx.globalAlpha *= 0.6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-6 * s + i * 4 * s, -18 * s - Math.sin(p.time * 8 + i) * 2 * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = p.alpha ?? 1;
  }
  if (!back) {
    ctx.fillStyle = kind === 'hellhound' ? '#ffcc30' : kind === 'spirit_wolf' ? '#ffffff' : '#200';
    ctx.fillRect(hx + 1.5 * s, hy - 1.5 * s, 1.8 * s, 1.8 * s);
  }
  ctx.restore();
}

export function drawSpider(ctx: Ctx, x: number, y: number, c1: string, c2: string, p: CreaturePose): void {
  const s = p.scale;
  ctx.save();
  if (p.alpha !== undefined) ctx.globalAlpha = p.alpha;
  shadow(ctx, x, y, 14 * s);
  ctx.translate(x, y);
  const body = p.hurt ? '#ffffff' : c1;
  ctx.strokeStyle = shade(c1, -0.2);
  ctx.lineWidth = 2 * s;
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const ph = p.moving ? Math.sin(p.walk + i * 1.3 + (side > 0 ? Math.PI : 0)) * 2.5 * s : 0;
      const bx = side * 4 * s;
      const by = -9 * s + (i - 1.5) * 2 * s;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(side * (12 + i) * s, by - 6 * s + ph);
      ctx.lineTo(side * (16 + i * 1.5) * s, (i - 1.5) * 3 * s + ph);
      ctx.stroke();
    }
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-2 * s, -11 * s, 8 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6 * s, -9 * s, 5 * s, 4.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.moveTo(-2 * s, -16 * s);
  ctx.lineTo(1 * s, -11 * s);
  ctx.lineTo(-2 * s, -6 * s);
  ctx.lineTo(-5 * s, -11 * s);
  ctx.fill();
  ctx.fillStyle = '#ff3030';
  for (let i = 0; i < 4; i++) ctx.fillRect(7 * s + (i % 2) * 2 * s, -11 * s + Math.floor(i / 2) * 2 * s, 1.2 * s, 1.2 * s);
  ctx.restore();
}

export function drawGhost(ctx: Ctx, x: number, y: number, c1: string, c2: string, p: CreaturePose): void {
  const s = p.scale;
  const fl = Math.sin(p.time * 3) * 3 * s;
  ctx.save();
  ctx.globalAlpha = (p.alpha ?? 1) * 0.8;
  shadow(ctx, x, y, 9 * s, 0.2);
  ctx.translate(x, y - 8 * s + fl);
  const g = ctx.createLinearGradient(0, -30 * s, 0, 4 * s);
  g.addColorStop(0, p.hurt ? '#fff' : c1);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-9 * s, -14 * s);
  ctx.quadraticCurveTo(-10 * s, -32 * s, 0, -32 * s);
  ctx.quadraticCurveTo(10 * s, -32 * s, 9 * s, -14 * s);
  for (let i = 0; i <= 6; i++) ctx.lineTo(9 * s - i * 3 * s, 4 * s + Math.sin(p.time * 6 + i) * 2 * s);
  ctx.fill();
  ctx.fillStyle = c2;
  ctx.fillRect(-4 * s, -25 * s, 2.5 * s, 3 * s);
  ctx.fillRect(2 * s, -25 * s, 2.5 * s, 3 * s);
  ctx.fillStyle = '#c0f0ff';
  ctx.fillRect(-3.5 * s, -24.5 * s, 1.2 * s, 1.2 * s);
  ctx.fillRect(2.5 * s, -24.5 * s, 1.2 * s, 1.2 * s);
  ctx.restore();
}

export function drawGolem(ctx: Ctx, x: number, y: number, c1: string, c2: string, p: CreaturePose): void {
  const s = p.scale;
  const w = p.moving ? Math.sin(p.walk) * 2 * s : 0;
  ctx.save();
  if (p.alpha !== undefined) ctx.globalAlpha = p.alpha;
  shadow(ctx, x, y, 14 * s);
  ctx.translate(x, y);
  const body = p.hurt ? '#ffffff' : c1;
  ctx.fillStyle = shade(c1, -0.25);
  ctx.fillRect(-9 * s + w, -10 * s, 6 * s, 10 * s);
  ctx.fillRect(3 * s - w, -10 * s, 6 * s, 10 * s);
  ctx.fillStyle = body;
  ctx.fillRect(-11 * s, -30 * s, 22 * s, 20 * s);
  ctx.fillStyle = shade(c1, -0.15);
  ctx.fillRect(0, -30 * s, 11 * s, 20 * s);
  const lift = p.attack > 0 ? Math.sin(p.attack * Math.PI) * 8 * s : 0;
  ctx.fillStyle = body;
  ctx.fillRect(-17 * s, -29 * s - lift, 6 * s, 16 * s);
  ctx.fillRect(11 * s, -29 * s - lift, 6 * s, 16 * s);
  ctx.fillRect(-6 * s, -38 * s, 12 * s, 8 * s);
  ctx.fillStyle = c2;
  ctx.fillRect(-4 * s, -35 * s, 2.5 * s, 2 * s);
  ctx.fillRect(1.5 * s, -35 * s, 2.5 * s, 2 * s);
  ctx.strokeStyle = c2;
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(-6 * s, -26 * s);
  ctx.lineTo(-1 * s, -20 * s);
  ctx.lineTo(3 * s, -24 * s);
  ctx.lineTo(7 * s, -15 * s);
  ctx.stroke();
  ctx.restore();
}

export function drawDrake(ctx: Ctx, x: number, y: number, c1: string, c2: string, p: CreaturePose): void {
  const s = p.scale;
  const sa = screenAngle(p.facing);
  const flip = Math.cos(sa) < 0 ? -1 : 1;
  const flap = Math.sin(p.time * 5) * 0.4;
  ctx.save();
  if (p.alpha !== undefined) ctx.globalAlpha = p.alpha;
  shadow(ctx, x, y, 16 * s);
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  const body = p.hurt ? '#ffffff' : c1;
  // wings
  ctx.fillStyle = shade(c1, -0.3);
  ctx.beginPath();
  ctx.moveTo(-2 * s, -20 * s);
  ctx.lineTo(-14 * s, -38 * s - flap * 10 * s);
  ctx.lineTo(-20 * s, -22 * s);
  ctx.lineTo(-8 * s, -16 * s);
  ctx.fill();
  // legs
  ctx.strokeStyle = shade(c1, -0.2);
  ctx.lineWidth = 3.5 * s;
  const w = p.moving ? Math.sin(p.walk) * 3 * s : 0;
  ctx.beginPath();
  ctx.moveTo(-6 * s, -10 * s);
  ctx.lineTo(-6 * s + w, 0);
  ctx.moveTo(6 * s, -10 * s);
  ctx.lineTo(6 * s - w, 0);
  ctx.stroke();
  // tail
  ctx.strokeStyle = body;
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(-10 * s, -12 * s);
  ctx.quadraticCurveTo(-22 * s, -10 * s, -26 * s, -2 * s);
  ctx.stroke();
  // body
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -14 * s, 12 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.ellipse(0, -11 * s, 9 * s, 3 * s, 0, 0, Math.PI);
  ctx.fill();
  // neck & head
  const lunge = p.attack > 0 ? Math.sin(p.attack * Math.PI) * 4 * s : 0;
  ctx.strokeStyle = body;
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  ctx.moveTo(8 * s, -16 * s);
  ctx.quadraticCurveTo(12 * s, -26 * s, 16 * s + lunge, -26 * s);
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(18 * s + lunge, -27 * s, 6 * s, 3.5 * s, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.moveTo(14 * s + lunge, -30 * s);
  ctx.lineTo(12 * s + lunge, -36 * s);
  ctx.lineTo(17 * s + lunge, -30 * s);
  ctx.fill();
  ctx.fillStyle = '#ffd030';
  ctx.fillRect(19 * s + lunge, -29 * s, 1.8 * s, 1.5 * s);
  // front wing
  ctx.fillStyle = shade(c1, -0.1);
  ctx.beginPath();
  ctx.moveTo(2 * s, -20 * s);
  ctx.lineTo(-6 * s, -42 * s + flap * 10 * s);
  ctx.lineTo(-14 * s, -24 * s);
  ctx.lineTo(-2 * s, -16 * s);
  ctx.fill();
  ctx.restore();
}

export function drawImp(ctx: Ctx, x: number, y: number, c1: string, c2: string, p: CreaturePose): void {
  const s = p.scale;
  const hover = Math.sin(p.time * 6) * 2 * s;
  ctx.save();
  if (p.alpha !== undefined) ctx.globalAlpha = p.alpha;
  shadow(ctx, x, y, 8 * s, 0.25);
  ctx.translate(x, y - 10 * s + hover);
  const body = p.hurt ? '#ffffff' : c1;
  ctx.fillStyle = shade(c1, -0.3);
  const fl = Math.sin(p.time * 18) * 4 * s;
  ctx.beginPath();
  ctx.moveTo(0, -14 * s);
  ctx.lineTo(-14 * s, -22 * s + fl);
  ctx.lineTo(-6 * s, -10 * s);
  ctx.moveTo(0, -14 * s);
  ctx.lineTo(14 * s, -22 * s + fl);
  ctx.lineTo(6 * s, -10 * s);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -10 * s, 5 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -20 * s, 4.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.moveTo(-3 * s, -23 * s);
  ctx.lineTo(-5 * s, -28 * s);
  ctx.lineTo(-1 * s, -24 * s);
  ctx.moveTo(3 * s, -23 * s);
  ctx.lineTo(5 * s, -28 * s);
  ctx.lineTo(1 * s, -24 * s);
  ctx.fill();
  ctx.fillRect(-2.5 * s, -21 * s, 1.5 * s, 1.5 * s);
  ctx.fillRect(1 * s, -21 * s, 1.5 * s, 1.5 * s);
  ctx.restore();
}

export function drawTreant(ctx: Ctx, x: number, y: number, c1: string, c2: string, p: CreaturePose): void {
  const s = p.scale;
  const w = p.moving ? Math.sin(p.walk) * 2 * s : 0;
  ctx.save();
  if (p.alpha !== undefined) ctx.globalAlpha = p.alpha;
  shadow(ctx, x, y, 14 * s);
  ctx.translate(x, y);
  const bark = p.hurt ? '#ffffff' : c1;
  ctx.fillStyle = shade(c1, -0.2);
  ctx.fillRect(-8 * s + w, -10 * s, 5 * s, 10 * s);
  ctx.fillRect(3 * s - w, -10 * s, 5 * s, 10 * s);
  ctx.fillStyle = bark;
  ctx.beginPath();
  ctx.moveTo(-9 * s, -8 * s);
  ctx.lineTo(9 * s, -8 * s);
  ctx.lineTo(7 * s, -34 * s);
  ctx.lineTo(-7 * s, -34 * s);
  ctx.fill();
  const lift = p.attack > 0 ? Math.sin(p.attack * Math.PI) * 10 * s : 0;
  ctx.strokeStyle = bark;
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(-7 * s, -28 * s);
  ctx.lineTo(-16 * s, -18 * s - lift);
  ctx.moveTo(7 * s, -28 * s);
  ctx.lineTo(16 * s, -18 * s - lift);
  ctx.stroke();
  ctx.fillStyle = c2;
  for (const [cx, cy, r] of [[0, -42, 11], [-9, -36, 7], [9, -36, 7], [0, -50, 7]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.arc(cx * s, cy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffe080';
  ctx.fillRect(-3.5 * s, -27 * s, 2 * s, 2 * s);
  ctx.fillRect(1.5 * s, -27 * s, 2 * s, 2 * s);
  ctx.restore();
}
