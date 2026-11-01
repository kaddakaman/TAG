import type { ClassId, Item, Rarity } from '../types';
import { GEAR_BASES, classesForBase } from '../data/items';
import { Rng } from '../core/rng';
import { generateGear, makeStack, rollRarity } from './items';

const SLOT_WEIGHT: Record<string, number> = { weapon: 26, offhand: 10, armor: 50, jewelry: 14 };

function weightedBases(filter: (id: string) => boolean): [string, number][] {
  const out: [string, number][] = [];
  for (const b of Object.values(GEAR_BASES)) {
    if (!filter(b.id)) continue;
    out.push([b.id, SLOT_WEIGHT[b.category] / (b.category === 'armor' ? 5 : 1)]);
  }
  return out;
}

/** Pick a random gear base, biased toward items the given class can use. */
export function randomBaseFor(r: Rng, classId: ClassId | null, bias = 0.65): string {
  if (classId && r.chance(bias)) {
    return r.weighted(weightedBases((id) => classesForBase(GEAR_BASES[id]).includes(classId)));
  }
  return r.weighted(weightedBases(() => true));
}

export function potionForLevel(level: number): string {
  return level < 9 ? 'minor_potion' : level < 18 ? 'healing_potion' : 'greater_potion';
}

export interface LootOptions {
  elite?: boolean;
  boss?: boolean;
  magicFind?: number;
  goldFind?: number;
  classId?: ClassId | null;
  drops?: [string, number][];
}

export interface LootResult {
  gold: number;
  items: Item[];
}

export function rollLoot(r: Rng, level: number, o: LootOptions = {}): LootResult {
  const items: Item[] = [];
  const gf = 1 + (o.goldFind ?? 0) / 100;
  let gold = 0;
  const goldChance = o.boss || o.elite ? 1 : 0.55;
  if (r.chance(goldChance)) {
    const mult = o.boss ? 10 : o.elite ? 3 : 1;
    gold = Math.max(1, Math.round((2 + level * 1.8) * r.range(0.6, 1.4) * mult * gf));
  }
  const mf = o.magicFind ?? 0;
  if (o.boss) {
    items.push(generateGear(randomBaseFor(r, o.classId ?? null, 0.8), level + 1, Math.max(2, rollRarity(r, level, mf, 2)) as Rarity, r));
    items.push(generateGear(randomBaseFor(r, o.classId ?? null), level + 1, rollRarity(r, level, mf + 100, 1), r));
    items.push(generateGear(randomBaseFor(r, o.classId ?? null), level, rollRarity(r, level, mf + 50, 1), r));
    items.push(makeStack(potionForLevel(level), 2));
  } else if (o.elite) {
    items.push(generateGear(randomBaseFor(r, o.classId ?? null), level, rollRarity(r, level, mf + 50, 1), r));
    if (r.chance(0.3)) items.push(generateGear(randomBaseFor(r, o.classId ?? null), level, rollRarity(r, level, mf), r));
    if (r.chance(0.4)) items.push(makeStack(potionForLevel(level), 1));
  } else {
    if (r.chance(0.14)) items.push(generateGear(randomBaseFor(r, o.classId ?? null), level, rollRarity(r, level, mf), r));
    if (r.chance(0.05)) items.push(makeStack(potionForLevel(level), 1));
  }
  for (const [id, chance] of o.drops ?? []) {
    if (r.chance(chance)) items.push(makeStack(id, 1));
  }
  return { gold, items };
}
