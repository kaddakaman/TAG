import type { DamageType, Item } from '../types';
import type { ProjVisual, StatusType } from '../data/abilities';
import { ENEMIES, ENEMY_SCALING, type EnemyDef, type SpecialDef } from '../data/enemies';
import type { NpcDef } from '../data/town';

export interface StatusEffect {
  type: StatusType;
  time: number;
  power: number;
  dps: number;
  tick: number;
  element: DamageType;
}

let nextId = 1;

export class Actor {
  id = nextId++;
  team: 0 | 1 = 1;
  x = 0;
  y = 0;
  radius = 0.35;
  facing = Math.PI / 4;
  hp = 1;
  maxHp = 1;
  level = 1;
  dead = false;
  deathTime = 0;
  statuses: StatusEffect[] = [];
  flash = 0;
  walkPhase = 0;
  moving = false;
  attackAnim = 0;
  attackAnimDur = 0.3;
  kbx = 0;
  kby = 0;
  invuln = 0;
  armor = 0;
  resist: Partial<Record<DamageType, number>> = {};

  statusPower(type: StatusType): number {
    let p = 0;
    for (const s of this.statuses) if (s.type === type && s.power > p) p = s.power;
    return p;
  }
  has(type: StatusType): boolean {
    return this.statuses.some((s) => s.type === type);
  }
  get stunned(): boolean {
    return this.has('stun');
  }
  get rooted(): boolean {
    return this.has('root') || this.has('stun');
  }
  speedMult(): number {
    return 1 - Math.min(0.8, this.statusPower('slow') / 100);
  }
}

export interface Channel {
  kind: 'gather' | 'recall';
  time: number;
  total: number;
  label: string;
  nodeKey?: string;
}

export class Player extends Actor {
  team: 0 | 1 = 0;
  radius = 0.32;
  cooldowns: Record<string, number> = {};
  cdTotals: Record<string, number> = {};
  attackCd = 0;
  dash: { tx: number; ty: number; speed: number; onArrive?: () => void } | null = null;
  spin: { time: number; tick: number; next: number; radius: number; mult: number } | null = null;
  strikes: { left: number; interval: number; next: number; radius: number; mult: number; element: DamageType } | null = null;
  channel: Channel | null = null;
  manaShield: { remaining: number; absorb: number } | null = null;
  combatTimer = 0;
  lastMoveX = 1;
  lastMoveY = 1;
  spinAngle = 0;
}

export class Mob extends Actor {
  def: EnemyDef;
  spawnId: string | null = null;
  elite = false;
  boss = false;
  name: string;
  homeX: number;
  homeY: number;
  pack = -1;
  dmg: number;
  speed: number;
  attackCd: number;
  attackTimer = 0.5;
  state: 'idle' | 'chase' | 'return' = 'idle';
  target: Actor | null = null;
  wanderTimer = Math.random() * 3;
  wanderX = 0;
  wanderY = 0;
  specialCds: number[];
  windup: { kind: string; time: number; total: number; tx: number; ty: number; special?: SpecialDef; angle: number } | null = null;
  charging: { vx: number; vy: number; time: number; hit: boolean; mult: number } | null = null;
  enraged = false;
  lifetime = -1;
  bountyId: string | null = null;
  xpMult = 1;
  summons = 0;
  owner: Mob | null = null;
  aggro: number;
  lastSeen = 0;
  bob = Math.random() * 10;

  constructor(enemyId: string, level: number, x: number, y: number, opts: { elite?: boolean; boss?: boolean; team?: 0 | 1; name?: string } = {}) {
    super();
    const def = ENEMIES[enemyId];
    if (!def) throw new Error('Unknown enemy ' + enemyId);
    this.def = def;
    this.level = Math.max(1, level);
    this.x = this.homeX = x;
    this.y = this.homeY = y;
    this.elite = !!opts.elite;
    this.boss = !!opts.boss || !!def.boss;
    this.team = opts.team ?? 1;
    const eliteHp = this.elite ? 3 : 1;
    this.maxHp = this.hp = Math.round(def.hp * ENEMY_SCALING.hp(this.level) * eliteHp);
    this.dmg = def.dmg * ENEMY_SCALING.dmg(this.level) * (this.elite ? 1.4 : 1);
    this.armor = Math.round(def.armor * ENEMY_SCALING.armor(this.level));
    this.speed = def.speed * (this.elite ? 1.1 : 1);
    this.attackCd = def.attackCd;
    this.radius = 0.32 * def.size * (this.elite ? 1.15 : 1);
    this.resist = { ...(def.resist ?? {}) };
    this.specialCds = (def.specials ?? []).map((s) => s.cd * (0.4 + Math.random() * 0.6));
    this.name = opts.name ?? (def.title ? `${def.name}, ${def.title}` : def.name);
    this.aggro = def.aggro ?? (this.boss ? 9 : 7.5);
    this.facing = Math.random() * Math.PI * 2;
  }

  get size(): number {
    return this.def.size * (this.elite ? 1.15 : 1);
  }
}

export interface HitInfo {
  amount: number;
  crit: boolean;
  element: DamageType;
  status?: { type: StatusType; power: number; duration: number };
  knockback?: number;
  /** extra multiplier against low-life targets */
  execute?: number;
  fromPlayer: boolean;
}

export class Projectile {
  id = nextId++;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  range: number;
  traveled = 0;
  team: 0 | 1;
  hit: HitInfo;
  pierce = false;
  hitIds = new Set<number>();
  visual: ProjVisual;
  dead = false;
  explode?: { radius: number; hit: HitInfo };
  chain?: { count: number; range: number };
  cloud?: { radius: number; duration: number; tick: number; hit: HitInfo };
  orb?: { tick: number; radius: number; next: number };
  homing: Actor | null = null;
  radius = 0.25;
  slow?: { power: number; duration: number };
  owner: Actor | null;
  age = 0;
  constructor(x: number, y: number, angle: number, speed: number, range: number, team: 0 | 1, hit: HitInfo, visual: ProjVisual, owner: Actor | null) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.range = range;
    this.team = team;
    this.hit = hit;
    this.visual = visual;
    this.owner = owner;
  }
}

export type GroundVisual = 'meteor' | 'blizzard' | 'arrows' | 'poison' | 'fire' | 'telegraph' | 'trap' | 'root' | 'campfire';

export class GroundEffect {
  id = nextId++;
  x: number;
  y: number;
  radius: number;
  delay: number;
  duration: number;
  tick: number;
  nextTick = 0;
  team: 0 | 1;
  hit: HitInfo | null;
  impact: HitInfo | null;
  visual: GroundVisual;
  time = 0;
  dead = false;
  owner: Actor | null;
  /** traps fire once when an enemy steps in */
  trap?: { root: number };
  constructor(o: {
    x: number; y: number; radius: number; delay?: number; duration?: number; tick?: number; team: 0 | 1;
    hit?: HitInfo | null; impact?: HitInfo | null; visual: GroundVisual; owner?: Actor | null;
  }) {
    this.x = o.x;
    this.y = o.y;
    this.radius = o.radius;
    this.delay = o.delay ?? 0;
    this.duration = o.duration ?? 0;
    this.tick = o.tick ?? 0.5;
    this.team = o.team;
    this.hit = o.hit ?? null;
    this.impact = o.impact ?? null;
    this.visual = o.visual;
    this.owner = o.owner ?? null;
  }
}

export class Pickup {
  id = nextId++;
  x: number;
  y: number;
  item: Item | null;
  gold: number;
  age = 0;
  vz = 3;
  z = 0;
  satchel = false;
  constructor(x: number, y: number, item: Item | null, gold = 0) {
    this.x = x;
    this.y = y;
    this.item = item;
    this.gold = gold;
  }
}

export class Campfire {
  id = nextId++;
  x: number;
  y: number;
  time: number;
  constructor(x: number, y: number, time: number) {
    this.x = x;
    this.y = y;
    this.time = time;
  }
}

export class Npc {
  def: NpcDef;
  x: number;
  y: number;
  facing: number;
  bob = Math.random() * 10;
  constructor(def: NpcDef) {
    this.def = def;
    this.x = def.x;
    this.y = def.y;
    this.facing = def.facing;
  }
}

export interface FloatText {
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  time: number;
  size: number;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  color: string;
  size: number;
  gravity: number;
}

export interface Bolt {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  time: number;
  color: string;
}

export interface Ring {
  x: number;
  y: number;
  radius: number;
  time: number;
  max: number;
  color: string;
}
