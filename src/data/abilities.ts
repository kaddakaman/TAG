import type { Bonus, ClassId, DamageType, OffhandType, WeaponType } from '../types';

export type R = (rank: number) => number;
/** linear per-rank scaling helper */
export const L = (base: number, per: number): R => (r: number) => base + per * (Math.max(1, r) - 1);
export const C = (v: number): R => () => v;

export type StatusType = 'burn' | 'poison' | 'bleed' | 'slow' | 'stun' | 'vulnerable' | 'root';

export interface StatusSpec {
  type: StatusType;
  /** DoTs: fraction of the hit dealt over the duration. slow/vulnerable: percent. */
  power: R;
  duration: R;
}

export type ProjVisual = 'arrow' | 'bolt' | 'fire' | 'frost' | 'spark' | 'orb' | 'poison' | 'missile' | 'rock';

export interface ProjectileSpec {
  speed: number;
  range: number;
  dmg: R;
  element: DamageType;
  count?: R;
  spread?: number;
  pierce?: boolean;
  homing?: boolean;
  explode?: { radius: number; dmg: R };
  cloud?: { radius: number; duration: number; tick: number; dmg: R; element: DamageType; status?: StatusSpec };
  chain?: { count: R; range: number };
  orb?: { tick: number; radius: number };
  status?: StatusSpec;
  visual: ProjVisual;
}

export type AbilityEffect =
  | { type: 'melee'; range: number; arc: number; dmg: R; element?: DamageType; status?: StatusSpec; knockback?: number; executeBonus?: number }
  | { type: 'projectile'; proj: ProjectileSpec }
  | { type: 'dash'; distance: number; range: number; arc: number; dmg: R; status?: StatusSpec }
  | { type: 'spin'; duration: number; tick: number; radius: number; dmg: R }
  | { type: 'nova'; radius: number; dmg: R; element: DamageType; status?: StatusSpec; visual: string }
  | {
      type: 'ground';
      at: 'target' | 'self';
      radius: number;
      delay: number;
      duration: number;
      tick: number;
      dmg: R;
      impactDmg?: R;
      element: DamageType;
      status?: StatusSpec;
      visual: 'meteor' | 'blizzard' | 'arrows' | 'poison' | 'fire';
    }
  | { type: 'strikes'; count: R; radius: number; interval: number; dmg: R; element: DamageType }
  | { type: 'buff'; buffId: string; duration: R; bonus: (r: number) => Bonus }
  | { type: 'heal'; pct: R }
  | { type: 'blink'; distance: number }
  | { type: 'roll'; distance: number; invuln: number }
  | { type: 'trap'; dmg: R; radius: number; root: R; duration: number }
  | { type: 'mark'; pct: R; duration: number }
  | { type: 'summon'; creature: string; count: R; duration: R }
  | { type: 'manaShield'; duration: R; absorb: R };

export interface AbilityDef {
  id: string;
  classId: ClassId;
  tree: string;
  name: string;
  icon: string;
  kind: 'active' | 'passive';
  major?: boolean;
  maxRank: number;
  reqLevel: number;
  prereq?: { id: string; rank: number };
  weapons?: WeaponType[];
  offhand?: OffhandType;
  cost?: R;
  cooldown?: R;
  effect?: AbilityEffect;
  passive?: { weapons?: WeaponType[]; bonus: (r: number) => Bonus };
  desc: (r: number) => string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const TREES: Record<ClassId, { id: string; name: string; desc: string }[]> = {
  fighter: [
    { id: 'blades', name: 'Blades', desc: 'Sword techniques: sweeping cuts and lightning lunges.' },
    { id: 'axes', name: 'Axes', desc: 'Brutal axe work: bleeding wounds and execution.' },
    { id: 'hammers', name: 'Hammers', desc: 'Maces and hammers: stuns and earth-shaking slams.' },
    { id: 'warfare', name: 'Warfare', desc: 'Battlefield craft usable with any weapon.' },
  ],
  mage: [
    { id: 'fire', name: 'Fire', desc: 'Burning damage over time and explosive area spells.' },
    { id: 'frost', name: 'Frost', desc: 'Slow, freeze and shatter your enemies.' },
    { id: 'lightning', name: 'Lightning', desc: 'Chaining bolts and devastating storms.' },
    { id: 'arcane', name: 'Arcane', desc: 'Utility magic: teleportation and shielding.' },
  ],
  ranger: [
    { id: 'archery', name: 'Archery', desc: 'Piercing shots and volleys of arrows.' },
    { id: 'poisons', name: 'Poisons', desc: 'Coat your arrows in deadly venom.' },
    { id: 'survival', name: 'Survival', desc: 'Traps, evasion and beasts of the wild.' },
  ],
};

export const ABILITIES: AbilityDef[] = [
  // ======================= FIGHTER =======================
  {
    id: 'cleave', classId: 'fighter', tree: 'blades', name: 'Cleave', icon: '⚔', kind: 'active',
    maxRank: 5, reqLevel: 1, weapons: ['sword'], cost: C(12), cooldown: C(3),
    effect: { type: 'melee', range: 2.3, arc: 160, dmg: L(1.5, 0.15) },
    desc: (r) => `Sweep your sword in a wide arc dealing ${pct(L(1.5, 0.15)(r))} weapon damage to all enemies in front. Requires a sword.`,
  },
  {
    id: 'lunge', classId: 'fighter', tree: 'blades', name: 'Lunge', icon: '➹', kind: 'active',
    maxRank: 5, reqLevel: 4, prereq: { id: 'cleave', rank: 1 }, weapons: ['sword'], cost: C(15), cooldown: C(6),
    effect: { type: 'dash', distance: 5.5, range: 1.9, arc: 100, dmg: L(1.8, 0.2), status: { type: 'bleed', power: C(0.4), duration: C(4) } },
    desc: (r) => `Dash to your target and strike for ${pct(L(1.8, 0.2)(r))} weapon damage, opening a bleeding wound.`,
  },
  {
    id: 'sword_mastery', classId: 'fighter', tree: 'blades', name: 'Sword Mastery', icon: '🗡', kind: 'passive',
    maxRank: 5, reqLevel: 2,
    passive: { weapons: ['sword'], bonus: (r) => ({ dmgPct: 6 * r, critChance: 1 * r }) },
    desc: (r) => `While wielding a sword: +${6 * r}% damage and +${r}% critical chance.`,
  },
  {
    id: 'bladestorm', classId: 'fighter', tree: 'blades', name: 'Bladestorm', icon: '🌀', kind: 'active', major: true,
    maxRank: 5, reqLevel: 12, prereq: { id: 'lunge', rank: 3 }, weapons: ['sword'], cost: C(35), cooldown: C(14),
    effect: { type: 'spin', duration: 3, tick: 0.3, radius: 2.5, dmg: L(0.55, 0.08) },
    desc: (r) => `MAJOR. Become a whirlwind of steel for 3s, hitting everything around you for ${pct(L(0.55, 0.08)(r))} weapon damage every 0.3s.`,
  },
  {
    id: 'rend', classId: 'fighter', tree: 'axes', name: 'Rend', icon: '🩸', kind: 'active',
    maxRank: 5, reqLevel: 1, weapons: ['axe'], cost: C(12), cooldown: C(4),
    effect: { type: 'melee', range: 2.1, arc: 110, dmg: L(1.2, 0.12), status: { type: 'bleed', power: L(0.8, 0.15), duration: C(5) } },
    desc: (r) => `Tear into enemies for ${pct(L(1.2, 0.12)(r))} weapon damage, then they bleed for ${pct(L(0.8, 0.15)(r))} more over 5s. Requires an axe.`,
  },
  {
    id: 'sunder', classId: 'fighter', tree: 'axes', name: 'Sunder', icon: '🪓', kind: 'active',
    maxRank: 5, reqLevel: 5, prereq: { id: 'rend', rank: 1 }, weapons: ['axe'], cost: C(16), cooldown: C(7),
    effect: { type: 'melee', range: 2.1, arc: 110, dmg: L(1.6, 0.15), status: { type: 'vulnerable', power: L(20, 3), duration: C(6) } },
    desc: (r) => `Smash armour apart for ${pct(L(1.6, 0.15)(r))} weapon damage. Struck enemies take +${L(20, 3)(r)}% damage for 6s.`,
  },
  {
    id: 'axe_mastery', classId: 'fighter', tree: 'axes', name: 'Axe Mastery', icon: '🪵', kind: 'passive',
    maxRank: 5, reqLevel: 2,
    passive: { weapons: ['axe'], bonus: (r) => ({ dmgPct: 6 * r, critDmg: 10 * r }) },
    desc: (r) => `While wielding an axe: +${6 * r}% damage and +${10 * r}% critical damage.`,
  },
  {
    id: 'executioner', classId: 'fighter', tree: 'axes', name: 'Executioner', icon: '☠', kind: 'active', major: true,
    maxRank: 5, reqLevel: 14, prereq: { id: 'sunder', rank: 3 }, weapons: ['axe'], cost: C(30), cooldown: C(12),
    effect: { type: 'melee', range: 2.4, arc: 80, dmg: L(3.8, 0.4), executeBonus: 1 },
    desc: (r) => `MAJOR. A colossal overhead chop for ${pct(L(3.8, 0.4)(r))} weapon damage, doubled against enemies below 35% life.`,
  },
  {
    id: 'concussive_blow', classId: 'fighter', tree: 'hammers', name: 'Concussive Blow', icon: '🔨', kind: 'active',
    maxRank: 5, reqLevel: 1, weapons: ['mace'], cost: C(12), cooldown: C(5),
    effect: { type: 'melee', range: 2, arc: 90, dmg: L(1.3, 0.12), status: { type: 'stun', power: C(1), duration: L(0.9, 0.15) } },
    desc: (r) => `Crack a skull for ${pct(L(1.3, 0.12)(r))} weapon damage and stun for ${L(0.9, 0.15)(r).toFixed(1)}s. Requires a mace.`,
  },
  {
    id: 'ground_slam', classId: 'fighter', tree: 'hammers', name: 'Ground Slam', icon: '💥', kind: 'active',
    maxRank: 5, reqLevel: 6, prereq: { id: 'concussive_blow', rank: 1 }, weapons: ['mace'], cost: C(20), cooldown: C(8),
    effect: { type: 'nova', radius: 3, dmg: L(1.5, 0.15), element: 'physical', status: { type: 'slow', power: C(40), duration: C(3) }, visual: 'dust' },
    desc: (r) => `Slam the ground, dealing ${pct(L(1.5, 0.15)(r))} weapon damage around you and slowing enemies by 40%.`,
  },
  {
    id: 'mace_mastery', classId: 'fighter', tree: 'hammers', name: 'Mace Mastery', icon: '🛡', kind: 'passive',
    maxRank: 5, reqLevel: 2,
    passive: { weapons: ['mace'], bonus: (r) => ({ dmgPct: 6 * r, hp: 12 * r }) },
    desc: (r) => `While wielding a mace: +${6 * r}% damage and +${12 * r} maximum life.`,
  },
  {
    id: 'earthshaker', classId: 'fighter', tree: 'hammers', name: 'Earthshaker', icon: '🌋', kind: 'active', major: true,
    maxRank: 5, reqLevel: 16, prereq: { id: 'ground_slam', rank: 3 }, weapons: ['mace'], cost: C(35), cooldown: C(15),
    effect: { type: 'nova', radius: 5, dmg: L(3, 0.3), element: 'physical', status: { type: 'stun', power: C(1), duration: C(1.6) }, visual: 'quake' },
    desc: (r) => `MAJOR. Split the earth: ${pct(L(3, 0.3)(r))} weapon damage to all enemies within 5 tiles, stunning them.`,
  },
  {
    id: 'war_cry', classId: 'fighter', tree: 'warfare', name: 'War Cry', icon: '📯', kind: 'active',
    maxRank: 5, reqLevel: 2, cost: C(15), cooldown: C(20),
    effect: { type: 'buff', buffId: 'war_cry', duration: L(8, 1), bonus: (r) => ({ dmgPct: 15 + 5 * r, armor: 10 * r }) },
    desc: (r) => `Bellow a war cry: +${15 + 5 * r}% damage and +${10 * r} armour for ${L(8, 1)(r)}s.`,
  },
  {
    id: 'shield_bash', classId: 'fighter', tree: 'warfare', name: 'Shield Bash', icon: '🛡', kind: 'active',
    maxRank: 5, reqLevel: 3, offhand: 'shield', cost: C(10), cooldown: C(6),
    effect: { type: 'melee', range: 1.8, arc: 70, dmg: L(1, 0.12), knockback: 2.2, status: { type: 'stun', power: C(1), duration: L(1, 0.1) } },
    desc: (r) => `Bash with your shield for ${pct(L(1, 0.12)(r))} weapon damage, knocking back and stunning. Requires a shield.`,
  },
  {
    id: 'iron_skin', classId: 'fighter', tree: 'warfare', name: 'Iron Skin', icon: '⛨', kind: 'passive',
    maxRank: 5, reqLevel: 4,
    passive: { bonus: (r) => ({ hp: 12 * r, armor: 6 * r, resist: 2 * r }) },
    desc: (r) => `+${12 * r} life, +${6 * r} armour and +${2 * r}% resistances.`,
  },
  {
    id: 'second_wind', classId: 'fighter', tree: 'warfare', name: 'Second Wind', icon: '❤', kind: 'active',
    maxRank: 5, reqLevel: 8, cost: C(20), cooldown: C(30),
    effect: { type: 'heal', pct: L(20, 5) },
    desc: (r) => `Catch your breath and recover ${L(20, 5)(r)}% of maximum life.`,
  },

  // ======================= MAGE =======================
  {
    id: 'firebolt', classId: 'mage', tree: 'fire', name: 'Firebolt', icon: '🔥', kind: 'active',
    maxRank: 5, reqLevel: 1, cost: C(8), cooldown: C(0.6),
    effect: { type: 'projectile', proj: { speed: 11, range: 10, dmg: L(1.5, 0.15), element: 'fire', visual: 'fire', status: { type: 'burn', power: C(0.4), duration: C(3) } } },
    desc: (r) => `Hurl a bolt of fire for ${pct(L(1.5, 0.15)(r))} weapon damage as fire, igniting the target.`,
  },
  {
    id: 'fireball', classId: 'mage', tree: 'fire', name: 'Fireball', icon: '☄', kind: 'active',
    maxRank: 5, reqLevel: 5, prereq: { id: 'firebolt', rank: 1 }, cost: C(18), cooldown: C(4),
    effect: {
      type: 'projectile',
      proj: { speed: 9, range: 10, dmg: L(0.5, 0.05), element: 'fire', visual: 'fire', explode: { radius: 2.3, dmg: L(2, 0.22) }, status: { type: 'burn', power: C(0.3), duration: C(3) } },
    },
    desc: (r) => `A fireball that explodes for ${pct(L(2, 0.22)(r))} weapon damage to all enemies in the blast.`,
  },
  {
    id: 'pyromancy', classId: 'mage', tree: 'fire', name: 'Pyromancy', icon: '♨', kind: 'passive',
    maxRank: 5, reqLevel: 3,
    passive: { bonus: (r) => ({ firePct: 8 * r }) },
    desc: (r) => `+${8 * r}% fire damage.`,
  },
  {
    id: 'meteor', classId: 'mage', tree: 'fire', name: 'Meteor', icon: '🌠', kind: 'active', major: true,
    maxRank: 5, reqLevel: 14, prereq: { id: 'fireball', rank: 3 }, cost: C(40), cooldown: C(12),
    effect: { type: 'ground', at: 'target', radius: 3, delay: 1, duration: 3, tick: 0.5, impactDmg: L(4.5, 0.5), dmg: L(0.3, 0.04), element: 'fire', visual: 'meteor' },
    desc: (r) => `MAJOR. Call down a meteor: ${pct(L(4.5, 0.5)(r))} weapon damage on impact, leaving burning ground.`,
  },
  {
    id: 'frost_shard', classId: 'mage', tree: 'frost', name: 'Frost Shard', icon: '❄', kind: 'active',
    maxRank: 5, reqLevel: 1, cost: C(8), cooldown: C(0.6),
    effect: { type: 'projectile', proj: { speed: 12, range: 10, dmg: L(1.3, 0.13), element: 'frost', visual: 'frost', status: { type: 'slow', power: C(40), duration: C(2.5) } } },
    desc: (r) => `Launch an icy shard for ${pct(L(1.3, 0.13)(r))} weapon damage as frost, slowing the target by 40%.`,
  },
  {
    id: 'frost_nova', classId: 'mage', tree: 'frost', name: 'Frost Nova', icon: '✳', kind: 'active',
    maxRank: 5, reqLevel: 6, prereq: { id: 'frost_shard', rank: 1 }, cost: C(20), cooldown: C(9),
    effect: { type: 'nova', radius: 3.2, dmg: L(1.3, 0.15), element: 'frost', status: { type: 'stun', power: C(1), duration: L(1.2, 0.15) }, visual: 'frost' },
    desc: (r) => `Explode with cold, dealing ${pct(L(1.3, 0.15)(r))} weapon damage and freezing nearby enemies for ${L(1.2, 0.15)(r).toFixed(1)}s.`,
  },
  {
    id: 'cryomancy', classId: 'mage', tree: 'frost', name: 'Cryomancy', icon: '🧊', kind: 'passive',
    maxRank: 5, reqLevel: 3,
    passive: { bonus: (r) => ({ frostPct: 8 * r, armor: 5 * r }) },
    desc: (r) => `+${8 * r}% frost damage and +${5 * r} armour.`,
  },
  {
    id: 'blizzard', classId: 'mage', tree: 'frost', name: 'Blizzard', icon: '🌨', kind: 'active', major: true,
    maxRank: 5, reqLevel: 16, prereq: { id: 'frost_nova', rank: 3 }, cost: C(40), cooldown: C(14),
    effect: { type: 'ground', at: 'target', radius: 3.5, delay: 0, duration: 4.5, tick: 0.4, dmg: L(0.6, 0.07), element: 'frost', status: { type: 'slow', power: C(50), duration: C(1) }, visual: 'blizzard' },
    desc: (r) => `MAJOR. A raging blizzard deals ${pct(L(0.6, 0.07)(r))} weapon damage every 0.4s for 4.5s and slows by 50%.`,
  },
  {
    id: 'spark', classId: 'mage', tree: 'lightning', name: 'Spark', icon: '⚡', kind: 'active',
    maxRank: 5, reqLevel: 1, cost: C(9), cooldown: C(0.8),
    effect: { type: 'projectile', proj: { speed: 16, range: 9, dmg: L(1.1, 0.1), element: 'lightning', visual: 'spark', chain: { count: (r) => 2 + Math.floor(r / 2), range: 4 } } },
    desc: (r) => `A crackling bolt for ${pct(L(1.1, 0.1)(r))} weapon damage that chains to ${2 + Math.floor(r / 2)} more enemies.`,
  },
  {
    id: 'ball_lightning', classId: 'mage', tree: 'lightning', name: 'Ball Lightning', icon: '🔮', kind: 'active',
    maxRank: 5, reqLevel: 7, prereq: { id: 'spark', rank: 1 }, cost: C(20), cooldown: C(5),
    effect: { type: 'projectile', proj: { speed: 3.5, range: 9, dmg: L(0.6, 0.07), element: 'lightning', visual: 'orb', pierce: true, orb: { tick: 0.35, radius: 1.4 } } },
    desc: (r) => `Release a slow orb that shocks every nearby enemy for ${pct(L(0.6, 0.07)(r))} weapon damage several times a second.`,
  },
  {
    id: 'electromancy', classId: 'mage', tree: 'lightning', name: 'Electromancy', icon: '🌩', kind: 'passive',
    maxRank: 5, reqLevel: 3,
    passive: { bonus: (r) => ({ lightningPct: 8 * r, critChance: r }) },
    desc: (r) => `+${8 * r}% lightning damage and +${r}% critical chance.`,
  },
  {
    id: 'thunderstorm', classId: 'mage', tree: 'lightning', name: 'Thunderstorm', icon: '⛈', kind: 'active', major: true,
    maxRank: 5, reqLevel: 18, prereq: { id: 'ball_lightning', rank: 3 }, cost: C(45), cooldown: C(16),
    effect: { type: 'strikes', count: L(7, 1), radius: 7, interval: 0.35, dmg: L(2.5, 0.25), element: 'lightning' },
    desc: (r) => `MAJOR. Summon a storm: ${L(7, 1)(r)} lightning strikes on nearby enemies for ${pct(L(2.5, 0.25)(r))} weapon damage each.`,
  },
  {
    id: 'blink', classId: 'mage', tree: 'arcane', name: 'Blink', icon: '✨', kind: 'active',
    maxRank: 5, reqLevel: 3, cost: C(15), cooldown: L(8, -0.8),
    effect: { type: 'blink', distance: 5.5 },
    desc: (r) => `Teleport a short distance in the direction you are facing. Cooldown ${L(8, -0.8)(r).toFixed(1)}s.`,
  },
  {
    id: 'arcane_intellect', classId: 'mage', tree: 'arcane', name: 'Arcane Intellect', icon: '📘', kind: 'passive',
    maxRank: 5, reqLevel: 2,
    passive: { bonus: (r) => ({ resource: 10 * r, resRegen: 0.3 * r }) },
    desc: (r) => `+${10 * r} maximum mana and +${(0.3 * r).toFixed(1)} mana per second.`,
  },
  {
    id: 'mana_shield', classId: 'mage', tree: 'arcane', name: 'Mana Shield', icon: '🔷', kind: 'active',
    maxRank: 5, reqLevel: 8, cost: C(20), cooldown: C(25),
    effect: { type: 'manaShield', duration: L(8, 1), absorb: L(40, 5) },
    desc: (r) => `For ${L(8, 1)(r)}s, ${L(40, 5)(r)}% of damage taken is drained from mana instead of life.`,
  },
  {
    id: 'arcane_barrage', classId: 'mage', tree: 'arcane', name: 'Arcane Barrage', icon: '💫', kind: 'active',
    maxRank: 5, reqLevel: 10, prereq: { id: 'blink', rank: 1 }, cost: C(16), cooldown: C(3),
    effect: { type: 'projectile', proj: { speed: 10, range: 10, dmg: L(0.8, 0.08), element: 'arcane', visual: 'missile', count: L(3, 1), spread: 60, homing: true } },
    desc: (r) => `Fire ${L(3, 1)(r)} seeking arcane missiles, each dealing ${pct(L(0.8, 0.08)(r))} weapon damage.`,
  },

  // ======================= RANGER =======================
  {
    id: 'power_shot', classId: 'ranger', tree: 'archery', name: 'Power Shot', icon: '🏹', kind: 'active',
    maxRank: 5, reqLevel: 1, weapons: ['bow'], cost: C(12), cooldown: C(3),
    effect: { type: 'projectile', proj: { speed: 19, range: 12, dmg: L(2.2, 0.2), element: 'physical', visual: 'arrow', pierce: true } },
    desc: (r) => `A heavy arrow that pierces through all enemies for ${pct(L(2.2, 0.2)(r))} weapon damage. Requires a bow.`,
  },
  {
    id: 'multishot', classId: 'ranger', tree: 'archery', name: 'Multishot', icon: '🎯', kind: 'active',
    maxRank: 5, reqLevel: 4, prereq: { id: 'power_shot', rank: 1 }, weapons: ['bow'], cost: C(16), cooldown: C(4),
    effect: { type: 'projectile', proj: { speed: 17, range: 10, dmg: L(0.9, 0.08), element: 'physical', visual: 'arrow', count: (r) => 5 + Math.floor(r / 2), spread: 55 } },
    desc: (r) => `Loose ${5 + Math.floor(r / 2)} arrows in a fan, each dealing ${pct(L(0.9, 0.08)(r))} weapon damage.`,
  },
  {
    id: 'marksmanship', classId: 'ranger', tree: 'archery', name: 'Marksmanship', icon: '👁', kind: 'passive',
    maxRank: 5, reqLevel: 2,
    passive: { weapons: ['bow'], bonus: (r) => ({ dmgPct: 5 * r, critChance: 1.5 * r }) },
    desc: (r) => `While wielding a bow: +${5 * r}% damage and +${1.5 * r}% critical chance.`,
  },
  {
    id: 'arrow_rain', classId: 'ranger', tree: 'archery', name: 'Arrow Rain', icon: '☔', kind: 'active', major: true,
    maxRank: 5, reqLevel: 14, prereq: { id: 'multishot', rank: 3 }, weapons: ['bow'], cost: C(35), cooldown: C(12),
    effect: { type: 'ground', at: 'target', radius: 3, delay: 0.3, duration: 2.5, tick: 0.25, dmg: L(0.55, 0.06), element: 'physical', visual: 'arrows' },
    desc: (r) => `MAJOR. Darken the sky: arrows pelt an area for ${pct(L(0.55, 0.06)(r))} weapon damage every 0.25s.`,
  },
  {
    id: 'poison_arrow', classId: 'ranger', tree: 'poisons', name: 'Poison Arrow', icon: '🧪', kind: 'active',
    maxRank: 5, reqLevel: 1, weapons: ['bow'], cost: C(10), cooldown: C(2),
    effect: { type: 'projectile', proj: { speed: 16, range: 11, dmg: L(1, 0.1), element: 'poison', visual: 'poison', status: { type: 'poison', power: L(1.5, 0.2), duration: C(5) } } },
    desc: (r) => `A venom-coated arrow: ${pct(L(1, 0.1)(r))} weapon damage plus ${pct(L(1.5, 0.2)(r))} as poison over 5s.`,
  },
  {
    id: 'toxic_cloud', classId: 'ranger', tree: 'poisons', name: 'Toxic Cloud', icon: '☁', kind: 'active',
    maxRank: 5, reqLevel: 6, prereq: { id: 'poison_arrow', rank: 1 }, weapons: ['bow'], cost: C(18), cooldown: C(7),
    effect: {
      type: 'projectile',
      proj: {
        speed: 14, range: 10, dmg: L(0.6, 0.05), element: 'poison', visual: 'poison',
        cloud: { radius: 2.5, duration: 4, tick: 0.5, dmg: L(0.35, 0.05), element: 'poison', status: { type: 'slow', power: C(25), duration: C(1) } },
      },
    },
    desc: (r) => `An arrow that bursts into a choking cloud, dealing ${pct(L(0.35, 0.05)(r))} weapon damage every 0.5s and slowing.`,
  },
  {
    id: 'venomcraft', classId: 'ranger', tree: 'poisons', name: 'Venomcraft', icon: '🐍', kind: 'passive',
    maxRank: 5, reqLevel: 3,
    passive: { bonus: (r) => ({ poisonPct: 10 * r }) },
    desc: (r) => `+${10 * r}% poison damage.`,
  },
  {
    id: 'plague_volley', classId: 'ranger', tree: 'poisons', name: 'Plague Volley', icon: '☣', kind: 'active', major: true,
    maxRank: 5, reqLevel: 16, prereq: { id: 'toxic_cloud', rank: 3 }, weapons: ['bow'], cost: C(35), cooldown: C(12),
    effect: { type: 'projectile', proj: { speed: 16, range: 11, dmg: L(1, 0.1), element: 'poison', visual: 'poison', count: C(7), spread: 70, status: { type: 'poison', power: L(2, 0.3), duration: C(6) } } },
    desc: (r) => `MAJOR. Seven poisoned arrows in a wide fan, each dealing ${pct(L(1, 0.1)(r))} and ${pct(L(2, 0.3)(r))} poison over 6s.`,
  },
  {
    id: 'evasive_roll', classId: 'ranger', tree: 'survival', name: 'Evasive Roll', icon: '↩', kind: 'active',
    maxRank: 5, reqLevel: 2, cost: C(10), cooldown: L(6, -0.5),
    effect: { type: 'roll', distance: 4.5, invuln: 0.45 },
    desc: (r) => `Roll quickly in your movement direction, avoiding all damage. Cooldown ${L(6, -0.5)(r).toFixed(1)}s.`,
  },
  {
    id: 'bear_trap', classId: 'ranger', tree: 'survival', name: 'Bear Trap', icon: '⊗', kind: 'active',
    maxRank: 5, reqLevel: 5, cost: C(15), cooldown: C(8),
    effect: { type: 'trap', dmg: L(2, 0.25), radius: 1.3, root: L(2, 0.2), duration: 20 },
    desc: (r) => `Set a trap that snaps for ${pct(L(2, 0.25)(r))} weapon damage and roots its victim for ${L(2, 0.2)(r).toFixed(1)}s.`,
  },
  {
    id: 'hunters_mark', classId: 'ranger', tree: 'survival', name: "Hunter's Mark", icon: '⌖', kind: 'active',
    maxRank: 5, reqLevel: 8, cost: C(10), cooldown: C(10),
    effect: { type: 'mark', pct: L(20, 4), duration: 10 },
    desc: (r) => `Mark your target: it takes +${L(20, 4)(r)}% damage from all sources for 10s.`,
  },
  {
    id: 'call_of_the_wild', classId: 'ranger', tree: 'survival', name: 'Call of the Wild', icon: '🐺', kind: 'active', major: true,
    maxRank: 5, reqLevel: 15, prereq: { id: 'bear_trap', rank: 3 }, cost: C(40), cooldown: C(30),
    effect: { type: 'summon', creature: 'spirit_wolf', count: (r) => (r >= 4 ? 3 : 2), duration: L(15, 2) },
    desc: (r) => `MAJOR. Summon ${r >= 4 ? 3 : 2} spirit wolves that fight at your side for ${L(15, 2)(r)}s.`,
  },
];

export const ABILITY_MAP: Record<string, AbilityDef> = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));

export function abilitiesFor(classId: ClassId): AbilityDef[] {
  return ABILITIES.filter((a) => a.classId === classId);
}

export interface BasicAttack {
  kind: 'melee' | 'projectile';
  range: number;
  arc?: number;
  element: DamageType;
  visual?: ProjVisual;
  speed?: number;
}

export function basicAttackFor(weapon: WeaponType | null): BasicAttack {
  switch (weapon) {
    case 'sword':
      return { kind: 'melee', range: 2, arc: 110, element: 'physical' };
    case 'axe':
      return { kind: 'melee', range: 2, arc: 110, element: 'physical' };
    case 'mace':
      return { kind: 'melee', range: 1.9, arc: 95, element: 'physical' };
    case 'dagger':
      return { kind: 'melee', range: 1.7, arc: 80, element: 'physical' };
    case 'staff':
      return { kind: 'projectile', range: 9, element: 'arcane', visual: 'bolt', speed: 12 };
    case 'wand':
      return { kind: 'projectile', range: 8.5, element: 'arcane', visual: 'bolt', speed: 14 };
    case 'bow':
      return { kind: 'projectile', range: 11, element: 'physical', visual: 'arrow', speed: 18 };
    default:
      return { kind: 'melee', range: 1.5, arc: 80, element: 'physical' };
  }
}
