// Isometric canvas renderer.

import { HALF_H, HALF_W, clamp, isoToScreen, screenToIso } from '../core/math';
import { GEAR_BASES, RARITY_COLORS } from '../data/items';
import { NODES } from '../data/lifeskills';
import { T_DARK, T_DEEP, T_FLOOR, T_GRASS, T_PATH, T_PLAZA, T_SAND, T_WATER, type Prop } from '../world/map';
import type { World } from '../world/world';
import { projColor } from '../world/world';
import { Mob, type GroundEffect, type Projectile } from '../world/entities';
import {
  drawBuilding, drawCampfire, drawFishSpot, drawHerb, drawRock, drawSmallProp, drawTree, drawWall, drawWaystone,
} from './props';
import {
  drawDrake, drawGhost, drawGolem, drawHumanoid, drawImp, drawQuadruped, drawSpider, drawTreant, shade, type Ctx, type HumanoidPose,
} from './sprites';
import type { CharacterData } from '../types';

function hash2(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

interface Drawable {
  depth: number;
  fn: () => void;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: Ctx;
  dpr = 1;
  w = 0;
  h = 0;
  zoom = 1;
  camX = 0;
  camY = 0;
  private ox = 0;
  private oy = 0;
  userZoom = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.zoom = clamp(Math.min(this.w, this.h) / 430, 0.7, 1.7) * this.userZoom;
  }

  snapCamera(x: number, y: number): void {
    this.camX = x;
    this.camY = y;
  }

  /** world tile coords -> CSS pixel coords on the canvas */
  worldToScreen(x: number, y: number): { x: number; y: number } {
    const s = isoToScreen(x, y);
    return { x: s.x * this.zoom + this.ox, y: s.y * this.zoom + this.oy };
  }

  render(w: World, dt: number, shakeEnabled: boolean): void {
    const ctx = this.ctx;
    const p = w.player;
    const k = 1 - Math.pow(0.0015, dt);
    this.camX += (p.x - this.camX) * k;
    this.camY += (p.y - this.camY) * k;
    const cam = isoToScreen(this.camX, this.camY);
    let sx = 0;
    let sy = 0;
    if (shakeEnabled && w.shake > 0) {
      sx = (Math.random() - 0.5) * w.shake * 14;
      sy = (Math.random() - 0.5) * w.shake * 14;
    }
    this.ox = this.w / 2 - cam.x * this.zoom + sx;
    this.oy = this.h / 2 - cam.y * this.zoom + 22 * this.zoom + sy;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = w.map.biome.edge;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.setTransform(this.dpr * this.zoom, 0, 0, this.dpr * this.zoom, this.dpr * this.ox, this.dpr * this.oy);

    const view = {
      l: -this.ox / this.zoom - 80,
      r: (this.w - this.ox) / this.zoom + 80,
      t: -this.oy / this.zoom - 120,
      b: (this.h - this.oy) / this.zoom + 60,
    };
    this.drawGround(w, view);
    this.drawExits(w);
    for (const g of w.grounds) this.drawGroundEffect(g, w.time);
    this.drawInteractionMarker(w);

    // ------------------------------------------------ sorted scene
    const list: Drawable[] = [];
    const inView = (x: number, y: number, m = 0) => x > view.l - m && x < view.r + m && y > view.t - m && y < view.b + m + 80;
    for (const pr of w.map.props) {
      const s = isoToScreen(pr.x, pr.y);
      const big = pr.kind === 'building' ? 300 : pr.kind === 'fountain' ? 80 : 0;
      if (!inView(s.x, s.y, big)) continue;
      list.push({ depth: pr.depth, fn: () => this.drawProp(pr, s.x, s.y, w.time) });
    }
    const zs = w.session.zoneState(w.zoneId);
    for (const n of w.map.nodes) {
      const s = isoToScreen(n.x, n.y);
      if (!inView(s.x, s.y)) continue;
      const depleted = w.nodeDepleted(n.id, zs.depleted);
      const def = NODES[n.nodeId];
      const fish = def.skill === 'fishing';
      list.push({
        depth: fish ? -1e6 + n.x + n.y : n.x + n.y,
        fn: () => {
          if (def.skill === 'woodcutting') drawTree(this.ctx, s.x, s.y, n.variant || 'oak', Math.floor(n.x * 31 + n.y * 17), w.time, depleted);
          else if (def.skill === 'mining') drawRock(this.ctx, s.x, s.y, Math.floor(n.x * 13 + n.y * 7), '#7a746c', def.color, depleted);
          else if (fish) drawFishSpot(this.ctx, s.x, s.y, w.time, n.x * 3 + n.y, depleted);
          else drawHerb(this.ctx, s.x, s.y, def.color, Math.floor(n.x * 11 + n.y * 5), w.time, depleted);
        },
      });
    }
    if (w.map.waystone && !w.map.isTown) {
      const ws = w.map.waystone;
      const s = isoToScreen(ws.x, ws.y);
      list.push({ depth: ws.x + ws.y, fn: () => drawWaystone(this.ctx, s.x, s.y, w.time, w.session.data.world.waystones.includes(w.zoneId)) });
    }
    if (w.map.isTown && w.map.waystone) {
      const ws = w.map.waystone;
      const s = isoToScreen(ws.x, ws.y);
      list.push({ depth: ws.x + ws.y, fn: () => drawWaystone(this.ctx, s.x, s.y, w.time, true) });
    }
    for (const f of w.campfires) {
      const s = isoToScreen(f.x, f.y);
      list.push({ depth: f.x + f.y - 0.2, fn: () => drawCampfire(this.ctx, s.x, s.y, w.time) });
    }
    for (const pk of w.pickups) {
      const s = isoToScreen(pk.x, pk.y);
      if (!inView(s.x, s.y)) continue;
      list.push({ depth: pk.x + pk.y - 0.3, fn: () => this.drawPickup(pk, s.x, s.y - pk.z * 16, w.time) });
    }
    for (const n of w.npcs) {
      const s = isoToScreen(n.x, n.y);
      if (!inView(s.x, s.y)) continue;
      list.push({ depth: n.x + n.y, fn: () => this.drawNpc(w, n, s.x, s.y) });
    }
    for (const m of w.mobs) {
      const s = isoToScreen(m.x, m.y);
      if (!inView(s.x, s.y, 40)) continue;
      list.push({ depth: m.x + m.y, fn: () => this.drawMob(w, m, s.x, s.y) });
    }
    if (!w.player.dead || w.time - w.player.deathTime < 1.5) {
      const s = isoToScreen(p.x, p.y);
      list.push({ depth: p.x + p.y, fn: () => this.drawPlayer(w, s.x, s.y) });
    }
    for (const pr of w.projectiles) {
      const s = isoToScreen(pr.x, pr.y);
      list.push({ depth: pr.x + pr.y, fn: () => this.drawProjectile(pr, s.x, s.y, w.time) });
    }
    list.sort((a, b) => a.depth - b.depth);
    for (const d of list) d.fn();

    this.drawFx(w);
    this.drawOverheads(w);

    // ------------------------------------------------ atmosphere
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const b = w.map.biome;
    ctx.fillStyle = b.ambient;
    ctx.fillRect(0, 0, this.w, this.h);
    if (b.fog) {
      ctx.fillStyle = b.fog;
      for (let i = 0; i < 5; i++) {
        const fx = ((w.time * 12 + i * 260) % (this.w + 400)) - 200;
        const fy = (i * 137) % this.h;
        ctx.beginPath();
        ctx.ellipse(fx, fy, 220, 70, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const lowHp = w.char.hp / w.session.derived.maxHp;
    const vg = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, lowHp < 0.3 && !p.dead ? `rgba(120,0,0,${0.55 + Math.sin(w.time * 6) * 0.15})` : 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  // ------------------------------------------------------------- ground

  private tileColor(w: World, t: number, sh: number): string {
    const b = w.map.biome;
    switch (t) {
      case T_GRASS:
        return b.ground[sh] ?? b.ground[0];
      case T_PATH:
        return sh % 2 ? b.path : shade(b.path, -0.04);
      case T_WATER:
        return b.water;
      case T_DEEP:
        return b.waterDeep;
      case T_SAND:
        return b.sand;
      case T_PLAZA:
        return sh % 2 ? '#a8a090' : '#b2aa98';
      case T_DARK:
        return b.edge;
      case T_FLOOR:
        return '#8a7a60';
      default:
        return b.ground[0];
    }
  }

  private drawGround(w: World, view: { l: number; r: number; t: number; b: number }): void {
    const ctx = this.ctx;
    const m = w.map;
    const corners = [screenToIso(view.l, view.t), screenToIso(view.r, view.t), screenToIso(view.l, view.b), screenToIso(view.r, view.b)];
    const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.x))) - 1);
    const x1 = Math.min(m.w - 1, Math.ceil(Math.max(...corners.map((c) => c.x))) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.y))) - 1);
    const y1 = Math.min(m.h - 1, Math.ceil(Math.max(...corners.map((c) => c.y))) + 1);
    const paths = new Map<string, Path2D>();
    const tufts = new Path2D();
    const pebbles = new Path2D();
    const shimmer = new Path2D();
    const grid = new Path2D();
    const hw = HALF_W + 0.6;
    const hh = HALF_H + 0.4;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cx = (x - y) * HALF_W;
        const cy = (x + y + 1) * HALF_H;
        if (cx < view.l - 40 || cx > view.r + 40 || cy < view.t - 20 || cy > view.b + 20) continue;
        const i = y * m.w + x;
        const t = m.tiles[i];
        const col = this.tileColor(w, t, m.shade[i]);
        let pth = paths.get(col);
        if (!pth) paths.set(col, (pth = new Path2D()));
        pth.moveTo(cx, cy - hh);
        pth.lineTo(cx + hw, cy);
        pth.lineTo(cx, cy + hh);
        pth.lineTo(cx - hw, cy);
        pth.closePath();
        const hsh = hash2(x, y);
        if (t === T_GRASS && hsh < 0.45) {
          const tx = cx + (hsh - 0.22) * 40;
          const ty = cy + (hash2(y, x) - 0.5) * 12;
          tufts.moveTo(tx - 3, ty);
          tufts.lineTo(tx - 1, ty - 5);
          tufts.moveTo(tx, ty);
          tufts.lineTo(tx + 1, ty - 6);
          tufts.moveTo(tx + 3, ty);
          tufts.lineTo(tx + 4, ty - 4);
        } else if (t === T_PATH && hsh < 0.3) {
          const tx = cx + (hsh - 0.15) * 50;
          const ty = cy + (hash2(y, x) - 0.5) * 10;
          pebbles.moveTo(tx + 2, ty);
          pebbles.arc(tx, ty, 2, 0, Math.PI * 2);
        } else if ((t === T_WATER || t === T_DEEP) && hsh < 0.35) {
          const ph = Math.sin(w.time * 1.5 + hsh * 20);
          const tx = cx + ph * 6;
          shimmer.moveTo(tx - 6, cy + (hsh - 0.17) * 20);
          shimmer.lineTo(tx + 6, cy + (hsh - 0.17) * 20);
        } else if (t === T_PLAZA) {
          grid.moveTo(cx, cy - HALF_H);
          grid.lineTo(cx + HALF_W, cy);
          grid.lineTo(cx, cy + HALF_H);
        }
      }
    }
    for (const [col, pth] of paths) {
      ctx.fillStyle = col;
      ctx.fill(pth);
    }
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(20,50,10,0.35)';
    ctx.stroke(tufts);
    ctx.fillStyle = 'rgba(80,60,40,0.35)';
    ctx.fill(pebbles);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke(shimmer);
    ctx.strokeStyle = 'rgba(60,50,40,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke(grid);
  }

  private drawExits(w: World): void {
    const ctx = this.ctx;
    for (const e of w.map.exits) {
      const cx = (e.x0 + e.x1) / 2;
      const cy = (e.y0 + e.y1) / 2;
      const s = isoToScreen(cx, cy);
      const unlocked = w.session.isZoneUnlocked(e.to);
      const pulse = 0.5 + Math.sin(w.time * 3) * 0.3;
      ctx.fillStyle = unlocked ? `rgba(255,230,140,${pulse * 0.5})` : `rgba(255,80,60,${pulse * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 50, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 12px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const label = unlocked ? e.label : `${e.label} (sealed)`;
      ctx.fillText(label, s.x + 1, s.y - 29);
      ctx.fillStyle = unlocked ? '#ffe9a0' : '#ff9a8a';
      ctx.fillText(label, s.x, s.y - 30);
      ctx.textAlign = 'left';
    }
  }

  private drawInteractionMarker(w: World): void {
    const i = w.interaction;
    if (!i) return;
    const s = isoToScreen(i.x, i.y);
    const ctx = this.ctx;
    ctx.strokeStyle = `rgba(255,230,120,${0.6 + Math.sin(w.time * 6) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, 20, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawProp(p: Prop, x: number, y: number, time: number): void {
    const ctx = this.ctx;
    switch (p.kind) {
      case 'tree':
        drawTree(ctx, x, y, p.label ?? 'oak', p.seed, time);
        break;
      case 'building':
        drawBuilding(ctx, p);
        break;
      case 'wall':
        drawWall(ctx, p, false);
        break;
      case 'tower':
        drawWall(ctx, p, true);
        break;
      default:
        drawSmallProp(ctx, p, x, y, time);
    }
  }

  // ------------------------------------------------------------- actors

  private playerPose(w: World, c: CharacterData): { look: any; pose: HumanoidPose } {
    const p = w.player;
    const d = w.session.derived;
    const app = c.appearance;
    const head = c.equipment.head ? GEAR_BASES[c.equipment.head.id] : undefined;
    const chest = c.equipment.chest ? GEAR_BASES[c.equipment.chest.id] : undefined;
    const main = c.equipment.mainhand;
    const metal = (ilvl: number) => ['#8a6a4a', '#c87533', '#9aa0aa', '#c8ccd4', '#8ab8e0', '#5ad09a', '#e05a3a'][Math.min(6, Math.floor((ilvl + 1) / 5))];
    const hat: HumanoidPose['hat'] = head ? (head.armorType === 'plate' ? 'helm' : head.armorType === 'leather' ? 'hood' : 'wizard') : null;
    const look = {
      skin: app.skin, hair: app.hair, hairStyle: app.hairStyle, primary: app.primary, secondary: app.secondary, tertiary: app.tertiary,
      female: app.gender === 'female',
      helmet: hat === 'helm' ? metal(c.equipment.head!.ilvl ?? 1) : undefined,
    };
    const pose: HumanoidPose = {
      facing: p.facing,
      walk: p.walkPhase,
      moving: p.moving,
      attack: p.attackAnim > 0 ? 1 - p.attackAnim / p.attackAnimDur : 0,
      hurt: p.flash > 0,
      scale: 1.05,
      weapon: d.weapon ?? undefined,
      offhand: d.offhand ?? undefined,
      hat: hat === 'helm' ? null : hat,
      shoulders: chest?.armorType === 'plate' ? metal(c.equipment.chest!.ilvl ?? 1) : null,
      cape: true,
      glow: main && (main.rarity ?? 0) >= 2 ? RARITY_COLORS[main.rarity ?? 0] : null,
      spin: p.spin ? p.spinAngle : 0,
      alpha: p.invuln > 0 && !p.dash ? 0.6 : 1,
    };
    return { look, pose };
  }

  private drawPlayer(w: World, x: number, y: number): void {
    const ctx = this.ctx;
    const p = w.player;
    const c = w.char;
    if (p.dead) {
      const t = Math.min(1, (w.time - p.deathTime) / 1);
      ctx.save();
      ctx.globalAlpha = 1 - t * 0.7;
      ctx.translate(x, y);
      ctx.rotate(t * 1.3);
      ctx.translate(-x, -y);
    }
    if (p.manaShield) {
      ctx.fillStyle = `rgba(90,160,255,${0.18 + Math.sin(w.time * 5) * 0.06})`;
      ctx.beginPath();
      ctx.ellipse(x, y - 18, 18, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const { look, pose } = this.playerPose(w, c);
    drawHumanoid(ctx, x, y, look, pose);
    this.statusFx(w, p, x, y);
    if (p.dead) ctx.restore();
    if (p.channel) {
      const t = p.channel.time / p.channel.total;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - 22, y - 62, 44, 6);
      ctx.fillStyle = p.channel.kind === 'recall' ? '#7ad8ff' : '#ffd060';
      ctx.fillRect(x - 21, y - 61, 42 * t, 4);
      // gathering animation: tool swing
      if (p.channel.kind === 'gather') {
        p.attackAnim = (Math.sin(w.time * 8) + 1) * 0.15;
        p.attackAnimDur = 0.3;
      }
    }
  }

  private drawNpc(w: World, n: import('../world/entities').Npc, x: number, y: number): void {
    const ctx = this.ctx;
    n.bob += 0.016;
    drawHumanoid(ctx, x, y, n.def.look, {
      facing: n.facing, walk: 0, moving: false, attack: 0, hurt: false, scale: 1.05,
      weapon: n.def.look.weapon, offhand: n.def.look.offhand, cape: n.def.id === 'guildmaster',
    });
    // quest markers
    const s = w.session;
    let mark = '';
    const qs = s.questsFor(n.def.id);
    if (qs.some((q) => s.questStatus(q.id) === 'ready')) mark = '?';
    else if (qs.some((q) => s.questStatus(q.id) === 'available')) mark = '!';
    if (n.def.id === 'bounty' && s.activeBounties().some((b) => s.bountyReady(b))) mark = '?';
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(n.def.name, x + 1, y - 51);
    ctx.fillStyle = '#ffe9a0';
    ctx.fillText(n.def.name, x, y - 52);
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#d8d0b8';
    ctx.fillText(n.def.title, x, y - 42);
    if (mark) {
      const by = y - 70 + Math.sin(w.time * 4) * 3;
      ctx.font = 'bold 22px Georgia, serif';
      ctx.fillStyle = '#000';
      ctx.fillText(mark, x + 1, by + 1);
      ctx.fillStyle = '#ffd040';
      ctx.fillText(mark, x, by);
    }
    ctx.textAlign = 'left';
  }

  private drawMob(w: World, m: Mob, x: number, y: number): void {
    const ctx = this.ctx;
    const def = m.def;
    let alpha = 1;
    let sink = 0;
    if (m.dead) {
      const t = (w.time - m.deathTime) / 1.2;
      alpha = Math.max(0, 1 - t);
      sink = t * 6;
    }
    // auras
    if (!m.dead && (m.elite || m.boss || m.bountyId)) {
      const col = m.boss ? 'rgba(255,60,40,' : m.bountyId ? 'rgba(255,200,60,' : 'rgba(255,220,120,';
      ctx.fillStyle = col + (0.25 + Math.sin(w.time * 4) * 0.08) + ')';
      ctx.beginPath();
      ctx.ellipse(x, y, 22 * m.size, 10 * m.size, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (m.team === 0 && !m.dead) {
      ctx.strokeStyle = 'rgba(100,180,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y, 14 * m.size, 6.5 * m.size, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // telegraphs
    if (m.windup && !m.dead) {
      const t = 1 - m.windup.time / m.windup.total;
      if (m.windup.kind === 'charge') {
        const tgt = isoToScreen(m.windup.tx, m.windup.ty);
        ctx.strokeStyle = `rgba(255,60,40,${0.3 + t * 0.5})`;
        ctx.lineWidth = 6 * m.size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.stroke();
      } else if (m.windup.kind === 'breath') {
        const a = m.windup.angle;
        ctx.fillStyle = `rgba(255,100,30,${0.15 + t * 0.25})`;
        ctx.beginPath();
        const p0 = isoToScreen(m.x, m.y);
        ctx.moveTo(p0.x, p0.y);
        for (let k = -6; k <= 6; k++) {
          const aa = a + (k / 6) * 0.65;
          const q = isoToScreen(m.x + Math.cos(aa) * 4.2, m.y + Math.sin(aa) * 4.2);
          ctx.lineTo(q.x, q.y);
        }
        ctx.fill();
      }
    }
    const pose = {
      facing: m.facing,
      walk: m.walkPhase,
      moving: m.moving,
      attack: m.attackAnim > 0 ? 1 - m.attackAnim / m.attackAnimDur : 0,
      hurt: m.flash > 0,
      scale: m.size,
      alpha,
      time: w.time + m.bob,
    };
    let c1 = def.color;
    if (m.has('slow') || m.has('stun')) c1 = shade(c1, 0.3);
    if (m.enraged) c1 = shade(c1, -0.1);
    const yy = y + sink;
    switch (def.body) {
      case 'quadruped':
        drawQuadruped(ctx, x, yy, c1, def.color2, pose, def.id === 'grizzlemaw' ? 'wolf' : def.id);
        break;
      case 'spider':
        drawSpider(ctx, x, yy, c1, def.color2, pose);
        break;
      case 'ghost':
        drawGhost(ctx, x, yy, c1, def.color2, pose);
        break;
      case 'golem':
        drawGolem(ctx, x, yy, c1, def.color2, pose);
        break;
      case 'drake':
        drawDrake(ctx, x, yy, c1, def.color2, pose);
        break;
      case 'imp':
        drawImp(ctx, x, yy, c1, def.color2, pose);
        break;
      case 'treant':
        drawTreant(ctx, x, yy, c1, def.color2, pose);
        break;
      default: {
        const look = def.look!;
        drawHumanoid(ctx, x, yy, look, {
          facing: m.facing, walk: m.walkPhase, moving: m.moving, attack: pose.attack, hurt: pose.hurt,
          scale: def.size * (m.elite ? 1.15 : 1) / (look.bulk ?? 1) * (look.bulk ?? 1), weapon: look.weapon, offhand: look.offhand,
          alpha, glow: m.boss ? def.color2 : null, cape: m.boss,
        });
      }
    }
    if (!m.dead) this.statusFx(w, m, x, y);
  }

  private statusFx(w: World, a: import('../world/entities').Actor, x: number, y: number): void {
    const ctx = this.ctx;
    if (a.has('stun')) {
      for (let i = 0; i < 3; i++) {
        const ang = w.time * 5 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = '#ffe060';
        ctx.fillRect(x + Math.cos(ang) * 10 - 2, y - 48 + Math.sin(ang) * 3, 4, 4);
      }
    }
    if (a.has('root')) {
      ctx.strokeStyle = '#5a8a2a';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 8 + i * 5, y + 2);
        ctx.quadraticCurveTo(x - 10 + i * 6, y - 10, x - 6 + i * 4, y - 16);
        ctx.stroke();
      }
    }
    if (a.has('burn') && Math.random() < 0.5) w.particles.push({ x: a.x + (Math.random() - 0.5) * 0.4, y: a.y, z: 1, vx: 0, vy: 0, vz: 2, life: 0.4, max: 0.4, color: '#ff8a2a', size: 3, gravity: -2 });
    if (a.has('poison') && Math.random() < 0.3) w.particles.push({ x: a.x + (Math.random() - 0.5) * 0.4, y: a.y, z: 1.2, vx: 0, vy: 0, vz: 1, life: 0.6, max: 0.6, color: '#7ae04a', size: 3, gravity: -1 });
    if (a.has('bleed') && Math.random() < 0.3) w.particles.push({ x: a.x, y: a.y, z: 1, vx: (Math.random() - 0.5), vy: 0, vz: 1, life: 0.5, max: 0.5, color: '#c02020', size: 2.5, gravity: 8 });
    if (a.has('vulnerable')) {
      ctx.strokeStyle = 'rgba(255,80,80,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y - 56, 5, 0, Math.PI * 2);
      ctx.moveTo(x - 8, y - 56);
      ctx.lineTo(x + 8, y - 56);
      ctx.moveTo(x, y - 64);
      ctx.lineTo(x, y - 48);
      ctx.stroke();
    }
  }

  private drawPickup(pk: import('../world/entities').Pickup, x: number, y: number, time: number): void {
    const ctx = this.ctx;
    if (pk.satchel) {
      ctx.fillStyle = `rgba(255,220,100,${0.3 + Math.sin(time * 3) * 0.15})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 20, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5230';
      ctx.beginPath();
      ctx.ellipse(x, y - 6, 9, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(x - 4, y - 16, 8, 4);
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe080';
      ctx.fillText('Lost Satchel', x, y - 22);
      ctx.textAlign = 'left';
      return;
    }
    if (!pk.item) {
      ctx.fillStyle = '#d9a020';
      for (let i = 0; i < Math.min(5, 1 + Math.floor(pk.gold / 10)); i++) {
        ctx.beginPath();
        ctx.ellipse(x + (i % 3) * 4 - 4, y - 2 - Math.floor(i / 3) * 3, 3.5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe080';
      ctx.fillRect(x - 3, y - 4, 2, 1);
      return;
    }
    const it = pk.item;
    const rarity = it.rarity ?? 0;
    const gear = !!GEAR_BASES[it.id];
    const col = gear ? RARITY_COLORS[rarity] : '#e0e0e0';
    if (gear && rarity >= 2) {
      const g = ctx.createLinearGradient(x, y - 70, x, y);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, col);
      ctx.globalAlpha = 0.35 + Math.sin(time * 4) * 0.1;
      ctx.fillStyle = g;
      ctx.fillRect(x - 3, y - 70, 6, 70);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = gear ? shade(col, -0.35) : '#8a6a4a';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(x - 6, y - 12, 12, 10);
    ctx.fill();
    ctx.stroke();
    if (gear && rarity >= 1) {
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = col;
      ctx.fillText(it.name ?? '', x, y - 18);
      ctx.textAlign = 'left';
    }
  }

  private drawProjectile(pr: Projectile, x: number, y: number, time: number): void {
    const ctx = this.ctx;
    const z = 18;
    const a = Math.atan2((pr.vx + pr.vy) * 0.5, pr.vx - pr.vy);
    const col = projColor(pr.visual);
    ctx.save();
    ctx.translate(x, y - z);
    switch (pr.visual) {
      case 'arrow':
        ctx.rotate(a);
        ctx.strokeStyle = '#d8c8a0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();
        ctx.fillStyle = '#c8ccd4';
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(4, -3);
        ctx.lineTo(4, 3);
        ctx.fill();
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(-11, -2, 3, 4);
        break;
      case 'orb': {
        const r = pr.orb ? 9 + Math.sin(time * 20) * 2 : 5;
        ctx.fillStyle = pr.orb ? 'rgba(200,230,255,0.9)' : 'rgba(240,240,240,0.9)';
        ctx.shadowColor = '#a0d0ff';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'spark':
        ctx.rotate(a);
        ctx.strokeStyle = '#fff8a0';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#f0f070';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-4, -4);
        ctx.lineTo(0, 3);
        ctx.lineTo(6, -2);
        ctx.lineTo(10, 0);
        ctx.stroke();
        break;
      default: {
        ctx.rotate(a);
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(0, 0, pr.visual === 'frost' ? 9 : 7, pr.visual === 'frost' ? 3 : 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(-8, 0, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawGroundEffect(g: GroundEffect, time: number): void {
    const ctx = this.ctx;
    const s = isoToScreen(g.x, g.y);
    const rx = g.radius * HALF_W * 1.414;
    const ry = rx / 2;
    const ell = (fill: string | null, stroke: string | null, scale = 1) => {
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, rx * scale, ry * scale, 0, 0, Math.PI * 2);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };
    const pre = g.time < g.delay;
    const t = g.delay > 0 ? Math.min(1, g.time / g.delay) : 1;
    switch (g.visual) {
      case 'telegraph':
        if (pre) {
          ell('rgba(255,40,30,0.15)', 'rgba(255,60,40,0.8)');
          ell('rgba(255,40,30,0.3)', null, t);
        }
        break;
      case 'root':
        if (pre) {
          ell('rgba(80,200,60,0.15)', 'rgba(80,200,60,0.8)');
          ell('rgba(80,200,60,0.3)', null, t);
        }
        break;
      case 'meteor':
        if (pre) {
          ell('rgba(255,120,30,0.15)', 'rgba(255,140,40,0.8)');
          const my = s.y - (1 - t) * 300;
          ctx.fillStyle = '#ff7a2a';
          ctx.shadowColor = '#ff7a2a';
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(s.x + (1 - t) * 80, my, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ell(`rgba(255,90,20,${0.25 + Math.sin(time * 10) * 0.08})`, null);
        }
        break;
      case 'fire':
        ell(`rgba(255,90,20,${0.25 + Math.sin(time * 10) * 0.08})`, null);
        break;
      case 'blizzard':
        if (!pre) {
          ell('rgba(160,220,255,0.22)', 'rgba(200,240,255,0.5)');
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          for (let i = 0; i < 24; i++) {
            const h = hash2(i, g.id);
            const ft = (time * 0.8 + h) % 1;
            const fx = s.x + (hash2(g.id, i) - 0.5) * rx * 1.8;
            const fy = s.y + (h - 0.5) * ry * 1.6 - (1 - ft) * 60;
            ctx.fillRect(fx, fy, 2.5, 2.5);
          }
        }
        break;
      case 'arrows':
        if (!pre) {
          ell('rgba(200,180,140,0.15)', 'rgba(220,200,160,0.4)');
          ctx.strokeStyle = '#d8c8a0';
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 14; i++) {
            const h = hash2(i, g.id);
            const ft = (time * 2.5 + h) % 1;
            const fx = s.x + (hash2(g.id, i) - 0.5) * rx * 1.8;
            const fy = s.y + (h - 0.5) * ry * 1.6 - (1 - ft) * 80;
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(fx + 3, fy - 12);
            ctx.stroke();
          }
        }
        break;
      case 'poison':
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + time * 0.5;
          ctx.fillStyle = 'rgba(110,200,60,0.18)';
          ctx.beginPath();
          ctx.ellipse(s.x + Math.cos(a) * rx * 0.45, s.y + Math.sin(a) * ry * 0.45 - 8, rx * 0.55, ry * 0.75, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'trap':
        ctx.strokeStyle = '#9aa0aa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 12, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#c8ccd4';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.fillRect(s.x + Math.cos(a) * 10 - 1, s.y + Math.sin(a) * 5 - 3, 2, 4);
        }
        break;
      default:
        break;
    }
  }

  private drawFx(w: World): void {
    const ctx = this.ctx;
    for (const r of w.rings) {
      const s = isoToScreen(r.x, r.y);
      const t = 1 - r.time / r.max;
      const rx = r.radius * HALF_W * 1.414 * (0.4 + t * 0.6);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, rx, rx / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const b of w.bolts) {
      const a = isoToScreen(b.x0, b.y0);
      const c = isoToScreen(b.x1, b.y1);
      const ay = b.x0 === b.x1 - 1.5 ? a.y - 220 : a.y - 18;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(a.x, ay);
      const n = 6;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        ctx.lineTo(a.x + (c.x - a.x) * t + (Math.random() - 0.5) * 14, ay + (c.y - 18 - ay) * t + (Math.random() - 0.5) * 10);
      }
      ctx.lineTo(c.x, c.y - 18);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    for (const pt of w.particles) {
      const s = isoToScreen(pt.x, pt.y);
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.fillRect(s.x - pt.size / 2, s.y - pt.z * 16 - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawOverheads(w: World): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    for (const m of w.mobs) {
      if (m.dead || m.boss) continue;
      const showBar = m.hp < m.maxHp || m.elite || m.bountyId;
      if (!showBar) continue;
      const s = isoToScreen(m.x, m.y);
      const top = s.y - (m.def.body === 'humanoid' ? 46 : 34) * m.size - 8;
      const bw = 34 * Math.max(0.8, m.size);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(s.x - bw / 2 - 1, top - 1, bw + 2, 5);
      ctx.fillStyle = m.team === 0 ? '#4a9af0' : m.elite || m.bountyId ? '#f0a020' : '#d03a2a';
      ctx.fillRect(s.x - bw / 2, top, bw * Math.max(0, m.hp / m.maxHp), 3);
      if (m.elite || m.bountyId || m.team === 0) {
        ctx.font = 'bold 10px Georgia, serif';
        ctx.fillStyle = '#000';
        ctx.fillText(m.name, s.x + 1, top - 3);
        ctx.fillStyle = m.team === 0 ? '#a0d0ff' : m.bountyId ? '#ffd040' : '#ffe0a0';
        ctx.fillText(m.name, s.x, top - 4);
      }
    }
    for (const f of w.floats) {
      const s = isoToScreen(f.x, f.y);
      ctx.globalAlpha = Math.min(1, f.time * 2);
      ctx.font = `bold ${f.size}px sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(f.text, s.x, s.y - f.z * 30 - 30);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, s.x, s.y - f.z * 30 - 30);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}

/** Draws a standalone character preview (used by character creation and the slot list). */
export function drawCharacterPreview(canvas: HTMLCanvasElement, app: CharacterData['appearance'], classId: string, facing: number, time: number, gear?: { weapon?: string; offhand?: string; hat?: HumanoidPose['hat'] }): void {
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth || canvas.width;
  const ch = canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(cw * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const scale = Math.min(cw, ch) / 60;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.ellipse(cw / 2, ch * 0.86, cw * 0.32, cw * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  const weapon = gear?.weapon ?? (classId === 'fighter' ? 'sword' : classId === 'mage' ? 'staff' : 'bow');
  const offhand = gear?.offhand ?? (classId === 'fighter' ? 'shield' : classId === 'ranger' ? 'quiver' : undefined);
  drawHumanoid(ctx, cw / 2, ch * 0.86, { ...app, female: app.gender === 'female' } as any, {
    facing, walk: time * 6, moving: false, attack: 0, hurt: false, scale, weapon, offhand, cape: true, hat: gear?.hat ?? null,
  });
}
