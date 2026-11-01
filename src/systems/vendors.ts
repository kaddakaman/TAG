import type { Item, Rarity } from '../types';
import { Rng, rng } from '../core/rng';
import { generateGear, getInfo, makeStack, rollRarity } from './items';
import { randomBaseFor } from './loot';
import type { Session } from './session';

export type ShopId = 'general' | 'smith' | 'inn';

export function generateStock(shop: ShopId, s: Session): Item[] {
  const r = new Rng(rng.next() * 1e9);
  const lvl = s.char.level;
  const tl = s.townLevel();
  const out: Item[] = [];
  const gear = (count: number, bias: number, cap: number) => {
    for (let i = 0; i < count; i++) {
      const ilvl = Math.max(1, lvl + r.int(-1, 1));
      const rar = Math.min(cap, rollRarity(r, ilvl, 40)) as Rarity;
      out.push(generateGear(randomBaseFor(r, s.char.classId, bias), ilvl, rar, r));
    }
  };
  if (shop === 'general') {
    out.push(makeStack('minor_potion', 1));
    if (lvl >= 7) out.push(makeStack('healing_potion', 1));
    if (lvl >= 15) out.push(makeStack('greater_potion', 1));
    out.push(makeStack('grilled_trout', 1), makeStack('oak_log', 1));
    gear(5, 0.5, Math.max(1, tl.vendorRarity));
  } else if (shop === 'smith') {
    gear(7, 1, Math.max(1, tl.vendorRarity));
  } else {
    const foods: [string, number][] = [
      ['grilled_trout', 1], ['roast_meat', 1], ['herb_roast', 5], ['perch_fillet', 8], ['salmon_steak', 12], ['hunters_stew', 14], ['sage_pike', 20],
    ];
    for (const [id, l] of foods) if (lvl >= l) out.push(makeStack(id, 1));
    out.push(makeStack('raw_meat', 1), makeStack('meadowleaf', 1));
  }
  return out;
}

export function buyPrice(item: Item, s: Session): number {
  const info = getInfo(item);
  const mult = info.stack ? 2 : 2.5;
  return Math.max(1, Math.ceil(info.value * mult * (1 - s.derived.buyDiscount)));
}

export function sellPrice(item: Item, s: Session): number {
  const info = getInfo(item);
  return Math.max(1, Math.floor(info.value * (0.35 + s.derived.sellBonus)));
}
