import type { LifeSkillId } from '../types';

export const LIFE_SKILLS: Record<LifeSkillId, { name: string; icon: string; desc: string; tool?: 'pickaxe' | 'hatchet' | 'rod' | 'sickle' }> = {
  mining: { name: 'Mining', icon: '⛏', desc: 'Mine ore veins. Bring ore to the blacksmith to forge gear and tools.', tool: 'pickaxe' },
  woodcutting: { name: 'Woodcutting', icon: '🪓', desc: 'Chop trees for logs. Logs light campfires and are needed for bows, staves and handles.', tool: 'hatchet' },
  fishing: { name: 'Fishing', icon: '🎣', desc: 'Fish rippling pools. Cook your catch for healing and stat buffs.', tool: 'rod' },
  foraging: { name: 'Foraging', icon: '🌿', desc: 'Gather herbs for hearty recipes and healing potions.', tool: 'sickle' },
  cooking: { name: 'Cooking', icon: '🍳', desc: 'Cook at a campfire or the inn. Higher levels unlock better meals and burn less food.' },
};

export const LIFE_MAX_LEVEL = 50;

export function lifeXpForLevel(level: number): number {
  // total xp required to reach `level`
  let total = 0;
  for (let l = 1; l < level; l++) total += Math.floor(40 * Math.pow(l, 1.45));
  return total;
}

export function lifeLevelFromXp(xp: number): number {
  let l = 1;
  while (l < LIFE_MAX_LEVEL && xp >= lifeXpForLevel(l + 1)) l++;
  return l;
}

export interface NodeDef {
  id: string;
  skill: LifeSkillId;
  name: string;
  item: string;
  level: number;
  /** base seconds per gather attempt */
  time: number;
  xp: number;
  /** how many gathers before depletion */
  yield: [number, number];
  respawn: number;
  color: string;
}

export const NODES: Record<string, NodeDef> = Object.fromEntries(
  (
    [
      { id: 'copper_vein', skill: 'mining', name: 'Copper Vein', item: 'copper_ore', level: 1, time: 2.4, xp: 18, yield: [3, 5], respawn: 60, color: '#c87533' },
      { id: 'iron_vein', skill: 'mining', name: 'Iron Vein', item: 'iron_ore', level: 10, time: 2.8, xp: 35, yield: [3, 5], respawn: 70, color: '#a0a6b0' },
      { id: 'coal_seam', skill: 'mining', name: 'Coal Seam', item: 'coal', level: 15, time: 2.8, xp: 45, yield: [3, 6], respawn: 70, color: '#2a2a2a' },
      { id: 'silver_vein', skill: 'mining', name: 'Silver Vein', item: 'silver_ore', level: 20, time: 3, xp: 60, yield: [2, 4], respawn: 80, color: '#e8eef8' },
      { id: 'mithril_vein', skill: 'mining', name: 'Mithril Vein', item: 'mithril_ore', level: 30, time: 3.3, xp: 90, yield: [2, 4], respawn: 90, color: '#6fa8dc' },
      { id: 'adamantite_vein', skill: 'mining', name: 'Adamantite Vein', item: 'adamantite_ore', level: 40, time: 3.6, xp: 130, yield: [2, 3], respawn: 100, color: '#4fbf7f' },
      { id: 'oak_tree', skill: 'woodcutting', name: 'Oak Tree', item: 'oak_log', level: 1, time: 2.2, xp: 16, yield: [3, 6], respawn: 50, color: '#3f7a2a' },
      { id: 'willow_tree', skill: 'woodcutting', name: 'Willow Tree', item: 'willow_log', level: 10, time: 2.6, xp: 32, yield: [3, 6], respawn: 60, color: '#7a9a4a' },
      { id: 'maple_tree', skill: 'woodcutting', name: 'Maple Tree', item: 'maple_log', level: 20, time: 2.9, xp: 55, yield: [3, 5], respawn: 70, color: '#d0602a' },
      { id: 'yew_tree', skill: 'woodcutting', name: 'Yew Tree', item: 'yew_log', level: 30, time: 3.2, xp: 85, yield: [2, 5], respawn: 80, color: '#2a5a3a' },
      { id: 'elder_tree', skill: 'woodcutting', name: 'Elder Tree', item: 'elder_log', level: 40, time: 3.5, xp: 125, yield: [2, 4], respawn: 90, color: '#8a6ac0' },
      { id: 'trout_pool', skill: 'fishing', name: 'Trout Pool', item: 'raw_trout', level: 1, time: 3, xp: 18, yield: [4, 7], respawn: 45, color: '#9fb7c9' },
      { id: 'perch_pool', skill: 'fishing', name: 'Perch Pool', item: 'raw_perch', level: 10, time: 3.2, xp: 34, yield: [4, 7], respawn: 50, color: '#b8c26a' },
      { id: 'salmon_pool', skill: 'fishing', name: 'Salmon Run', item: 'raw_salmon', level: 20, time: 3.4, xp: 55, yield: [3, 6], respawn: 60, color: '#e08a6a' },
      { id: 'pike_pool', skill: 'fishing', name: 'Pike Shallows', item: 'raw_pike', level: 30, time: 3.6, xp: 85, yield: [3, 5], respawn: 70, color: '#6a9a6a' },
      { id: 'eel_pool', skill: 'fishing', name: 'Eel Hole', item: 'raw_eel', level: 40, time: 3.8, xp: 125, yield: [3, 5], respawn: 80, color: '#5a6a8a' },
      { id: 'meadowleaf_patch', skill: 'foraging', name: 'Meadowleaf', item: 'meadowleaf', level: 1, time: 1.6, xp: 14, yield: [2, 4], respawn: 40, color: '#7ac04a' },
      { id: 'sunpetal_patch', skill: 'foraging', name: 'Sunpetal', item: 'sunpetal', level: 10, time: 1.8, xp: 28, yield: [2, 4], respawn: 50, color: '#f0c030' },
      { id: 'nightshade_patch', skill: 'foraging', name: 'Nightshade', item: 'nightshade', level: 20, time: 2, xp: 48, yield: [2, 3], respawn: 55, color: '#7a4ab0' },
      { id: 'frostbloom_patch', skill: 'foraging', name: 'Frostbloom', item: 'frostbloom', level: 30, time: 2.2, xp: 75, yield: [2, 3], respawn: 60, color: '#9ad8f0' },
      { id: 'emberroot_patch', skill: 'foraging', name: 'Emberroot', item: 'emberroot', level: 40, time: 2.4, xp: 110, yield: [2, 3], respawn: 70, color: '#e0502a' },
    ] as NodeDef[]
  ).map((n) => [n.id, n]),
);

export function nodeForItem(itemId: string): NodeDef | undefined {
  return Object.values(NODES).find((n) => n.item === itemId);
}

// ---------------------------------------------------------------- crafting

export type Station = 'cook' | 'brew';

export interface Recipe {
  id: string;
  station: Station;
  output: string;
  qty: number;
  inputs: [string, number][];
  gold?: number;
  level: number;
  xp: number;
}

export const RECIPES: Recipe[] = [
  { id: 'c_trout', station: 'cook', output: 'grilled_trout', qty: 1, inputs: [['raw_trout', 1]], level: 1, xp: 20 },
  { id: 'c_meat', station: 'cook', output: 'roast_meat', qty: 1, inputs: [['raw_meat', 1]], level: 1, xp: 18 },
  { id: 'c_herb_roast', station: 'cook', output: 'herb_roast', qty: 1, inputs: [['raw_meat', 1], ['meadowleaf', 1]], level: 8, xp: 34 },
  { id: 'c_perch', station: 'cook', output: 'perch_fillet', qty: 1, inputs: [['raw_perch', 1]], level: 10, xp: 38 },
  { id: 'c_stew', station: 'cook', output: 'hunters_stew', qty: 1, inputs: [['prime_meat', 1], ['sunpetal', 1]], level: 15, xp: 55 },
  { id: 'c_salmon', station: 'cook', output: 'salmon_steak', qty: 1, inputs: [['raw_salmon', 1]], level: 20, xp: 62 },
  { id: 'c_pike', station: 'cook', output: 'sage_pike', qty: 1, inputs: [['raw_pike', 1], ['nightshade', 1]], level: 30, xp: 95 },
  { id: 'c_eel', station: 'cook', output: 'frost_eel_soup', qty: 1, inputs: [['raw_eel', 1], ['frostbloom', 1]], level: 40, xp: 135 },
  { id: 'c_feast', station: 'cook', output: 'ember_feast', qty: 1, inputs: [['prime_meat', 1], ['raw_salmon', 1], ['emberroot', 1]], level: 45, xp: 170 },
  { id: 'b_minor', station: 'brew', output: 'minor_potion', qty: 2, inputs: [['meadowleaf', 3]], gold: 5, level: 1, xp: 0 },
  { id: 'b_healing', station: 'brew', output: 'healing_potion', qty: 2, inputs: [['sunpetal', 2], ['meadowleaf', 2]], gold: 15, level: 1, xp: 0 },
  { id: 'b_greater', station: 'brew', output: 'greater_potion', qty: 2, inputs: [['nightshade', 2], ['frostbloom', 1]], gold: 40, level: 1, xp: 0 },
];

/** Chance to burn food given the player's cooking level and the recipe level. */
export function burnChance(cookLevel: number, recipeLevel: number): number {
  const diff = cookLevel - recipeLevel;
  return Math.max(0, Math.min(0.6, 0.35 - diff * 0.03));
}

// ---------------------------------------------------------------- smithing

export interface MetalTier {
  id: string;
  name: string;
  ilvl: number;
  ore: [string, number][];
  log: string;
  gold: number;
  townLevel: number;
  toolTier: number;
}

export const METAL_TIERS: MetalTier[] = [
  { id: 'copper', name: 'Copper', ilvl: 4, ore: [['copper_ore', 5]], log: 'oak_log', gold: 25, townLevel: 0, toolTier: 1 },
  { id: 'iron', name: 'Iron', ilvl: 9, ore: [['iron_ore', 5]], log: 'willow_log', gold: 60, townLevel: 0, toolTier: 2 },
  { id: 'steel', name: 'Steel', ilvl: 14, ore: [['iron_ore', 4], ['coal', 3]], log: 'maple_log', gold: 120, townLevel: 1, toolTier: 3 },
  { id: 'mithril', name: 'Mithril', ilvl: 20, ore: [['mithril_ore', 5]], log: 'yew_log', gold: 250, townLevel: 2, toolTier: 4 },
  { id: 'adamant', name: 'Adamant', ilvl: 26, ore: [['adamantite_ore', 5]], log: 'elder_log', gold: 450, townLevel: 3, toolTier: 5 },
];

export const JEWEL_TIERS = [
  { id: 'silver', name: 'Silver', ilvl: 12, ore: [['silver_ore', 4]] as [string, number][], gold: 80, townLevel: 0 },
  { id: 'mithril_j', name: 'Mithril', ilvl: 20, ore: [['mithril_ore', 3], ['silver_ore', 2]] as [string, number][], gold: 200, townLevel: 2 },
  { id: 'adamant_j', name: 'Adamant', ilvl: 26, ore: [['adamantite_ore', 3], ['silver_ore', 2]] as [string, number][], gold: 400, townLevel: 3 },
];
