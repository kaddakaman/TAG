// Executes player abilities.

import { ABILITY_MAP, type ProjectileSpec } from '../data/abilities';
import { angleDiff, angleTo, dist } from '../core/math';
import { rng } from '../core/rng';
import { circleFree, walkLine } from './map';
import { GroundEffect, Mob, Projectile, type HitInfo } from './entities';
import type { World } from './world';

export function abilityReady(w: World, id: string): { ok: boolean; reason?: string } {
  const s = w.session;
  const def = ABILITY_MAP[id];
  const rank = s.rank(id);
  if (!def || rank <= 0) return { ok: false, reason: 'Not learned' };
  const wc = s.weaponCheck(id);
  if (wc) return { ok: false, reason: wc };
  if ((w.player.cooldowns[id] ?? 0) > 0) return { ok: false, reason: 'Not ready' };
  const cost = def.cost?.(rank) ?? 0;
  if (s.char.resource < cost) return { ok: false, reason: `Not enough ${s.cls.resourceName}` };
  return { ok: true };
}

export function useAbility(w: World, id: string): boolean {
  const ready = abilityReady(w, id);
  if (!ready.ok) {
    if (ready.reason !== 'Not ready') w.toast(ready.reason!);
    return false;
  }
  const s = w.session;
  const def = ABILITY_MAP[id];
  const rank = s.rank(id);
  const eff = def.effect;
  if (!eff) return false;
  const p = w.player;
  const isSpell = s.char.classId === 'mage';
  const range = eff.type === 'projectile' ? eff.proj.range : eff.type === 'dash' ? eff.distance + 1 : eff.type === 'ground' ? 9 : eff.type === 'mark' ? 10 : 4;
  const target = w.autoTarget(range, eff.type === 'projectile' || eff.type === 'mark');
  if (target) p.facing = angleTo(p.x, p.y, target.x, target.y);
  const aim = p.facing;

  switch (eff.type) {
    case 'melee': {
      const hit = w.playerHit(eff.dmg(rank), eff.element ?? 'physical', false, statusOf(eff.status, rank));
      hit.knockback = eff.knockback;
      hit.execute = eff.executeBonus;
      let any = false;
      for (const m of w.hostilesNear(p.x, p.y, eff.range + 0.5)) {
        const a = angleTo(p.x, p.y, m.x, m.y);
        if (Math.abs(angleDiff(aim, a)) <= (eff.arc * Math.PI) / 360 || dist(p.x, p.y, m.x, m.y) < 0.9) {
          w.damageMob(m, { ...hit }, p);
          any = true;
        }
      }
      p.attackAnim = p.attackAnimDur = 0.35;
      w.ring(p.x + Math.cos(aim) * 0.8, p.y + Math.sin(aim) * 0.8, eff.range * 0.6, 'rgba(255,255,255,0.5)', 0.18);
      w.hooks.sfx(any ? 'hit' : 'swing');
      break;
    }
    case 'projectile':
      fireProjectiles(w, eff.proj, rank, aim, isSpell, target);
      p.attackAnim = p.attackAnimDur = 0.3;
      break;
    case 'dash': {
      const tx = target ? target.x - Math.cos(aim) * (target.radius + 0.8) : p.x + Math.cos(aim) * eff.distance;
      const ty = target ? target.y - Math.sin(aim) * (target.radius + 0.8) : p.y + Math.sin(aim) * eff.distance;
      const end = walkLine(w.map, p.x, p.y, tx, ty, p.radius);
      p.invuln = 0.3;
      p.dash = {
        tx: end.x, ty: end.y, speed: 20,
        onArrive: () => {
          const hit = w.playerHit(eff.dmg(rank), 'physical', false, statusOf(eff.status, rank));
          for (const m of w.hostilesNear(p.x, p.y, eff.range + 0.5)) {
            const a = angleTo(p.x, p.y, m.x, m.y);
            if (Math.abs(angleDiff(p.facing, a)) <= (eff.arc * Math.PI) / 360 || dist(p.x, p.y, m.x, m.y) < 1) w.damageMob(m, { ...hit }, p);
          }
          p.attackAnim = p.attackAnimDur = 0.3;
          w.hooks.sfx('hit');
        },
      };
      break;
    }
    case 'spin':
      p.spin = { time: eff.duration, tick: eff.tick, next: 0, radius: eff.radius, mult: eff.dmg(rank) };
      break;
    case 'nova': {
      const hit = w.playerHit(eff.dmg(rank), eff.element, isSpell, statusOf(eff.status, rank));
      for (const m of w.hostilesNear(p.x, p.y, eff.radius)) w.damageMob(m, { ...hit }, p);
      const col = eff.element === 'frost' ? '#a0e8ff' : '#d8c8a0';
      w.ring(p.x, p.y, eff.radius, col, 0.45);
      w.burst(p.x, p.y, col, 26);
      w.shake = Math.max(w.shake, eff.radius > 4 ? 0.7 : 0.35);
      w.hooks.sfx(eff.element === 'frost' ? 'frost' : 'boom');
      break;
    }
    case 'ground': {
      let gx = target ? target.x : p.x + Math.cos(aim) * 5;
      let gy = target ? target.y : p.y + Math.sin(aim) * 5;
      if (eff.at === 'self') {
        gx = p.x;
        gy = p.y;
      }
      const tickHit = w.playerHit(eff.dmg(rank), eff.element, isSpell, statusOf(eff.status, rank));
      const impact = eff.impactDmg ? w.playerHit(eff.impactDmg(rank), eff.element, isSpell, { type: 'burn', power: 0.3, duration: 3 }) : null;
      w.grounds.push(new GroundEffect({ x: gx, y: gy, radius: eff.radius, delay: eff.delay, duration: eff.duration, tick: eff.tick, team: 0, hit: tickHit, impact, visual: eff.visual, owner: p }));
      w.hooks.sfx(eff.visual === 'arrows' ? 'bow' : 'cast');
      break;
    }
    case 'strikes':
      p.strikes = { left: Math.round(eff.count(rank)), interval: eff.interval, next: 0.1, radius: eff.radius, mult: eff.dmg(rank), element: eff.element };
      break;
    case 'buff':
      s.buffs.set(eff.buffId, { bonus: eff.bonus(rank), remaining: eff.duration(rank), name: def.name });
      s.invalidate();
      w.ring(p.x, p.y, 2.5, '#ffd060', 0.5);
      w.float(p.x, p.y, def.name + '!', '#ffd060', 15, 1.2);
      w.hooks.sfx('buff');
      break;
    case 'heal': {
      const d = s.derived;
      const amt = (d.maxHp * eff.pct(rank)) / 100;
      s.char.hp = Math.min(d.maxHp, s.char.hp + amt);
      w.float(p.x, p.y, `+${Math.round(amt)}`, '#60ff60', 16);
      w.burst(p.x, p.y, '#60ff60', 16);
      w.hooks.sfx('buff');
      break;
    }
    case 'blink': {
      const dx = Math.hypot(w.intent.moveX, w.intent.moveY) > 0.2 ? Math.atan2(w.intent.moveY, w.intent.moveX) : aim;
      const end = walkLine(w.map, p.x, p.y, p.x + Math.cos(dx) * eff.distance, p.y + Math.sin(dx) * eff.distance, p.radius);
      w.burst(p.x, p.y, '#d08aff', 14);
      p.x = end.x;
      p.y = end.y;
      w.burst(p.x, p.y, '#d08aff', 14);
      w.hooks.sfx('zap');
      break;
    }
    case 'roll': {
      const mv = Math.hypot(w.intent.moveX, w.intent.moveY) > 0.2;
      const a = mv ? Math.atan2(w.intent.moveY, w.intent.moveX) : aim + Math.PI;
      const end = walkLine(w.map, p.x, p.y, p.x + Math.cos(a) * eff.distance, p.y + Math.sin(a) * eff.distance, p.radius);
      p.facing = a;
      p.invuln = eff.invuln;
      p.dash = { tx: end.x, ty: end.y, speed: 14 };
      w.hooks.sfx('swing');
      break;
    }
    case 'trap': {
      let tx = p.x + Math.cos(aim) * 1.2;
      let ty = p.y + Math.sin(aim) * 1.2;
      if (!circleFree(w.map, tx, ty, 0.2)) {
        tx = p.x;
        ty = p.y;
      }
      const g = new GroundEffect({ x: tx, y: ty, radius: eff.radius, duration: eff.duration, team: 0, impact: w.playerHit(eff.dmg(rank), 'physical', false), visual: 'trap', owner: p });
      g.trap = { root: eff.root(rank) };
      w.grounds.push(g);
      break;
    }
    case 'mark': {
      if (!target) {
        w.toast('No target');
        return false;
      }
      w.applyStatus(target, { type: 'vulnerable', power: eff.pct(rank), duration: eff.duration }, 0, 'physical');
      w.float(target.x, target.y, 'Marked', '#ff8080', 14);
      w.ring(target.x, target.y, 1, '#ff6060', 0.5);
      break;
    }
    case 'summon': {
      const n = eff.count(rank);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        let x = p.x + Math.cos(a) * 1.4;
        let y = p.y + Math.sin(a) * 1.4;
        if (!circleFree(w.map, x, y, 0.3)) {
          x = p.x;
          y = p.y;
        }
        const m = new Mob(eff.creature, s.char.level, x, y, { team: 0, name: 'Spirit Wolf' });
        const d = s.derived;
        m.maxHp = m.hp = Math.round(d.maxHp * 0.5);
        m.dmg = ((d.dmgMin + d.dmgMax) / 2) * 0.6 * (1 + rank * 0.1);
        m.armor = d.armor;
        m.lifetime = eff.duration(rank);
        w.mobs.push(m);
        w.burst(x, y, '#9ae0ff', 14);
      }
      w.hooks.sfx('howl');
      break;
    }
    case 'manaShield':
      p.manaShield = { remaining: eff.duration(rank), absorb: eff.absorb(rank) };
      w.float(p.x, p.y, 'Mana Shield', '#6ab0ff', 15, 1.2);
      w.hooks.sfx('buff');
      break;
  }

  const cost = def.cost?.(rank) ?? 0;
  s.char.resource -= cost;
  const cd = (def.cooldown?.(rank) ?? 0) * (1 - s.derived.cdr);
  p.cooldowns[id] = cd;
  p.cdTotals[id] = cd;
  p.combatTimer = Math.max(p.combatTimer, 3);
  return true;
}

function statusOf(spec: { type: any; power: (r: number) => number; duration: (r: number) => number } | undefined, rank: number): HitInfo['status'] {
  if (!spec) return undefined;
  return { type: spec.type, power: spec.power(rank), duration: spec.duration(rank) };
}

function fireProjectiles(w: World, spec: ProjectileSpec, rank: number, aim: number, isSpell: boolean, target: Mob | null): void {
  const p = w.player;
  const n = Math.round(spec.count?.(rank) ?? 1);
  const spread = ((spec.spread ?? 0) * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? aim : aim - spread / 2 + (spread * i) / (n - 1);
    const hit = w.playerHit(spec.dmg(rank), spec.element, isSpell, statusOf(spec.status, rank));
    const pr = new Projectile(p.x, p.y, a, spec.speed, spec.range, 0, hit, spec.visual, p);
    pr.pierce = !!spec.pierce;
    if (spec.explode) pr.explode = { radius: spec.explode.radius, hit: w.playerHit(spec.explode.dmg(rank), spec.element, isSpell, statusOf(spec.status, rank)) };
    if (spec.chain) pr.chain = { count: Math.round(spec.chain.count(rank)), range: spec.chain.range };
    if (spec.cloud) {
      pr.cloud = {
        radius: spec.cloud.radius, duration: spec.cloud.duration, tick: spec.cloud.tick,
        hit: w.playerHit(spec.cloud.dmg(rank), spec.cloud.element, isSpell, statusOf(spec.cloud.status, rank)),
      };
    }
    if (spec.orb) {
      pr.orb = { tick: spec.orb.tick, radius: spec.orb.radius, next: 0 };
      pr.radius = 0.4;
    }
    if (spec.homing) {
      const cands = w.hostilesNear(p.x, p.y, spec.range);
      pr.homing = cands.length ? cands[i % cands.length] : target;
    }
    w.projectiles.push(pr);
  }
  const sfx = spec.visual === 'arrow' || spec.visual === 'poison' ? 'bow' : spec.visual === 'fire' ? 'fire' : spec.visual === 'frost' ? 'frost' : 'zap';
  w.hooks.sfx(sfx);
  void rng;
}
