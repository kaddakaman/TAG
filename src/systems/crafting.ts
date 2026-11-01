// Blacksmithing, tool upgrades, cooking and brewing.

import type { ClassId, Item, Rarity } from '../types';
import { CLASSES } from '../data/classes';
import { GEAR_BASES, STACKABLES, TOOL_INFO, TOOL_NAMES, type ToolId } from '../data/items';
import { JEWEL_TIERS, METAL_TIERS, RECIPES, burnChance, type Recipe } from '../data/lifeskills';
import { Rng, rng } from '../core/rng';
import { generateGear, makeStack, rollRarity } from './items';
import type { Session } from './session';

export interface SmithRecipe {
  id: string;
  tierId: string;
  tierName: string;
  baseId: string;
  label: string;
  ilvl: number;
  inputs: [string, number][];
  gold: number;
  townLevel: number;
}

const SLOT_ORE: Record<string, number> = { head: 0.8, chest: 1.4, hands: 0.6, legs: 1, feet: 0.6 };

export function smithRecipes(classId: ClassId): SmithRecipe[] {
  const cls = CLASSES[classId];
  const out: SmithRecipe[] = [];
  for (const t of METAL_TIERS) {
    const mainOre = t.ore;
    const scaled = (mult: number): [string, number][] => mainOre.map(([id, n]) => [id, Math.max(1, Math.round(n * mult))]);
    for (const w of cls.weapons) {
      const base = GEAR_BASES[w];
      const wooden = w === 'staff' || w === 'wand' || w === 'bow';
      const inputs: [string, number][] = wooden ? [[t.log, 4], [mainOre[0][0], 1]] : [...scaled(1), [t.log, 1]];
      out.push({ id: `${t.id}_${w}`, tierId: t.id, tierName: t.name, baseId: w, label: base.tierNames[Math.min(6, Math.floor((t.ilvl + 1) / 5))], ilvl: t.ilvl, inputs, gold: t.gold, townLevel: t.townLevel });
    }
    for (const o of cls.offhands) {
      const base = GEAR_BASES[o];
      const inputs: [string, number][] = o === 'shield' ? [...scaled(0.8), [t.log, 2]] : [[t.log, 2], [mainOre[0][0], 1]];
      out.push({ id: `${t.id}_${o}`, tierId: t.id, tierName: t.name, baseId: o, label: base.tierNames[Math.min(6, Math.floor((t.ilvl + 1) / 5))], ilvl: t.ilvl, inputs, gold: t.gold, townLevel: t.townLevel });
    }
    for (const at of cls.armor) {
      for (const slot of ['head', 'chest', 'hands', 'legs', 'feet']) {
        const id = `${at}_${slot}`;
        const base = GEAR_BASES[id];
        const metalMult = at === 'plate' ? 1 : 0.5;
        out.push({
          id: `${t.id}_${id}`, tierId: t.id, tierName: t.name, baseId: id,
          label: base.tierNames[Math.min(6, Math.floor((t.ilvl + 1) / 5))], ilvl: t.ilvl,
          inputs: scaled(SLOT_ORE[slot] * metalMult), gold: Math.round(t.gold * (at === 'plate' ? 0.8 : 1.4) * SLOT_ORE[slot]), townLevel: t.townLevel,
        });
      }
    }
  }
  for (const j of JEWEL_TIERS) {
    for (const b of ['ring', 'amulet']) {
      out.push({ id: `${j.id}_${b}`, tierId: j.id, tierName: j.name, baseId: b, label: `${j.name} ${b === 'ring' ? 'Ring' : 'Amulet'}`, ilvl: j.ilvl, inputs: j.ore, gold: j.gold, townLevel: j.townLevel });
    }
  }
  return out;
}

export function canAfford(s: Session, inputs: [string, number][], gold: number): boolean {
  return s.char.gold >= gold && inputs.every(([id, n]) => s.count(id) >= n);
}

export function smith(s: Session, rc: SmithRecipe): { item?: Item; error?: string } {
  if (s.townLevel().level < rc.townLevel) return { error: `Hearthvale must be a level ${rc.townLevel} town (donate to the steward).` };
  if (!canAfford(s, rc.inputs, rc.gold)) return { error: 'Missing materials or gold.' };
  for (const [id, n] of rc.inputs) s.consume(id, n);
  s.char.gold -= rc.gold;
  const r = new Rng(rng.next() * 1e9);
  const bonus = s.townLevel().smithBonus;
  const rarity = rollRarity(r, rc.ilvl, 80 + bonus * 30, 1) as Rarity;
  const item = generateGear(rc.baseId, rc.ilvl, rarity, r, { crafted: true });
  s.addItem(item, true);
  return { item };
}

export function toolUpgradeCost(tool: ToolId, currentTier: number): { inputs: [string, number][]; gold: number; townLevel: number; name: string } | null {
  const next = currentTier + 1;
  const t = METAL_TIERS[next - 1];
  if (!t) return null;
  return {
    inputs: t.ore.map(([id, n]) => [id, Math.max(2, Math.round(n * 0.8))] as [string, number]).concat([[t.log, 2]]),
    gold: Math.round(t.gold * 0.8),
    townLevel: t.townLevel,
    name: `${TOOL_NAMES[next]} ${TOOL_INFO[tool].name}`,
  };
}

export function upgradeTool(s: Session, tool: ToolId): string | null {
  const cost = toolUpgradeCost(tool, s.char.tools[tool]);
  if (!cost) return 'Already the best tool.';
  if (s.townLevel().level < cost.townLevel) return `Requires town level ${cost.townLevel}.`;
  if (!canAfford(s, cost.inputs, cost.gold)) return 'Missing materials or gold.';
  for (const [id, n] of cost.inputs) s.consume(id, n);
  s.char.gold -= cost.gold;
  s.upgradeTool(tool, s.char.tools[tool] + 1);
  return null;
}

export function recipesFor(station: 'cook' | 'brew'): Recipe[] {
  return RECIPES.filter((r) => r.station === station);
}

export function cookOnce(s: Session, rc: Recipe): { ok: boolean; burnt?: boolean; error?: string } {
  if (rc.station === 'cook' && s.lifeLevel('cooking') < rc.level) return { ok: false, error: `Requires Cooking ${rc.level}` };
  if (!canAfford(s, rc.inputs, rc.gold ?? 0)) return { ok: false, error: 'Missing ingredients.' };
  for (const [id, n] of rc.inputs) s.consume(id, n);
  s.char.gold -= rc.gold ?? 0;
  if (rc.station === 'cook') {
    const burnt = rng.chance(burnChance(s.lifeLevel('cooking'), rc.level));
    if (burnt) {
      s.addItem(makeStack('burnt_food', 1), true);
      s.gainLifeXp('cooking', Math.round(rc.xp * 0.2));
      return { ok: true, burnt: true };
    }
    s.gainLifeXp('cooking', rc.xp);
  }
  s.addItem(makeStack(rc.output, rc.qty), true);
  return { ok: true };
}

export function recipeName(rc: Recipe): string {
  return STACKABLES[rc.output].name;
}
