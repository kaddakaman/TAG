// Enemy and ally behaviour.

import { angleTo, dist } from '../core/math';
import { rng } from '../core/rng';
import { circleFree, lineOfSight } from './map';
import { Actor, GroundEffect, Mob, Projectile, type HitInfo } from './entities';
import type { World } from './world';
import type { SpecialDef } from '../data/enemies';

const LEASH = 22;

export function updateMob(w: World, m: Mob, dt: number): void {
  const p = w.player;
  m.attackTimer = Math.max(0, m.attackTimer - dt);
  for (let i = 0; i < m.specialCds.length; i++) m.specialCds[i] -= dt;
  m.attackAnim = Math.max(0, m.attackAnim - dt);
  m.bob += dt;

  if (m.lifetime > 0) {
    m.lifetime -= dt;
    if (m.lifetime <= 0) {
      m.dead = true;
      m.deathTime = w.time - 1;
      w.burst(m.x, m.y, m.def.color2, 10);
      return;
    }
  }
  w.tickStatuses(m, dt);
  if (m.dead) return;

  if (Math.abs(m.kbx) + Math.abs(m.kby) > 0.05) {
    w.moveActor(m, m.kbx * dt, m.kby * dt);
    const f = Math.max(0, 1 - dt * 9);
    m.kbx *= f;
    m.kby *= f;
  }

  const dp = dist(m.x, m.y, p.x, p.y);
  if (m.team === 1 && m.state === 'idle' && dp > 26) return;
  if (m.stunned) {
    m.windup = null;
    m.charging = null;
    m.moving = false;
    return;
  }

  if (m.charging) {
    const c = m.charging;
    c.time -= dt;
    const ox = m.x;
    const oy = m.y;
    w.moveActor(m, c.vx * dt, c.vy * dt);
    m.moving = true;
    m.walkPhase += dt * 20;
    if (!c.hit) {
      for (const t of m.team === 1 ? w.friendliesNear(m.x, m.y, m.radius + 0.4) : w.hostilesNear(m.x, m.y, m.radius + 0.4)) {
        c.hit = true;
        dealMobHit(w, m, t, m.dmg * c.mult, m.def.element);
        const a = angleTo(m.x, m.y, t.x, t.y);
        t.kbx = Math.cos(a) * 8;
        t.kby = Math.sin(a) * 8;
        if (t === p) w.moveActor(p, Math.cos(a) * 0.8, Math.sin(a) * 0.8);
        break;
      }
    }
    if (c.time <= 0 || (Math.abs(m.x - ox) + Math.abs(m.y - oy) < 0.01)) m.charging = null;
    return;
  }

  if (m.windup) {
    m.windup.time -= dt;
    m.moving = false;
    if (m.windup.time <= 0) {
      const wu = m.windup;
      m.windup = null;
      executeWindup(w, m, wu);
    }
    return;
  }

  // enrage once at low life
  if (!m.enraged && m.def.specials?.some((s) => s.kind === 'enrage') && m.hp < m.maxHp * 0.4) {
    m.enraged = true;
    m.dmg *= 1.4;
    m.speed *= 1.25;
    m.attackCd *= 0.75;
    w.float(m.x, m.y, 'ENRAGED', '#ff4040', 16, 1.4);
    if (m.boss) w.toast(`${m.name} becomes enraged!`);
  }

  if (m.team === 0) {
    updateAlly(w, m, dt);
    return;
  }

  if (m.state === 'idle') {
    const t = acquireTarget(w, m, m.aggro);
    if (t) {
      m.state = 'chase';
      m.target = t;
      w.alertPack(m, t);
    } else {
      wander(w, m, dt);
      return;
    }
  }

  if (m.state === 'return') {
    moveToward(w, m, m.homeX, m.homeY, dt, false);
    m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.25 * dt);
    if (dist(m.x, m.y, m.homeX, m.homeY) < 1) {
      m.state = 'idle';
      m.hp = m.maxHp;
    }
    return;
  }

  // chase
  let t = m.target;
  if (!t || t.dead) {
    t = acquireTarget(w, m, m.aggro * 1.6);
    m.target = t;
    if (!t) {
      m.state = m.pack === -3 ? 'idle' : 'return';
      return;
    }
  }
  if (m.pack !== -3 && !m.boss && dist(m.x, m.y, m.homeX, m.homeY) > LEASH) {
    m.state = 'return';
    m.target = null;
    return;
  }
  // switch to a closer friendly target now and then (guards, summons)
  if (rng.chance(dt * 0.5)) {
    const alt = acquireTarget(w, m, 4);
    if (alt && alt !== t && dist(m.x, m.y, alt.x, alt.y) + 2 < dist(m.x, m.y, t.x, t.y)) m.target = t = alt;
  }

  const d = dist(m.x, m.y, t.x, t.y) - t.radius - m.radius;
  m.facing = angleTo(m.x, m.y, t.x, t.y);
  if (trySpecial(w, m, t, d)) return;

  const ranged = m.def.ai === 'ranged' || m.def.ai === 'caster';
  const range = m.def.attackRange;
  const los = !ranged || lineOfSight(w.map, m.x, m.y, t.x, t.y);
  if (d <= range && los) {
    m.moving = false;
    if (m.def.ai === 'ranged' && d < range * 0.4) {
      // kite away
      const a = angleTo(t.x, t.y, m.x, m.y);
      const sp = m.speed * m.speedMult() * dt * 0.8;
      if (!m.rooted) {
        w.moveActor(m, Math.cos(a) * sp, Math.sin(a) * sp);
        m.moving = true;
        m.walkPhase += dt * m.speed * 2.6;
      }
    }
    if (m.attackTimer <= 0) {
      m.attackTimer = m.attackCd * rng.range(0.9, 1.15);
      m.windup = { kind: 'attack', time: ranged ? 0.45 : 0.32, total: ranged ? 0.45 : 0.32, tx: t.x, ty: t.y, angle: m.facing };
      m.attackAnim = m.attackAnimDur = 0.45;
    }
  } else {
    moveToward(w, m, t.x, t.y, dt, t === p);
  }
}

function acquireTarget(w: World, m: Mob, range: number): Actor | null {
  let best: Actor | null = null;
  let bd = range;
  const p = w.player;
  if (!p.dead) {
    const d = dist(m.x, m.y, p.x, p.y);
    if (d < bd && (d < 3 || lineOfSight(w.map, m.x, m.y, p.x, p.y))) {
      bd = d;
      best = p;
    }
  }
  for (const o of w.mobs) {
    if (o.dead || o.team === m.team) continue;
    const d = dist(m.x, m.y, o.x, o.y);
    if (d + 1 < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

function wander(w: World, m: Mob, dt: number): void {
  m.wanderTimer -= dt;
  if (m.wanderTimer <= 0) {
    m.wanderTimer = rng.range(2, 5);
    if (rng.chance(0.6)) {
      m.wanderX = m.homeX + rng.range(-2.5, 2.5);
      m.wanderY = m.homeY + rng.range(-2.5, 2.5);
    } else {
      m.wanderX = m.x;
      m.wanderY = m.y;
    }
  }
  if (dist(m.x, m.y, m.wanderX, m.wanderY) > 0.3) {
    const a = angleTo(m.x, m.y, m.wanderX, m.wanderY);
    const sp = m.speed * 0.35 * dt;
    w.moveActor(m, Math.cos(a) * sp, Math.sin(a) * sp);
    m.facing = a;
    m.moving = true;
    m.walkPhase += dt * m.speed;
  } else m.moving = false;
}

function moveToward(w: World, m: Mob, tx: number, ty: number, dt: number, useFlow: boolean): void {
  if (m.rooted) {
    m.moving = false;
    return;
  }
  const sp = m.speed * m.speedMult() * dt;
  let dx = tx - m.x;
  let dy = ty - m.y;
  const d = Math.hypot(dx, dy);
  if (useFlow && d > 1.5 && !lineOfSight(w.map, m.x, m.y, tx, ty)) {
    const f = w.flow.dir(m.x, m.y);
    if (f) {
      dx = f.x;
      dy = f.y;
    }
  }
  const l = Math.hypot(dx, dy) || 1;
  const ox = m.x;
  const oy = m.y;
  w.moveActor(m, (dx / l) * sp, (dy / l) * sp);
  if (Math.abs(m.x - ox) + Math.abs(m.y - oy) < sp * 0.2) {
    // stuck: try sliding sideways
    const side = (m.id % 2 ? 1 : -1) * Math.PI / 2;
    const a = Math.atan2(dy, dx) + side;
    w.moveActor(m, Math.cos(a) * sp, Math.sin(a) * sp);
  }
  m.facing = Math.atan2(dy, dx);
  m.moving = true;
  m.walkPhase += dt * m.speed * 2.6;
}

function updateAlly(w: World, m: Mob, dt: number): void {
  const p = w.player;
  const guard = m.def.id === 'town_guard';
  const anchorX = guard ? m.homeX : p.x;
  const anchorY = guard ? m.homeY : p.y;
  let t = m.target && !m.target.dead && dist(m.target.x, m.target.y, anchorX, anchorY) < 12 ? m.target : null;
  if (!t) {
    let bd = guard ? 14 : 9;
    for (const o of w.mobs) {
      if (o.dead || o.team !== 1) continue;
      const d = dist(o.x, o.y, anchorX, anchorY);
      if (d < bd) {
        bd = d;
        t = o;
      }
    }
    m.target = t;
  }
  if (!t) {
    const d = dist(m.x, m.y, anchorX, anchorY);
    if (d > (guard ? 0.6 : 2.2)) moveToward(w, m, anchorX + (guard ? 0 : 1), anchorY + (guard ? 0 : 1), dt, false);
    else {
      m.moving = false;
      if (guard) m.facing = Math.PI * 0.75;
    }
    if (!guard && d > 14) {
      m.x = p.x + 1;
      m.y = p.y + 1;
    }
    return;
  }
  const d = dist(m.x, m.y, t.x, t.y) - t.radius - m.radius;
  m.facing = angleTo(m.x, m.y, t.x, t.y);
  if (d <= m.def.attackRange) {
    m.moving = false;
    if (m.attackTimer <= 0) {
      m.attackTimer = m.attackCd;
      m.windup = { kind: 'attack', time: 0.25, total: 0.25, tx: t.x, ty: t.y, angle: m.facing };
      m.attackAnim = m.attackAnimDur = 0.4;
    }
  } else moveToward(w, m, t.x, t.y, dt, false);
}

function dealMobHit(w: World, m: Mob, t: Actor, amount: number, element: HitInfo['element'], status?: HitInfo['status']): void {
  if (m.team === 1) w.hitFriendly(t, amount * rng.range(0.85, 1.15), element, m, status);
  else if (t instanceof Mob) w.damageMob(t, { amount: amount * rng.range(0.9, 1.1), crit: false, element, status, fromPlayer: false }, m);
}

function trySpecial(w: World, m: Mob, t: Actor, d: number): boolean {
  const specials = m.def.specials;
  if (!specials) return false;
  const los = () => lineOfSight(w.map, m.x, m.y, t.x, t.y);
  for (let i = 0; i < specials.length; i++) {
    const s = specials[i];
    if (m.specialCds[i] > 0 || s.kind === 'enrage') continue;
    let ok = false;
    let windup = 0.5;
    switch (s.kind) {
      case 'charge':
        ok = d > 2.5 && d < 9 && los();
        windup = 0.55;
        break;
      case 'slam':
      case 'nova':
        ok = d < (s.radius ?? 2.5) * 0.8;
        windup = 0.25;
        break;
      case 'breath':
        ok = d < 3.8;
        windup = 0.6;
        break;
      case 'volley':
        ok = d < 9 && los();
        windup = 0.5;
        break;
      case 'summon':
        ok = m.summons < 5 && w.mobs.filter((o) => o.owner === m && !o.dead).length < 5;
        windup = 0.8;
        break;
      case 'heal':
        ok = w.mobs.some((o) => !o.dead && o.team === m.team && o.hp < o.maxHp * 0.7 && dist(o.x, o.y, m.x, m.y) < (s.radius ?? 6));
        windup = 0.6;
        break;
      case 'web':
        ok = d > 2 && d < 7 && los();
        windup = 0.4;
        break;
      case 'blink':
        ok = ((m.def.ai === 'caster' || m.def.ai === 'ranged') && d < 2.2) || (m.def.ai === 'melee' && d > 5);
        windup = 0.3;
        break;
      case 'meteor':
        ok = d < 10;
        windup = 0.4;
        break;
      case 'root':
        ok = d < 8 && los();
        windup = 0.4;
        break;
    }
    if (!ok) continue;
    m.specialCds[i] = s.cd * rng.range(0.85, 1.15);
    m.windup = { kind: s.kind, time: windup, total: windup, tx: t.x, ty: t.y, special: s, angle: angleTo(m.x, m.y, t.x, t.y) };
    m.attackAnim = m.attackAnimDur = windup + 0.2;
    // telegraphed area attacks
    if (s.kind === 'slam' || s.kind === 'nova') {
      const st = s.kind === 'nova' ? { type: 'slow' as const, power: 50, duration: 2.5 } : m.def.id === 'stone_golem' ? { type: 'stun' as const, power: 1, duration: 0.6 } : undefined;
      w.grounds.push(new GroundEffect({ x: m.x, y: m.y, radius: s.radius ?? 2.5, delay: 0.85, team: m.team, impact: hostileHit(m, (s.mult ?? 1.5) * m.dmg, s.kind === 'nova' ? m.def.element : 'physical', st), visual: 'telegraph', owner: m }));
      m.windup.time = 0.9;
      m.windup.total = 0.9;
    }
    if (s.kind === 'meteor') {
      w.grounds.push(new GroundEffect({ x: t.x, y: t.y, radius: s.radius ?? 2.5, delay: 1.4, team: m.team, impact: hostileHit(m, (s.mult ?? 2) * m.dmg, 'fire', { type: 'burn', power: 0.3, duration: 3 }), visual: 'telegraph', owner: m }));
    }
    if (s.kind === 'root') {
      w.grounds.push(new GroundEffect({ x: t.x, y: t.y, radius: 1.3, delay: 1.0, team: m.team, impact: hostileHit(m, m.dmg * 0.5, 'poison', { type: 'root', power: 1, duration: 1.6 }), visual: 'root', owner: m }));
    }
    return true;
  }
  return false;
}

function hostileHit(m: Mob, amount: number, element: HitInfo['element'], status?: HitInfo['status']): HitInfo {
  return { amount, crit: false, element, status, fromPlayer: false };
}

function executeWindup(w: World, m: Mob, wu: NonNullable<Mob['windup']>): void {
  const t = m.target;
  const s: SpecialDef | undefined = wu.special;
  switch (wu.kind) {
    case 'attack': {
      if (!t || t.dead) return;
      const ranged = m.def.ai === 'ranged' || m.def.ai === 'caster';
      if (ranged && m.team === 1) {
        const a = angleTo(m.x, m.y, t.x, t.y);
        const sp = m.def.projectile === 'arrow' ? 13 : 9;
        const pr = new Projectile(m.x, m.y, a, sp, m.def.attackRange + 3, 1, hostileHit(m, m.dmg, m.def.element, statusFor(m)), m.def.projectile ?? 'bolt', m);
        w.projectiles.push(pr);
        w.hooks.sfx(m.def.projectile === 'arrow' ? 'bow' : 'zap');
      } else {
        const d = dist(m.x, m.y, t.x, t.y) - t.radius - m.radius;
        if (d <= m.def.attackRange + 0.7) {
          dealMobHit(w, m, t, m.dmg, m.def.element, statusFor(m));
          if (m.team === 1) w.hooks.sfx('mobhit');
        }
      }
      return;
    }
    case 'charge': {
      const a = angleTo(m.x, m.y, wu.tx, wu.ty);
      m.charging = { vx: Math.cos(a) * 12, vy: Math.sin(a) * 12, time: Math.min(0.75, dist(m.x, m.y, wu.tx, wu.ty) / 12 + 0.15), hit: false, mult: s?.mult ?? 1.5 };
      return;
    }
    case 'breath': {
      const range = 4.2;
      for (const f of m.team === 1 ? w.friendliesNear(m.x, m.y, range) : []) {
        const a = angleTo(m.x, m.y, f.x, f.y);
        let diff = Math.abs(a - wu.angle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 0.65) dealMobHit(w, m, f, m.dmg * (s?.mult ?? 1.3), 'fire', { type: 'burn', power: 0.4, duration: 3 });
      }
      for (let i = 0; i < 30; i++) {
        const a = wu.angle + rng.range(-0.55, 0.55);
        const sp = rng.range(3, 8);
        w.particles.push({ x: m.x, y: m.y, z: 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rng.range(0, 1.5), life: rng.range(0.4, 0.7), max: 0.7, color: rng.pick(['#ff6a1a', '#ffb02a', '#ff3a1a']), size: rng.range(3, 6), gravity: 0 });
      }
      w.hooks.sfx('fire');
      return;
    }
    case 'volley': {
      const n = s?.count ?? 5;
      for (let i = 0; i < n; i++) {
        const a = wu.angle + ((i - (n - 1) / 2) * 0.9) / n;
        w.projectiles.push(new Projectile(m.x, m.y, a, 12, 11, 1, hostileHit(m, m.dmg * (s?.mult ?? 0.8), m.def.element, statusFor(m)), m.def.projectile ?? 'arrow', m));
      }
      w.hooks.sfx('bow');
      return;
    }
    case 'summon': {
      const n = s?.count ?? 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        let x = m.x + Math.cos(a) * 1.6;
        let y = m.y + Math.sin(a) * 1.6;
        if (!circleFree(w.map, x, y, 0.3)) {
          x = m.x;
          y = m.y;
        }
        const mm = new Mob(s?.summon ?? 'wolf', Math.max(1, m.level - 1), x, y, {});
        mm.owner = m;
        mm.state = 'chase';
        mm.target = m.target;
        mm.pack = m.pack;
        w.mobs.push(mm);
        w.burst(x, y, '#a0a0a0', 8);
      }
      m.summons += n;
      if (m.boss) w.float(m.x, m.y, 'Summons minions!', '#ffb040', 14, 1.2);
      return;
    }
    case 'heal': {
      for (const o of w.mobs) {
        if (o.dead || o.team !== m.team || dist(o.x, o.y, m.x, m.y) > (s?.radius ?? 6)) continue;
        if (o.hp < o.maxHp) {
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.25);
          w.float(o.x, o.y, '+heal', '#60ff60', 12);
        }
      }
      w.ring(m.x, m.y, s?.radius ?? 6, '#60ff60', 0.5);
      return;
    }
    case 'web': {
      if (!t) return;
      const pr = new Projectile(m.x, m.y, angleTo(m.x, m.y, t.x, t.y), 10, 9, 1, hostileHit(m, m.dmg * 0.4, 'poison'), 'orb', m);
      pr.slow = { power: 55, duration: 2.5 };
      pr.orb = undefined;
      w.projectiles.push(pr);
      return;
    }
    case 'blink': {
      if (!t) return;
      for (let k = 0; k < 12; k++) {
        const a = rng.range(0, Math.PI * 2);
        const r = m.def.ai === 'melee' ? 1.4 : rng.range(4, 6);
        const x = t.x + Math.cos(a) * r;
        const y = t.y + Math.sin(a) * r;
        if (circleFree(w.map, x, y, m.radius)) {
          w.burst(m.x, m.y, m.def.color, 10);
          m.x = x;
          m.y = y;
          w.burst(x, y, m.def.color, 10);
          break;
        }
      }
      return;
    }
  }
}

function statusFor(m: Mob): HitInfo['status'] | undefined {
  switch (m.def.element) {
    case 'poison':
      return { type: 'poison', power: 0.6, duration: 4 };
    case 'fire':
      return { type: 'burn', power: 0.3, duration: 3 };
    case 'frost':
      return { type: 'slow', power: 30, duration: 2 };
    default:
      return undefined;
  }
}
