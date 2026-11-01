import type { Bonus, CharacterData, DamageType, OffhandType, Stats, WeaponType } from '../types';
import { STAT_IDS } from '../types';
import { CLASSES } from '../data/classes';
import { ABILITY_MAP } from '../data/abilities';
import { GEAR_BASES } from '../data/items';
import { addBonus } from './items';

export interface Derived {
  stats: Stats;
  maxHp: number;
  maxRes: number;
  armor: number;
  resist: number;
  dodge: number;
  block: number;
  critChance: number;
  critDmg: number;
  attacksPerSec: number;
  dmgMin: number;
  dmgMax: number;
  weapon: WeaponType | null;
  offhand: OffhandType | null;
  twoHanded: boolean;
  dmgPct: number;
  elemPct: Record<DamageType, number>;
  moveSpeed: number;
  carry: number;
  regen: number;
  resRegen: number;
  lifeOnHit: number;
  gatherSpeed: number;
  goldFind: number;
  magicFind: number;
  cdr: number;
  buyDiscount: number;
  sellBonus: number;
  bountyBonus: number;
  total: Bonus;
}

export function equipmentBonus(char: CharacterData): Bonus {
  const total: Bonus = {};
  for (const [slot, item] of Object.entries(char.equipment)) {
    if (!item?.bonus) continue;
    if (slot === 'mainhand') {
      const { dmgMin: _a, dmgMax: _b, attackSpeed: _c, ...rest } = item.bonus;
      addBonus(total, rest);
    } else addBonus(total, item.bonus);
  }
  return total;
}

export function passiveBonus(char: CharacterData, weapon: WeaponType | null): Bonus {
  const total: Bonus = {};
  for (const [id, rank] of Object.entries(char.abilityRanks)) {
    const def = ABILITY_MAP[id];
    if (!def?.passive || rank <= 0) continue;
    if (def.passive.weapons && (!weapon || !def.passive.weapons.includes(weapon))) continue;
    addBonus(total, def.passive.bonus(rank));
  }
  return total;
}

export function computeDerived(char: CharacterData, buffs: Bonus[] = [], townDiscount = 0): Derived {
  const cls = CLASSES[char.classId];
  const main = char.equipment.mainhand;
  const mainBase = main ? GEAR_BASES[main.id] : undefined;
  const weapon = mainBase?.weaponType ?? null;
  const off = char.equipment.offhand;
  const offhand = off ? GEAR_BASES[off.id]?.offhandType ?? null : null;

  const total: Bonus = {};
  addBonus(total, equipmentBonus(char));
  addBonus(total, passiveBonus(char, weapon));
  if (char.foodBuff) addBonus(total, char.foodBuff.bonus);
  for (const b of buffs) addBonus(total, b);

  const stats = {} as Stats;
  for (const s of STAT_IDS) stats[s] = Math.max(1, Math.round(char.baseStats[s] + (total[s] ?? 0)));

  const lvl = char.level;
  const maxHp = Math.round(40 + stats.con * 5 + (lvl - 1) * 8 + (total.hp ?? 0));
  const maxRes = Math.round(cls.baseResource + (char.classId === 'mage' ? stats.int * 3 : 0) + (lvl - 1) * 2 + (total.resource ?? 0));
  const baseRegenRes = char.classId === 'mage' ? 2.2 : char.classId === 'ranger' ? 3 : 2.5;

  const dmgMin = main?.bonus?.dmgMin ?? 1;
  const dmgMax = main?.bonus?.dmgMax ?? 3;
  const aps = main?.bonus?.attackSpeed ?? 1.2;
  const speedPct = (stats.dex - 10) * 0.4 + (total.speedPct ?? 0);

  const chaBonus = Math.max(0, stats.cha - 10);
  return {
    stats,
    maxHp,
    maxRes,
    armor: Math.round(total.armor ?? 0),
    resist: Math.min(60, (total.resist ?? 0) + stats.wis * 0.5),
    dodge: Math.min(25, stats.dex * 0.15),
    block: Math.min(40, total.blockChance ?? 0),
    critChance: Math.min(75, 5 + stats.dex * 0.3 + (total.critChance ?? 0)),
    critDmg: 50 + (total.critDmg ?? 0),
    attacksPerSec: Math.min(3, Math.max(0.5, aps * (1 + speedPct / 100))),
    dmgMin,
    dmgMax,
    weapon,
    offhand,
    twoHanded: !!mainBase?.twoHanded,
    dmgPct: total.dmgPct ?? 0,
    elemPct: {
      physical: 0,
      arcane: 0,
      fire: total.firePct ?? 0,
      frost: total.frostPct ?? 0,
      lightning: total.lightningPct ?? 0,
      poison: total.poisonPct ?? 0,
    },
    moveSpeed: 1 + (total.moveSpeed ?? 0) / 100,
    carry: Math.round(40 + stats.str * 3 + (total.carry ?? 0)),
    regen: 0.3 + stats.con * 0.06 + (total.regen ?? 0),
    resRegen: baseRegenRes + stats.wis * 0.08 + (total.resRegen ?? 0),
    lifeOnHit: total.lifeOnHit ?? 0,
    gatherSpeed: total.gatherSpeed ?? 0,
    goldFind: chaBonus + (total.goldFind ?? 0),
    magicFind: total.magicFind ?? 0,
    cdr: Math.min(0.4, Math.max(0, stats.wis - 10) * 0.004 + (total.cdr ?? 0) / 100),
    buyDiscount: Math.min(0.3, chaBonus * 0.01 + townDiscount / 100),
    sellBonus: Math.min(0.25, chaBonus * 0.01),
    bountyBonus: chaBonus * 0.015,
    total,
  };
}

/** Which stat scales a given attack. */
export function scalingStat(classId: string, weapon: WeaponType | null, isSpell: boolean): keyof Stats {
  if (isSpell || classId === 'mage') return 'int';
  if (weapon === 'bow' || weapon === 'dagger') return 'dex';
  return 'str';
}

export function statDamageMult(value: number): number {
  return Math.max(0.8, 1 + (value - 10) * 0.02);
}
