// The World runs the simulation for the current area: the player, enemies,
// projectiles, loot, gathering and interactions.

import type { DamageType, Item } from '../types';
import { bus } from '../core/events';
import { Rng, rng } from '../core/rng';
import { angleDiff, angleTo, clamp, dist, dist2 } from '../core/math';
import { basicAttackFor } from '../data/abilities';
import { ENEMIES, ELITE_PREFIXES } from '../data/enemies';
import { NODES, type NodeDef } from '../data/lifeskills';
import { STACKABLES, TOOL_INFO } from '../data/items';
import { NPCS } from '../data/town';
import { TOWN_ID, ZONE_MAP, ZONES, zoneName } from '../data/zones';
import type { Session } from '../systems/session';
import { getInfo, itemWeight, makeStack } from '../systems/items';
import { rollLoot } from '../systems/loot';
import { xpForKill } from '../systems/progression';
import { scalingStat, statDamageMult } from '../systems/stats';
import { circleFree, FlowField, lineOfSight, type ExitDef, type NodeSpawn, type Station, type ZoneMap } from './map';
import { getZoneMap, guardPosts } from './gen';
import {
  Actor, Campfire, GroundEffect, Mob, Npc, Pickup, Player, Projectile,
  type Bolt, type FloatText, type HitInfo, type Particle, type Ring,
} from './entities';
import { updateMob } from './ai';
import { useAbility } from './abilities';

export type Interaction =
  | { kind: 'npc'; npc: Npc; label: string; x: number; y: number }
  | { kind: 'node'; node: NodeSpawn; def: NodeDef; label: string; x: number; y: number }
  | { kind: 'station'; station: Station; label: string; x: number; y: number }
  | { kind: 'campfire'; fire: Campfire; label: string; x: number; y: number }
  | { kind: 'loot'; pickup: Pickup; label: string; x: number; y: number };

export interface WorldHooks {
  openNpc(id: string): void;
  openStation(kind: Station['kind']): void;
  openCampfire(): void;
  exitZone(exit: ExitDef): void;
  playerDied(): void;
  recallComplete(): void;
  sfx(name: string): void;
}

export interface Intent {
  moveX: number;
  moveY: number;
  attack: boolean;
  ability: number;
  interact: boolean;
  potion: boolean;
}

const ELEMENT_COLORS: Record<DamageType, string> = {
  physical: '#ffffff',
  fire: '#ff8a3a',
  frost: '#8ad8ff',
  lightning: '#f0f070',
  poison: '#8aea5a',
  arcane: '#d08aff',
};

export class World {
  session: Session;
  hooks: WorldHooks;
  map!: ZoneMap;
  zoneId = TOWN_ID;
  player = new Player();
  mobs: Mob[] = [];
  projectiles: Projectile[] = [];
  grounds: GroundEffect[] = [];
  pickups: Pickup[] = [];
  campfires: Campfire[] = [];
  npcs: Npc[] = [];
  floats: FloatText[] = [];
  particles: Particle[] = [];
  bolts: Bolt[] = [];
  rings: Ring[] = [];
  time = 0;
  flow!: FlowField;
  private flowTimer = 0;
  intent: Intent = { moveX: 0, moveY: 0, attack: false, ability: -1, interact: false, potion: false };
  interaction: Interaction | null = null;
  nodeYield = new Map<string, number>();
  raid: { remaining: number; total: number; reward: number } | null = null;
  shake = 0;
  boss: Mob | null = null;
  exitLock = 1;
  private heavyWarn = 0;

  constructor(session: Session, hooks: WorldHooks) {
    this.session = session;
    this.hooks = hooks;
  }

  get char() {
    return this.session.char;
  }
  get clock(): number {
    return this.session.data.playTime;
  }

  // =================================================================== zones

  load(zoneId: string, arrive: 'entry' | 'back' | 'waystone' | 'saved'): void {
    const s = this.session;
    this.zoneId = zoneId;
    this.map = getZoneMap(zoneId, s.townLevel().level);
    this.flow = new FlowField(this.map);
    this.mobs = [];
    this.projectiles = [];
    this.grounds = [];
    this.pickups = [];
    this.campfires = [];
    this.npcs = [];
    this.floats = [];
    this.particles = [];
    this.bolts = [];
    this.rings = [];
    this.nodeYield.clear();
    this.raid = null;
    this.boss = null;
    this.exitLock = 1;
    const p = this.player;
    p.dead = false;
    p.dash = p.spin = p.strikes = p.channel = null;
    p.statuses = [];
    let pos = this.map.entry;
    if (arrive === 'back') pos = this.map.backEntry;
    else if (arrive === 'waystone' && this.map.waystone) pos = { x: this.map.waystone.x + 1.2, y: this.map.waystone.y + 1.2 };
    else if (arrive === 'saved') {
      const w = s.data.world;
      if (circleFree(this.map, w.x, w.y, p.radius)) pos = { x: w.x, y: w.y };
    }
    p.x = pos.x;
    p.y = pos.y;
    if (!circleFree(this.map, p.x, p.y, p.radius)) this.unstick(p);
    s.data.world.zoneId = zoneId;

    if (this.map.isTown) {
      for (const def of NPCS) this.npcs.push(new Npc(def));
      this.spawnGuards();
    } else {
      if (this.map.waystone && !s.data.world.waystones.includes(zoneId)) {
        s.data.world.waystones.push(zoneId);
        bus.emit('toast', { text: `Waystone attuned: ${zoneName(zoneId)}`, color: '#8ad8ff' });
      }
      this.spawnZoneEnemies();
    }
    const sat = s.data.world.satchel;
    if (sat && sat.zoneId === zoneId) {
      const pk = new Pickup(sat.x, sat.y, null, sat.gold);
      pk.satchel = true;
      this.pickups.push(pk);
    }
    bus.emit('zoneEnter', { zoneId });
  }

  private spawnZoneEnemies(): void {
    const zs = this.session.zoneState(this.zoneId);
    const killed = new Set(zs.killed);
    for (const sp of this.map.spawns) {
      if (killed.has(sp.id)) continue;
      let name: string | undefined;
      if (sp.elite) name = `${rng.pick(ELITE_PREFIXES)} ${ENEMIES[sp.enemyId].name}`;
      const m = new Mob(sp.enemyId, sp.level, sp.x, sp.y, { elite: sp.elite, boss: sp.boss, name });
      m.spawnId = sp.id;
      m.pack = sp.pack;
      this.mobs.push(m);
    }
    // bounty elite target
    const b = this.session.eliteBountyFor(this.zoneId);
    if (b && b.objective.enemyId && this.map.campSpots.length) {
      const r = new Rng(b.id);
      const spot = r.pick(this.map.campSpots);
      const m = new Mob(b.objective.enemyId, spot.level + 2, spot.x + 1, spot.y + 1, { elite: true, name: b.objective.eliteName });
      m.bountyId = b.id;
      m.maxHp = m.hp = Math.round(m.maxHp * 1.5);
      m.pack = -2;
      this.mobs.push(m);
    }
  }

  private spawnGuards(): void {
    const tl = this.session.townLevel();
    const posts = guardPosts();
    for (let i = 0; i < tl.guards; i++) {
      const p = posts[i % posts.length];
      const g = new Mob('town_guard', Math.max(1, this.char.level + tl.level), p.x, p.y, { team: 0, name: 'Town Guard' });
      g.maxHp = g.hp = Math.round(g.maxHp * (1 + tl.level * 0.15));
      g.dmg *= 1 + tl.level * 0.1;
      this.mobs.push(g);
    }
  }

  startRaid(): void {
    const unlocked = this.session.data.world.unlockedZones;
    const zone = ZONE_MAP[unlocked[unlocked.length - 1]] ?? ZONES[0];
    const tl = this.session.townLevel();
    const count = Math.max(2, 3 + zone.index + rng.int(0, 2) - Math.floor(tl.level / 2));
    for (let i = 0; i < count; i++) {
      const id = rng.weighted(zone.roster);
      const m = new Mob(id, zone.level[0] + rng.int(0, 1), 25.5 + rng.range(-1.2, 1.2), 1 + rng.range(0, 2.5), {});
      m.state = 'chase';
      m.aggro = 30;
      m.pack = -3;
      this.mobs.push(m);
    }
    this.raid = { remaining: count, total: count, reward: Math.round(40 * zone.index + 15 * count) };
    bus.emit('toast', { text: `Raiders from ${zone.name} are attacking Hearthvale!`, color: '#ff6a4a' });
    this.hooks.sfx('alarm');
  }

  // =================================================================== update

  update(dt: number): void {
    this.time += dt;
    this.exitLock = Math.max(0, this.exitLock - dt);
    const s = this.session;
    s.data.playTime += dt;
    const p = this.player;

    this.updateBuffs(dt);
    if (!p.dead) this.updatePlayer(dt);

    this.flowTimer -= dt;
    if (this.flowTimer <= 0) {
      this.flowTimer = 0.4;
      this.flow.build(p.x, p.y, 30);
    }
    this.boss = null;
    for (const m of this.mobs) {
      if (m.dead) continue;
      updateMob(this, m, dt);
      if (m.boss && m.state === 'chase' && m.team === 1) this.boss = m;
    }
    this.separate();
    this.updateProjectiles(dt);
    this.updateGrounds(dt);
    this.updatePickups(dt);
    this.updateFx(dt);
    this.mobs = this.mobs.filter((m) => !(m.dead && this.time - m.deathTime > 1.2));
    this.campfires = this.campfires.filter((c) => (c.time -= dt) > 0);
    if (!p.dead) {
      this.findInteraction();
      this.checkExits();
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }

  private updateBuffs(dt: number): void {
    const s = this.session;
    let changed = false;
    for (const [id, b] of s.buffs) {
      b.remaining -= dt;
      if (b.remaining <= 0) {
        s.buffs.delete(id);
        changed = true;
      }
    }
    const fb = this.char.foodBuff;
    if (fb) {
      fb.remaining -= dt;
      if (fb.remaining <= 0) {
        this.char.foodBuff = null;
        changed = true;
        bus.emit('toast', { text: 'Your Well Fed bonus has worn off.' });
      }
    }
    if (changed) s.invalidate();
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    const s = this.session;
    const c = this.char;
    const d = s.derived;
    p.maxHp = d.maxHp;
    p.hp = c.hp;
    p.level = c.level;
    p.flash = Math.max(0, p.flash - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.attackAnim = Math.max(0, p.attackAnim - dt);
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.combatTimer = Math.max(0, p.combatTimer - dt);
    c.potionCooldown = Math.max(0, c.potionCooldown - dt);
    for (const k in p.cooldowns) p.cooldowns[k] = Math.max(0, p.cooldowns[k] - dt);
    if (p.manaShield && (p.manaShield.remaining -= dt) <= 0) p.manaShield = null;

    // regeneration (faster out of combat and beside a campfire)
    const nearFire = this.campfires.some((f) => dist(f.x, f.y, p.x, p.y) < 3.5) || (this.map.isTown && !this.raid);
    const regenMult = p.combatTimer > 0 ? 1 : nearFire ? 6 : 2;
    c.hp = Math.min(d.maxHp, c.hp + d.regen * regenMult * dt);
    c.resource = Math.min(d.maxRes, c.resource + d.resRegen * (p.combatTimer > 0 ? 1 : 1.5) * dt);

    this.tickStatuses(p, dt);
    if (p.dead) return;

    const it = this.intent;
    if (it.potion) {
      it.potion = false;
      const err = s.drinkPotion();
      if (err) this.toast(err);
      else {
        this.hooks.sfx('potion');
        this.burst(p.x, p.y, '#ff4a6a', 10);
      }
    }

    // dashes & rolls override movement
    if (p.dash) {
      const dx = p.dash.tx - p.x;
      const dy = p.dash.ty - p.y;
      const dd = Math.hypot(dx, dy);
      const step = p.dash.speed * dt;
      if (dd <= step) {
        this.moveActor(p, dx, dy);
        const cb = p.dash.onArrive;
        p.dash = null;
        cb?.();
      } else {
        const ox = p.x;
        const oy = p.y;
        this.moveActor(p, (dx / dd) * step, (dy / dd) * step);
        if (Math.abs(p.x - ox) + Math.abs(p.y - oy) < step * 0.2) {
          const cb = p.dash.onArrive;
          p.dash = null;
          cb?.();
        }
      }
      p.moving = true;
      p.walkPhase += dt * 14;
      return;
    }

    if (p.spin) {
      p.spin.time -= dt;
      p.spin.next -= dt;
      p.spinAngle += dt * 18;
      if (p.spin.next <= 0) {
        p.spin.next += p.spin.tick;
        const hit = this.playerHit(p.spin.mult, 'physical', false);
        for (const m of this.hostilesNear(p.x, p.y, p.spin.radius)) this.damageMob(m, { ...hit }, p);
        this.ring(p.x, p.y, p.spin.radius, 'rgba(220,220,255,0.6)', 0.2);
        this.hooks.sfx('swing');
      }
      if (p.spin.time <= 0) p.spin = null;
    }
    if (p.strikes) {
      p.strikes.next -= dt;
      if (p.strikes.next <= 0) {
        p.strikes.next += p.strikes.interval;
        p.strikes.left--;
        const targets = this.hostilesNear(p.x, p.y, p.strikes.radius);
        const t = targets.length ? rng.pick(targets) : null;
        const tx = t ? t.x : p.x + rng.range(-4, 4);
        const ty = t ? t.y : p.y + rng.range(-4, 4);
        this.bolts.push({ x0: tx - 1.5, y0: ty - 1.5, x1: tx, y1: ty, time: 0.25, color: '#f0f8a0' });
        for (const m of this.hostilesNear(tx, ty, 1.4)) this.damageMob(m, this.playerHit(p.strikes.mult, p.strikes.element, true), p);
        this.shake = Math.max(this.shake, 0.25);
        this.hooks.sfx('thunder');
        if (p.strikes.left <= 0) p.strikes = null;
      }
    }

    // channelled actions
    if (p.channel) {
      const moved = Math.hypot(it.moveX, it.moveY) > 0.2;
      if (moved || it.attack || it.ability >= 0) {
        p.channel = null;
      } else {
        p.channel.time += dt;
        if (p.channel.time >= p.channel.total) this.completeChannel();
      }
    }

    // movement
    const burdened = s.isOverburdened();
    const base = 4.3 * d.moveSpeed * (burdened ? 0.5 : 1) * p.speedMult() * (p.spin ? 0.7 : 1);
    let mx = it.moveX;
    let my = it.moveY;
    const ml = Math.hypot(mx, my);
    const movingInput = ml > 0.15 && !p.rooted;
    if (movingInput) {
      mx /= Math.max(1, ml);
      my /= Math.max(1, ml);
      this.moveActor(p, mx * base * dt, my * base * dt);
      p.facing = Math.atan2(my, mx);
      p.lastMoveX = mx;
      p.lastMoveY = my;
      p.moving = true;
      p.walkPhase += dt * (burdened ? 6 : 11) * Math.min(1, ml * 1.4);
    } else p.moving = false;

    // abilities
    if (it.ability >= 0) {
      const slot = it.ability;
      it.ability = -1;
      const id = c.actionBar[slot];
      if (id && !p.stunned) useAbility(this, id);
    }

    // basic attack with auto-targeting
    if (it.attack && !p.stunned) {
      const ba = basicAttackFor(d.weapon);
      const target = this.autoTarget(ba.kind === 'melee' ? 6 : ba.range + 1, ba.kind === 'projectile');
      if (target) {
        const dd = dist(p.x, p.y, target.x, target.y) - target.radius;
        if (ba.kind === 'melee' && dd > ba.range && !movingInput && !p.rooted) {
          // step toward the target
          const a = angleTo(p.x, p.y, target.x, target.y);
          this.moveActor(p, Math.cos(a) * base * dt, Math.sin(a) * base * dt);
          p.facing = a;
          p.moving = true;
          p.walkPhase += dt * 11;
        } else if (p.attackCd <= 0) {
          p.facing = angleTo(p.x, p.y, target.x, target.y);
          this.basicAttack(target);
        }
      } else if (p.attackCd <= 0) this.basicAttack(null);
    }

    if (it.interact) {
      it.interact = false;
      this.interact();
    }
    c.hp = Math.max(0, c.hp);
    p.hp = c.hp;
  }

  private basicAttack(target: Actor | null): void {
    const p = this.player;
    const d = this.session.derived;
    const ba = basicAttackFor(d.weapon);
    p.attackCd = 1 / d.attacksPerSec;
    p.attackAnim = p.attackAnimDur = Math.min(0.35, p.attackCd * 0.8);
    p.combatTimer = 4;
    const hit = this.playerHit(1, ba.element, false);
    if (ba.kind === 'melee') {
      let any = false;
      for (const m of this.hostilesNear(p.x, p.y, ba.range + 0.6)) {
        const a = angleTo(p.x, p.y, m.x, m.y);
        if (Math.abs(angleDiff(p.facing, a)) <= ((ba.arc ?? 90) * Math.PI) / 360 || dist(p.x, p.y, m.x, m.y) < 0.9) {
          this.damageMob(m, { ...hit }, p);
          any = true;
        }
      }
      if (any && this.char.classId === 'fighter') this.char.resource = Math.min(d.maxRes, this.char.resource + 4);
      this.hooks.sfx(any ? 'hit' : 'swing');
    } else {
      const a = target ? angleTo(p.x, p.y, target.x, target.y) : p.facing;
      const pr = new Projectile(p.x, p.y, a, ba.speed ?? 12, ba.range, 0, hit, ba.visual ?? 'arrow', p);
      this.projectiles.push(pr);
      this.hooks.sfx(ba.visual === 'arrow' ? 'bow' : 'zap');
    }
  }

  /** Rolls the player's damage for an attack with the given multiplier. */
  playerHit(mult: number, element: DamageType, isSpell: boolean, status?: HitInfo['status']): HitInfo {
    const d = this.session.derived;
    const statKey = scalingStat(this.char.classId, d.weapon, isSpell);
    const base = rng.range(d.dmgMin, d.dmgMax);
    const pct = 1 + (d.dmgPct + d.elemPct[element]) / 100;
    let amount = base * mult * statDamageMult(d.stats[statKey]) * pct;
    const crit = rng.chance(d.critChance / 100);
    if (crit) amount *= 1.5 + d.critDmg / 100 - 0.5;
    return { amount, crit, element, status, fromPlayer: true };
  }

  autoTarget(range: number, needLos: boolean): Mob | null {
    const p = this.player;
    let best: Mob | null = null;
    let bestScore = Infinity;
    for (const m of this.mobs) {
      if (m.dead || m.team === 0) continue;
      const d = dist(p.x, p.y, m.x, m.y);
      if (d > range) continue;
      if (needLos && !lineOfSight(this.map, p.x, p.y, m.x, m.y)) continue;
      const facingPenalty = Math.abs(angleDiff(p.facing, angleTo(p.x, p.y, m.x, m.y))) * 0.8;
      const score = d + facingPenalty;
      if (score < bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }

  hostilesNear(x: number, y: number, r: number, team: 0 | 1 = 1): Mob[] {
    const out: Mob[] = [];
    for (const m of this.mobs) if (!m.dead && m.team === team && dist2(x, y, m.x, m.y) <= (r + m.radius) * (r + m.radius)) out.push(m);
    return out;
  }

  /** Friendly actors (player and allies) near a point - targets for hostile attacks. */
  friendliesNear(x: number, y: number, r: number): Actor[] {
    const out: Actor[] = [];
    const p = this.player;
    if (!p.dead && dist2(x, y, p.x, p.y) <= (r + p.radius) ** 2) out.push(p);
    for (const m of this.mobs) if (!m.dead && m.team === 0 && dist2(x, y, m.x, m.y) <= (r + m.radius) ** 2) out.push(m);
    return out;
  }

  moveActor(a: Actor, dx: number, dy: number): void {
    const m = this.map;
    if (dx && circleFree(m, a.x + dx, a.y, a.radius)) a.x += dx;
    if (dy && circleFree(m, a.x, a.y + dy, a.radius)) a.y += dy;
  }

  unstick(a: Actor): void {
    for (let r = 0.5; r < 8; r += 0.5)
      for (let k = 0; k < 16; k++) {
        const x = a.x + Math.cos((k / 16) * Math.PI * 2) * r;
        const y = a.y + Math.sin((k / 16) * Math.PI * 2) * r;
        if (circleFree(this.map, x, y, a.radius)) {
          a.x = x;
          a.y = y;
          return;
        }
      }
  }

  private separate(): void {
    const all: Actor[] = [this.player, ...this.mobs.filter((m) => !m.dead)];
    const p = this.player;
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (dist2(a.x, a.y, p.x, p.y) > 400) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        const rr = a.radius + b.radius;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (rr - d) / d;
        const aHeavy = a instanceof Mob && a.boss;
        const bHeavy = b instanceof Mob && b.boss;
        let wa = a === p ? 0.3 : 0.5;
        if (aHeavy) wa = 0.05;
        if (bHeavy) wa = 0.95;
        if (b === p && !aHeavy) wa = 0.7;
        this.moveActor(a, -dx * push * wa, -dy * push * wa);
        this.moveActor(b, dx * push * (1 - wa), dy * push * (1 - wa));
      }
    }
  }

  // =================================================================== damage

  damageMob(m: Mob, hit: HitInfo, src: Actor | null): void {
    if (m.dead) return;
    let amt = hit.amount;
    if (hit.execute && m.hp / m.maxHp < 0.35) amt *= 1 + hit.execute;
    amt *= 1 + m.statusPower('vulnerable') / 100;
    const srcLvl = src?.level ?? this.char.level;
    if (hit.element === 'physical') amt *= 1 - m.armor / (m.armor + 50 + 10 * srcLvl);
    else amt *= 1 - clamp(m.resist[hit.element] ?? 0, -100, 90) / 100;
    amt = Math.max(1, Math.round(amt));
    m.hp -= amt;
    m.flash = 0.12;
    this.float(m.x, m.y, (hit.crit ? '' : '') + amt + (hit.crit ? '!' : ''), hit.crit ? '#ffd040' : ELEMENT_COLORS[hit.element], hit.crit ? 18 : 13);
    if (hit.status) this.applyStatus(m, hit.status, amt, hit.element);
    if (hit.knockback && !m.boss && src) {
      const a = angleTo(src.x, src.y, m.x, m.y);
      m.kbx = Math.cos(a) * hit.knockback * 6;
      m.kby = Math.sin(a) * hit.knockback * 6;
    }
    if (src === this.player) {
      const d = this.session.derived;
      if (d.lifeOnHit) this.char.hp = Math.min(d.maxHp, this.char.hp + d.lifeOnHit);
      this.player.combatTimer = 4;
    }
    if (m.state !== 'chase' && src && m.team === 1) {
      m.state = 'chase';
      m.target = src;
      this.alertPack(m, src);
    }
    if (m.hp <= 0) this.killMob(m, src);
  }

  applyStatus(a: Actor, st: NonNullable<HitInfo['status']>, hitAmount: number, element: DamageType): void {
    const dot = st.type === 'burn' || st.type === 'poison' || st.type === 'bleed';
    if (a instanceof Mob && a.boss && (st.type === 'stun' || st.type === 'root')) {
      st = { ...st, duration: st.duration * 0.35 };
    }
    const dps = dot ? (hitAmount * st.power) / Math.max(0.5, st.duration) : 0;
    const ex = a.statuses.find((s) => s.type === st.type);
    if (ex) {
      ex.time = Math.max(ex.time, st.duration);
      ex.power = Math.max(ex.power, st.power);
      ex.dps = Math.max(ex.dps, dps);
    } else a.statuses.push({ type: st.type, time: st.duration, power: st.power, dps, tick: 0.5, element });
  }

  tickStatuses(a: Actor, dt: number): void {
    if (!a.statuses.length) return;
    for (const s of a.statuses) {
      s.time -= dt;
      if (s.dps > 0) {
        s.tick -= dt;
        if (s.tick <= 0) {
          s.tick += 0.5;
          const amt = s.dps * 0.5;
          if (a === this.player) this.damagePlayer(amt, s.element, null, { dot: true });
          else if (a instanceof Mob) {
            let v = amt * (1 + a.statusPower('vulnerable') / 100);
            if (s.element !== 'physical') v *= 1 - clamp(a.resist[s.element] ?? 0, -100, 90) / 100;
            v = Math.max(1, Math.round(v));
            a.hp -= v;
            this.float(a.x, a.y, String(v), ELEMENT_COLORS[s.element], 11);
            if (a.hp <= 0 && !a.dead) this.killMob(a, this.player);
          }
        }
      }
    }
    a.statuses = a.statuses.filter((s) => s.time > 0);
  }

  damagePlayer(amount: number, element: DamageType, src: Mob | null, o: { dot?: boolean; status?: HitInfo['status'] } = {}): void {
    const p = this.player;
    if (p.dead || p.invuln > 0 || this.char.hp <= 0) return;
    const d = this.session.derived;
    let amt = amount;
    if (!o.dot) {
      if (element === 'physical' && rng.chance(d.dodge / 100)) {
        this.float(p.x, p.y, 'Dodge', '#c0c0c0', 12);
        return;
      }
      if (d.block > 0 && rng.chance(d.block / 100)) {
        amt *= 0.5;
        this.float(p.x, p.y, 'Block', '#c0c0ff', 12);
      }
    }
    const lvl = src?.level ?? p.level;
    if (element === 'physical') amt *= 1 - d.armor / (d.armor + 40 + 15 * lvl);
    else amt *= 1 - d.resist / 100;
    if (p.manaShield) {
      const want = (amt * p.manaShield.absorb) / 100;
      const take = Math.min(this.char.resource, want);
      this.char.resource -= take;
      amt -= take;
    }
    amt = Math.max(o.dot ? 0 : 1, amt);
    this.char.hp -= amt;
    p.hp = this.char.hp;
    p.flash = 0.15;
    p.combatTimer = 4;
    if (amt >= 1) this.float(p.x, p.y, String(Math.round(amt)), '#ff5050', o.dot ? 11 : 14);
    if (!o.dot) {
      this.shake = Math.max(this.shake, Math.min(0.5, (amt / d.maxHp) * 2));
      if (p.channel) {
        p.channel = null;
        this.toast('Interrupted!');
      }
      this.hooks.sfx('hurt');
    }
    if (o.status) this.applyStatus(p, o.status, amt, element);
    if (this.char.hp <= 0) this.playerDeath();
  }

  /** Damage dealt by hostiles to an ally (guards, summons). */
  damageAlly(m: Mob, amount: number, element: DamageType, src: Mob | null): void {
    if (m.dead) return;
    let amt = amount;
    if (element === 'physical') amt *= 1 - m.armor / (m.armor + 40 + 15 * (src?.level ?? 1));
    amt = Math.max(1, Math.round(amt));
    m.hp -= amt;
    m.flash = 0.12;
    this.float(m.x, m.y, String(amt), '#ffa0a0', 11);
    if (m.hp <= 0) {
      m.dead = true;
      m.deathTime = this.time;
      if (m.def.id === 'town_guard') this.toast('A guard has fallen!');
    }
  }

  /** Generic hostile hit on any friendly actor. */
  hitFriendly(t: Actor, amount: number, element: DamageType, src: Mob | null, status?: HitInfo['status']): void {
    if (t === this.player) this.damagePlayer(amount, element, src, { status });
    else if (t instanceof Mob) {
      this.damageAlly(t, amount, element, src);
      if (status) this.applyStatus(t, status, amount, element);
    }
  }

  alertPack(m: Mob, target: Actor): void {
    if (m.pack < 0) return;
    for (const o of this.mobs) {
      if (o === m || o.dead || o.pack !== m.pack || o.team !== m.team) continue;
      if (o.state !== 'chase') {
        o.state = 'chase';
        o.target = target;
      }
    }
  }

  killMob(m: Mob, src: Actor | null): void {
    if (m.dead) return;
    m.dead = true;
    m.deathTime = this.time;
    m.hp = 0;
    m.statuses = [];
    if (m.team === 0) return;
    const s = this.session;
    this.burst(m.x, m.y, m.def.color2, m.boss ? 40 : 14);
    this.hooks.sfx(m.boss ? 'bossdie' : 'die');
    void src;
    // experience
    const zs = this.map.isTown ? null : s.zoneState(this.zoneId);
    const isSummon = !!m.owner;
    let xp = xpForKill(m.def.xp, m.level, this.char.level, zs?.timesCleared ?? 0, m.elite) * (isSummon ? 0.25 : 1) * m.xpMult;
    if (m.bountyId) xp *= 2;
    xp = Math.round(xp);
    if (xp > 0) {
      s.gainXp(xp);
      this.float(m.x, m.y, `+${xp} xp`, '#c8a0ff', 12, 1.2);
    }
    // loot
    const d = s.derived;
    const loot = rollLoot(rng, m.level, {
      elite: m.elite || !!m.bountyId,
      boss: m.boss,
      magicFind: d.magicFind,
      goldFind: d.goldFind,
      classId: this.char.classId,
      drops: isSummon ? [] : m.def.drops,
    });
    if (isSummon) loot.items = [];
    if (loot.gold) this.dropPickup(m.x, m.y, null, loot.gold);
    for (const it of loot.items) this.dropPickup(m.x, m.y, it, 0);
    // bookkeeping
    s.data.stats.kills++;
    if (m.spawnId && zs) {
      zs.killed.push(m.spawnId);
      const remaining = this.mobs.some((o) => !o.dead && o.spawnId && !o.boss && o.team === 1);
      if (!remaining && !zs.clearedThisCycle) {
        zs.clearedThisCycle = true;
        bus.emit('toast', { text: `${zoneName(this.zoneId)} cleared! Enemies return when you go back to town.`, color: '#a0ffa0' });
      }
    }
    if (m.boss && !s.data.stats.bossesSlain.includes(m.def.id)) {
      s.data.stats.bossesSlain.push(m.def.id);
    }
    if (m.boss) {
      bus.emit('toast', { text: `${m.name} has been slain!`, color: '#ffb040' });
      this.shake = 1;
    }
    s.recordKill(m.def.id, this.zoneId, { bountyId: m.bountyId ?? undefined });
    bus.emit('kill', { enemyId: m.def.id, zoneId: this.zoneId, elite: m.elite, boss: m.boss });
    if (this.raid && m.pack === -3) {
      this.raid.remaining--;
      if (this.raid.remaining <= 0) {
        const reward = this.raid.reward;
        this.char.gold += reward;
        s.data.town.donated += Math.round(reward / 2);
        bus.emit('toast', { text: `Raid repelled! The town rewards you ${reward} gold and grows stronger.`, color: '#ffd060' });
        this.raid = null;
        s.invalidate();
      }
    }
  }

  dropPickup(x: number, y: number, item: Item | null, gold: number): void {
    const pk = new Pickup(x + rng.range(-0.6, 0.6), y + rng.range(-0.6, 0.6), item, gold);
    if (!circleFree(this.map, pk.x, pk.y, 0.1)) {
      pk.x = x;
      pk.y = y;
    }
    this.pickups.push(pk);
  }

  private playerDeath(): void {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    p.deathTime = this.time;
    p.channel = null;
    p.dash = null;
    p.spin = null;
    const s = this.session;
    s.data.stats.deaths++;
    // Lose half your gold, which can be recovered where you fell (if you make it back alive)
    const lost = Math.floor(this.char.gold / 2);
    if (!this.map.isTown && lost > 0) {
      this.char.gold -= lost;
      s.data.world.satchel = { zoneId: this.zoneId, x: p.x, y: p.y, gold: lost };
    } else if (!this.map.isTown) s.data.world.satchel = null;
    this.hooks.sfx('death');
    bus.emit('playerDied', {});
    this.hooks.playerDied();
  }

  // =================================================================== projectiles & ground

  private updateProjectiles(dt: number): void {
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      pr.age += dt;
      if (pr.homing && !pr.homing.dead) {
        const want = angleTo(pr.x, pr.y, pr.homing.x, pr.homing.y);
        const cur = Math.atan2(pr.vy, pr.vx);
        const na = cur + clamp(angleDiff(cur, want), -dt * 6, dt * 6);
        pr.vx = Math.cos(na) * pr.speed;
        pr.vy = Math.sin(na) * pr.speed;
      }
      const sx = pr.vx * dt;
      const sy = pr.vy * dt;
      pr.x += sx;
      pr.y += sy;
      pr.traveled += Math.hypot(sx, sy);
      if (pr.orb) {
        pr.orb.next -= dt;
        if (pr.orb.next <= 0) {
          pr.orb.next = pr.orb.tick;
          for (const m of this.hostilesNear(pr.x, pr.y, pr.orb.radius)) {
            this.damageMob(m, { ...pr.hit, crit: false }, pr.owner);
            this.bolts.push({ x0: pr.x, y0: pr.y, x1: m.x, y1: m.y, time: 0.12, color: '#c0e0ff' });
          }
        }
        if (pr.traveled >= pr.range) pr.dead = true;
        continue;
      }
      if (this.isBlocked(pr.x, pr.y)) {
        this.projectileEnd(pr);
        continue;
      }
      if (pr.traveled >= pr.range) {
        this.projectileEnd(pr);
        continue;
      }
      if (pr.team === 0) {
        for (const m of this.mobs) {
          if (m.dead || m.team !== 1 || pr.hitIds.has(m.id)) continue;
          if (dist2(pr.x, pr.y, m.x, m.y) > (m.radius + pr.radius) ** 2) continue;
          pr.hitIds.add(m.id);
          this.damageMob(m, { ...pr.hit }, pr.owner);
          if (pr.chain && pr.chain.count > 0) this.chainFrom(pr, m);
          if (!pr.pierce) {
            this.projectileEnd(pr, m);
            break;
          }
        }
      } else {
        for (const t of this.friendliesNear(pr.x, pr.y, 0.1)) {
          if (pr.hitIds.has(t.id)) continue;
          pr.hitIds.add(t.id);
          this.hitFriendly(t, pr.hit.amount, pr.hit.element, pr.owner as Mob | null, pr.hit.status);
          if (pr.slow) this.applyStatus(t, { type: 'slow', power: pr.slow.power, duration: pr.slow.duration }, 0, 'physical');
          pr.dead = true;
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  private isBlocked(x: number, y: number): boolean {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return true;
    return this.map.opaque[ty * this.map.w + tx] !== 0;
  }

  private chainFrom(pr: Projectile, from: Mob): void {
    let cur: Mob = from;
    const hitSet = new Set<number>([from.id]);
    for (let i = 0; i < (pr.chain?.count ?? 0); i++) {
      let best: Mob | null = null;
      let bd = pr.chain!.range;
      for (const m of this.mobs) {
        if (m.dead || m.team !== 1 || hitSet.has(m.id)) continue;
        const d = dist(cur.x, cur.y, m.x, m.y);
        if (d < bd) {
          bd = d;
          best = m;
        }
      }
      if (!best) break;
      hitSet.add(best.id);
      this.bolts.push({ x0: cur.x, y0: cur.y, x1: best.x, y1: best.y, time: 0.2, color: '#f0f070' });
      this.damageMob(best, { ...pr.hit, amount: pr.hit.amount * 0.85 }, pr.owner);
      cur = best;
    }
    pr.chain = undefined;
  }

  private projectileEnd(pr: Projectile, _hitMob?: Mob): void {
    pr.dead = true;
    if (pr.explode) {
      for (const m of this.hostilesNear(pr.x, pr.y, pr.explode.radius)) this.damageMob(m, { ...pr.explode.hit }, pr.owner);
      this.ring(pr.x, pr.y, pr.explode.radius, '#ff8a3a', 0.35);
      this.burst(pr.x, pr.y, '#ffa040', 18);
      this.shake = Math.max(this.shake, 0.2);
      this.hooks.sfx('boom');
    }
    if (pr.cloud) {
      this.grounds.push(new GroundEffect({ x: pr.x, y: pr.y, radius: pr.cloud.radius, duration: pr.cloud.duration, tick: pr.cloud.tick, team: pr.team, hit: pr.cloud.hit, visual: 'poison', owner: pr.owner }));
    }
    if (pr.visual !== 'arrow') this.burst(pr.x, pr.y, projColor(pr.visual), 5);
  }

  private updateGrounds(dt: number): void {
    for (const g of this.grounds) {
      g.time += dt;
      if (g.trap) {
        const victims = this.hostilesNear(g.x, g.y, g.radius);
        if (victims.length) {
          const v = victims[0];
          if (g.impact) this.damageMob(v, { ...g.impact }, g.owner);
          this.applyStatus(v, { type: 'root', power: 1, duration: g.trap.root }, 0, 'physical');
          this.burst(g.x, g.y, '#c0c0c0', 8);
          this.hooks.sfx('hit');
          g.dead = true;
        }
        if (g.time > g.duration) g.dead = true;
        continue;
      }
      if (g.time < g.delay) continue;
      if (g.impact) {
        const hit = g.impact;
        g.impact = null;
        if (g.team === 0) for (const m of this.hostilesNear(g.x, g.y, g.radius)) this.damageMob(m, { ...hit }, g.owner);
        else for (const t of this.friendliesNear(g.x, g.y, g.radius)) this.hitFriendly(t, hit.amount, hit.element, g.owner as Mob | null, hit.status);
        this.ring(g.x, g.y, g.radius, g.visual === 'root' ? '#6ac04a' : '#ffb060', 0.4);
        this.burst(g.x, g.y, g.visual === 'root' ? '#6ac04a' : '#ff8a3a', 20);
        if (g.visual === 'meteor' || g.visual === 'telegraph') {
          this.shake = Math.max(this.shake, 0.4);
          this.hooks.sfx('boom');
        }
      }
      if (g.hit) {
        g.nextTick -= dt;
        if (g.nextTick <= 0) {
          g.nextTick += g.tick;
          if (g.team === 0) for (const m of this.hostilesNear(g.x, g.y, g.radius)) this.damageMob(m, { ...g.hit, crit: false }, g.owner);
          else for (const t of this.friendliesNear(g.x, g.y, g.radius)) this.hitFriendly(t, g.hit.amount, g.hit.element, g.owner as Mob | null, g.hit.status);
        }
      }
      if (g.time >= g.delay + g.duration) g.dead = true;
    }
    this.grounds = this.grounds.filter((g) => !g.dead);
  }

  // =================================================================== loot & interaction

  private updatePickups(dt: number): void {
    const p = this.player;
    const s = this.session;
    this.heavyWarn = Math.max(0, this.heavyWarn - dt);
    for (const pk of this.pickups) {
      pk.age += dt;
      if (pk.z > 0 || pk.vz > 0) {
        pk.vz -= 14 * dt;
        pk.z = Math.max(0, pk.z + pk.vz * dt);
        if (pk.z === 0) pk.vz = 0;
      }
      if (p.dead || pk.age < 0.4) continue;
      const d = dist(p.x, p.y, pk.x, pk.y);
      if (pk.gold > 0 && !pk.item && d < 1.7) {
        this.char.gold += pk.gold;
        this.float(pk.x, pk.y, `+${pk.gold}g`, '#ffd040', 12);
        if (pk.satchel) {
          s.data.world.satchel = null;
          bus.emit('toast', { text: `You recovered your lost satchel (${pk.gold} gold).`, color: '#ffd060' });
        }
        pk.gold = 0;
        this.hooks.sfx('coin');
        continue;
      }
      if (pk.item && d < 0.9) {
        // auto-pickup only while it keeps you un-burdened; heavier items need a manual pickup
        const w = itemWeight(pk.item);
        if (s.carried() + w <= s.capacity()) this.takePickup(pk);
        else if (this.heavyWarn <= 0) {
          this.heavyWarn = 3;
          this.toast('Picking that up will overburden you. Tap Pick Up to take it anyway.');
        }
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.item || pk.gold > 0);
  }

  takePickup(pk: Pickup): boolean {
    if (!pk.item) return false;
    const info = getInfo(pk.item);
    if (!this.session.addItem(pk.item)) {
      this.toast("You can't carry any more!");
      return false;
    }
    this.float(pk.x, pk.y, `${info.name}${pk.item.qty > 1 ? ' x' + pk.item.qty : ''}`, info.stack ? '#e0e0e0' : ['#e8e8e8', '#4fd05a', '#4a9af0', '#b060f0', '#ff9a20'][info.rarity], 12, 1.4);
    pk.item = null;
    this.hooks.sfx('pickup');
    return true;
  }

  private findInteraction(): void {
    const p = this.player;
    let best: Interaction | null = null;
    let bd = Infinity;
    const consider = (i: Interaction, range: number) => {
      const d = dist(p.x, p.y, i.x, i.y);
      if (d <= range && d < bd) {
        bd = d;
        best = i;
      }
    };
    for (const n of this.npcs) consider({ kind: 'npc', npc: n, label: `Talk to ${n.def.name}`, x: n.x, y: n.y }, 2);
    for (const st of this.map.stations) {
      const labels: Record<Station['kind'], string> = { board: 'Bounty Board', anvil: 'Forge', range: 'Cook', chest: 'Storage', stash: 'Guild Vault', waystone: 'Waystone' };
      consider({ kind: 'station', station: st, label: labels[st.kind], x: st.x, y: st.y }, 1.9);
    }
    if (this.map.waystone && !this.map.isTown) consider({ kind: 'station', station: { kind: 'waystone', x: this.map.waystone.x, y: this.map.waystone.y }, label: 'Waystone', x: this.map.waystone.x, y: this.map.waystone.y }, 1.9);
    for (const f of this.campfires) consider({ kind: 'campfire', fire: f, label: 'Cook at Campfire', x: f.x, y: f.y }, 2);
    const zs = this.session.zoneState(this.zoneId);
    for (const n of this.map.nodes) {
      if (this.nodeDepleted(n.id, zs.depleted)) continue;
      const def = NODES[n.nodeId];
      const verb = { mining: 'Mine', woodcutting: 'Chop', fishing: 'Fish', foraging: 'Gather', cooking: 'Cook' }[def.skill];
      consider({ kind: 'node', node: n, def, label: `${verb} ${def.name}`, x: n.x, y: n.y }, def.skill === 'fishing' ? 2.2 : 1.6);
    }
    for (const pk of this.pickups) {
      if (!pk.item) continue;
      consider({ kind: 'loot', pickup: pk, label: `Pick up ${getInfo(pk.item).name}`, x: pk.x, y: pk.y }, 1.4);
    }
    this.interaction = best;
  }

  nodeDepleted(id: string, depleted: Record<string, number>): boolean {
    const t = depleted[id];
    if (t === undefined) return false;
    if (this.clock >= t) {
      delete depleted[id];
      this.nodeYield.delete(id);
      return false;
    }
    return true;
  }

  interact(): void {
    const i = this.interaction;
    if (!i) return;
    switch (i.kind) {
      case 'npc':
        i.npc.facing = angleTo(i.npc.x, i.npc.y, this.player.x, this.player.y);
        this.hooks.openNpc(i.npc.def.id);
        break;
      case 'station':
        this.hooks.openStation(i.station.kind);
        break;
      case 'campfire':
        this.hooks.openCampfire();
        break;
      case 'loot':
        this.takePickup(i.pickup);
        break;
      case 'node':
        this.startGather(i.node, i.def);
        break;
    }
  }

  startGather(node: NodeSpawn, def: NodeDef): void {
    const s = this.session;
    const lvl = s.lifeLevel(def.skill);
    if (lvl < def.level) {
      this.toast(`Requires ${def.skill[0].toUpperCase() + def.skill.slice(1)} level ${def.level}`);
      return;
    }
    const tool = (Object.keys(TOOL_INFO) as (keyof typeof TOOL_INFO)[]).find((t) => TOOL_INFO[t].skill === def.skill)!;
    const speed = s.toolSpeed(tool) * (1 + (lvl - def.level) * 0.015) * (1 + s.derived.gatherSpeed / 100);
    const p = this.player;
    p.facing = angleTo(p.x, p.y, node.x, node.y);
    p.channel = { kind: 'gather', time: 0, total: def.time / speed, label: def.name, nodeKey: node.id };
  }

  private completeChannel(): void {
    const p = this.player;
    const ch = p.channel!;
    if (ch.kind === 'recall') {
      p.channel = null;
      this.hooks.recallComplete();
      return;
    }
    const node = this.map.nodes.find((n) => n.id === ch.nodeKey);
    if (!node) {
      p.channel = null;
      return;
    }
    const def = NODES[node.nodeId];
    const s = this.session;
    const item = STACKABLES[def.item];
    const lvl = s.lifeLevel(def.skill);
    const qty = rng.chance(Math.min(0.3, (lvl - def.level) * 0.006 + 0.02)) ? 2 : 1;
    const stack = makeStack(def.item, qty);
    if (!s.addItem(stack)) {
      this.toast("You can't carry any more!");
      p.channel = null;
      return;
    }
    s.gainLifeXp(def.skill, def.xp * qty);
    this.float(node.x, node.y, `+${qty} ${item.name}`, '#e0ffe0', 12, 1.2);
    this.float(p.x, p.y, `+${def.xp * qty} ${def.skill}`, '#80d0ff', 11, 1.4);
    this.burst(node.x, node.y, def.color, 6);
    this.hooks.sfx(def.skill === 'mining' ? 'mine' : def.skill === 'woodcutting' ? 'chop' : 'pickup');
    // yield / depletion
    let left = this.nodeYield.get(node.id);
    if (left === undefined) left = rng.int(def.yield[0], def.yield[1]);
    left--;
    if (left <= 0) {
      this.nodeYield.delete(node.id);
      s.zoneState(this.zoneId).depleted[node.id] = this.clock + def.respawn;
      p.channel = null;
      this.toast(`The ${def.name.toLowerCase()} is depleted.`);
      return;
    }
    this.nodeYield.set(node.id, left);
    // keep gathering automatically
    ch.time = 0;
  }

  startRecall(): void {
    if (this.map.isTown) {
      this.toast('You are already in town.');
      return;
    }
    if (this.player.combatTimer > 0) {
      this.toast("You can't recall while in combat.");
      return;
    }
    this.player.channel = { kind: 'recall', time: 0, total: 4, label: 'Recalling to Hearthvale' };
  }

  lightCampfire(logUid: string): string | null {
    if (this.map.isTown) return 'You can cook at the inn range in town.';
    const it = this.char.inventory.find((i) => i.uid === logUid);
    if (!it || !STACKABLES[it.id]?.source || STACKABLES[it.id].source!.skill !== 'woodcutting') return 'You need logs to light a fire.';
    const p = this.player;
    const x = p.x + Math.cos(p.facing) * 1.1;
    const y = p.y + Math.sin(p.facing) * 1.1;
    const fx = circleFree(this.map, x, y, 0.2) ? x : p.x;
    const fy = circleFree(this.map, x, y, 0.2) ? y : p.y;
    this.session.removeItem(logUid, 1);
    const tier = STACKABLES[it.id].source!.level;
    this.campfires.push(new Campfire(fx, fy, 120 + tier * 3));
    this.session.gainLifeXp('woodcutting', 5);
    this.hooks.sfx('fire');
    return null;
  }

  private checkExits(): void {
    if (this.exitLock > 0) return;
    const p = this.player;
    for (const e of this.map.exits) {
      if (p.x >= e.x0 && p.x < e.x1 && p.y >= e.y0 && p.y < e.y1) {
        if (!this.session.isZoneUnlocked(e.to)) {
          this.toast('The Guild has not yet granted passage. Complete your Guild contracts first.');
          // nudge back
          p.y += e.y0 === 0 ? 1 : -1;
          this.exitLock = 1;
          return;
        }
        this.exitLock = 2;
        this.hooks.exitZone(e);
        return;
      }
    }
  }

  // =================================================================== effects

  toast(text: string): void {
    bus.emit('toast', { text });
  }

  float(x: number, y: number, text: string, color: string, size = 13, life = 0.9): void {
    if (this.floats.length > 80) this.floats.shift();
    this.floats.push({ x: x + rng.range(-0.2, 0.2), y, z: 1.2, text, color, time: life, size });
  }

  burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 400) this.particles.shift();
      const a = rng.range(0, Math.PI * 2);
      const sp = rng.range(0.5, 3);
      this.particles.push({ x, y, z: 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rng.range(1, 4), life: rng.range(0.3, 0.8), max: 0.8, color, size: rng.range(2, 4), gravity: 9 });
    }
  }

  ring(x: number, y: number, radius: number, color: string, time: number): void {
    this.rings.push({ x, y, radius, time, max: time, color });
  }

  private updateFx(dt: number): void {
    for (const f of this.floats) {
      f.time -= dt;
      f.z += dt * 1.2;
    }
    this.floats = this.floats.filter((f) => f.time > 0);
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vz -= pt.gravity * dt;
      pt.z = Math.max(0, pt.z + pt.vz * dt);
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const b of this.bolts) b.time -= dt;
    this.bolts = this.bolts.filter((b) => b.time > 0);
    for (const r of this.rings) r.time -= dt;
    this.rings = this.rings.filter((r) => r.time > 0);
    for (const m of this.mobs) m.flash = Math.max(0, m.flash - dt);
  }
}

export function projColor(v: string): string {
  switch (v) {
    case 'fire':
      return '#ff7a2a';
    case 'frost':
      return '#9ae0ff';
    case 'spark':
    case 'orb':
      return '#f0f070';
    case 'poison':
      return '#7ae04a';
    case 'missile':
    case 'bolt':
      return '#d08aff';
    default:
      return '#d0c0a0';
  }
}
