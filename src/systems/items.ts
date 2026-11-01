import type { Bonus, ClassId, EquipSlot, Item, ItemCategory, Rarity } from '../types';
import {
  AFFIXES, BONUS_LABELS, GEAR_BASES, LEGENDARY_NAMES, RARITY_AFFIXES, RARITY_BASE_MULT, RARITY_VALUE_MULT,
  STACKABLES, classesForBase, tierForIlvl, type AffixSlotGroup, type GearBase,
} from '../data/items';
import { Rng, uid } from '../core/rng';

export interface ItemInfo {
  name: string;
  category: ItemCategory;
  weight: number;
  value: number;
  icon: string;
  color: string;
  rarity: Rarity;
  stack: boolean;
  slot?: EquipSlot;
  base?: GearBase;
  desc?: string;
  classes?: ClassId[];
}

export function isStackable(id: string): boolean {
  return id in STACKABLES;
}

export function makeStack(id: string, qty = 1): Item {
  if (!STACKABLES[id]) throw new Error('Unknown stackable ' + id);
  return { uid: uid('s'), id, qty };
}

export function gearValue(base: GearBase, ilvl: number, rarity: Rarity): number {
  const catMult = base.category === 'weapon' ? 1.2 : base.category === 'jewelry' ? 1.5 : 1;
  return Math.round((10 + ilvl * 6) * RARITY_VALUE_MULT[rarity] * catMult);
}

export function getInfo(item: Item): ItemInfo {
  const st = STACKABLES[item.id];
  if (st) {
    return {
      name: st.name, category: st.category, weight: st.weight, value: st.value, icon: st.icon, color: st.color,
      rarity: 0, stack: true, desc: st.desc,
    };
  }
  const base = GEAR_BASES[item.id];
  if (!base) {
    return { name: item.name ?? 'Unknown', category: 'junk', weight: 1, value: 1, icon: '?', color: '#888', rarity: 0, stack: false };
  }
  const rarity = (item.rarity ?? 0) as Rarity;
  return {
    name: item.name ?? base.tierNames[0],
    category: base.category,
    weight: base.weight,
    value: gearValue(base, item.ilvl ?? 1, rarity),
    icon: base.icon,
    color: '',
    rarity,
    stack: false,
    slot: base.slot,
    base,
    classes: classesForBase(base),
  };
}

export function itemWeight(item: Item): number {
  return getInfo(item).weight * item.qty;
}

export function requiredLevel(item: Item): number {
  if (isStackable(item.id)) return 1;
  return Math.max(1, (item.ilvl ?? 1) - 2);
}

export function canEquip(item: Item, classId: ClassId, level: number): { ok: boolean; reason?: string } {
  const info = getInfo(item);
  if (!info.slot) return { ok: false, reason: 'Not equippable' };
  if (!info.classes?.includes(classId)) return { ok: false, reason: 'Wrong class' };
  const req = requiredLevel(item);
  if (level < req) return { ok: false, reason: `Requires level ${req}` };
  return { ok: true };
}

export function rollRarity(r: Rng, ilvl: number, magicFind = 0, minRarity: Rarity = 0, bonusTiers = 0): Rarity {
  const mf = 1 + magicFind / 100;
  const lvlBoost = Math.min(1, ilvl / 25);
  const weights: [Rarity, number][] = [
    [0, 62],
    [1, 26 * mf],
    [2, (8 + 6 * lvlBoost) * mf],
    [3, (1.6 + 2.4 * lvlBoost) * mf],
    [4, (0.25 + 0.6 * lvlBoost) * mf],
  ];
  let rar = r.weighted(weights.filter(([k]) => k >= minRarity));
  rar = Math.min(4, rar + bonusTiers) as Rarity;
  return rar;
}

function affixGroup(base: GearBase): AffixSlotGroup {
  if (base.category === 'weapon') return 'weapon';
  if (base.category === 'offhand') return 'offhand';
  if (base.category === 'jewelry') return 'jewelry';
  if (base.slot === 'head' || base.slot === 'hands' || base.slot === 'feet') return base.slot;
  return 'armor';
}

export function addBonus(into: Bonus, b: Bonus, scale = 1): Bonus {
  for (const k in b) {
    const key = k as keyof Bonus;
    into[key] = Math.round(((into[key] ?? 0) + (b[key] ?? 0) * scale) * 100) / 100;
  }
  return into;
}

export function generateGear(baseId: string, ilvl: number, rarity: Rarity, r: Rng, opts: { crafted?: boolean } = {}): Item {
  const base = GEAR_BASES[baseId];
  if (!base) throw new Error('Unknown gear base ' + baseId);
  ilvl = Math.max(1, Math.round(ilvl));
  const mult = RARITY_BASE_MULT[rarity];
  const bonus: Bonus = {};
  if (base.category === 'weapon') {
    const avg = (5 + ilvl * 2.4) * (base.dmgFactor ?? 1) * mult * r.range(0.93, 1.07);
    bonus.dmgMin = Math.max(1, Math.round(avg * 0.8));
    bonus.dmgMax = Math.max(bonus.dmgMin + 1, Math.round(avg * 1.2));
    bonus.attackSpeed = base.aps;
  } else if (base.offhandType === 'shield') {
    bonus.armor = Math.round((4 + ilvl * 2.4) * (base.armorFactor ?? 1) * mult);
    bonus.blockChance = 10 + rarity * 2;
  } else if (base.offhandType === 'tome') {
    bonus.int = Math.round((1 + ilvl * 0.35) * mult);
    bonus.resource = Math.round((5 + ilvl * 1.5) * mult);
  } else if (base.offhandType === 'quiver') {
    bonus.dex = Math.round((1 + ilvl * 0.35) * mult);
    bonus.critChance = Math.round((1 + rarity * 0.5 + ilvl * 0.05) * 10) / 10;
  } else if (base.category === 'armor') {
    bonus.armor = Math.max(1, Math.round((3 + ilvl * 2) * (base.armorFactor ?? 1) * mult));
  }

  const [lo, hi] = RARITY_AFFIXES[rarity];
  let n = r.int(lo, hi);
  if (base.category === 'jewelry') n = Math.max(1, n);
  const group = affixGroup(base);
  const pool = AFFIXES.filter((a) => a.groups.includes(group));
  const chosen = r.shuffle([...pool]).slice(0, n);
  const affixes: string[] = [];
  for (const a of chosen) {
    addBonus(bonus, a.roll(ilvl));
    affixes.push(a.name);
  }
  const tierName = base.tierNames[tierForIlvl(ilvl)];
  let name = tierName;
  if (rarity === 4) {
    name = r.pick(LEGENDARY_NAMES);
  } else if (rarity >= 1) {
    const prefix = chosen.find((a) => a.kind === 'prefix');
    const suffix = chosen.find((a) => a.kind === 'suffix');
    name = `${prefix ? prefix.name + ' ' : ''}${tierName}${suffix ? ' ' + suffix.name : ''}`;
  }
  return { uid: uid('g'), id: baseId, qty: 1, name, rarity, ilvl, bonus, affixes, crafted: opts.crafted };
}

/** Lines of stat text for tooltips. */
export function bonusLines(b: Bonus | undefined, skipWeapon = false): string[] {
  if (!b) return [];
  const out: string[] = [];
  for (const k of Object.keys(BONUS_LABELS) as (keyof Bonus)[]) {
    const v = b[k];
    if (v === undefined || v === 0) continue;
    if (k === 'dmgMin' || k === 'dmgMax' || k === 'attackSpeed') continue;
    if (skipWeapon && (k === 'armor' || k === 'blockChance')) continue;
    out.push(BONUS_LABELS[k](v));
  }
  return out;
}

export function itemTooltip(item: Item): { title: string; color: string; lines: string[]; sub: string } {
  const info = getInfo(item);
  const lines: string[] = [];
  let sub = '';
  if (info.stack) {
    const st = STACKABLES[item.id];
    sub = info.category[0].toUpperCase() + info.category.slice(1);
    if (st.food) {
      lines.push(`Heals ${st.food.heal} life`);
      lines.push(...bonusLines(st.food.bonus).map((l) => l + ' (5 min)'));
    }
    if (st.potion) lines.push(`Restores ${st.potion.healPct}% life` + (st.potion.resourcePct ? ` and ${st.potion.resourcePct}% resource` : ''));
    if (st.source) lines.push(`Gathered with ${st.source.skill} level ${st.source.level}`);
    if (st.desc) lines.push(st.desc);
    return { title: item.qty > 1 ? `${info.name} x${item.qty}` : info.name, color: st.color, lines, sub };
  }
  const base = info.base!;
  const rarityName = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'][info.rarity];
  const typeName = base.weaponType ?? base.offhandType ?? (base.armorType ? `${base.armorType} ${base.slot}` : base.slot);
  sub = `${rarityName} ${typeName}${base.twoHanded ? ' (two-handed)' : ''} - item level ${item.ilvl}`;
  const b = item.bonus ?? {};
  if (b.dmgMin !== undefined) {
    lines.push(`${b.dmgMin}-${b.dmgMax} Damage`);
    lines.push(`${(b.attackSpeed ?? 1).toFixed(2)} Attacks per Second`);
  }
  if (b.armor) lines.push(`${b.armor} Armour`);
  if (b.blockChance) lines.push(`${b.blockChance}% Block Chance`);
  lines.push(...bonusLines(b, true));
  return { title: info.name, color: ['#e8e8e8', '#4fd05a', '#4a9af0', '#b060f0', '#ff9a20'][info.rarity], lines, sub };
}

/** Rough score for comparing two items of the same slot. */
export function itemScore(item: Item): number {
  const b = item.bonus ?? {};
  let s = 0;
  if (b.dmgMin !== undefined) s += ((b.dmgMin + (b.dmgMax ?? 0)) / 2) * (b.attackSpeed ?? 1) * 3;
  s += (b.armor ?? 0) * 0.6;
  s += (b.str ?? 0) + (b.dex ?? 0) + (b.con ?? 0) + (b.int ?? 0) + (b.wis ?? 0) + (b.cha ?? 0) * 0.5;
  s += (b.hp ?? 0) * 0.25 + (b.dmgPct ?? 0) * 0.8 + (b.critChance ?? 0) * 1.5 + (b.critDmg ?? 0) * 0.4;
  s += ((b.firePct ?? 0) + (b.frostPct ?? 0) + (b.lightningPct ?? 0) + (b.poisonPct ?? 0)) * 0.5;
  s += (b.resist ?? 0) * 0.6 + (b.speedPct ?? 0) + (b.moveSpeed ?? 0) * 0.7 + (b.lifeOnHit ?? 0);
  return Math.round(s);
}
