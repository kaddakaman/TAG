import type { ArmorType, Bonus, ClassId, EquipSlot, ItemCategory, LifeSkillId, OffhandType, WeaponType } from '../types';

export interface StackDef {
  id: string;
  name: string;
  category: ItemCategory;
  weight: number;
  value: number;
  icon: string;
  color: string;
  desc?: string;
  /** food: instant heal and buff (5 minutes) */
  food?: { heal: number; bonus: Bonus; duration: number };
  /** potions: percent of max life healed */
  potion?: { healPct: number; resourcePct?: number };
  /** gathered materials: the skill and level */
  source?: { skill: LifeSkillId; level: number };
}

const ore = (id: string, name: string, level: number, value: number, color: string): StackDef => ({
  id, name, category: 'material', weight: 2, value, icon: '◆', color, source: { skill: 'mining', level }, desc: 'Ore for the blacksmith.',
});
const log = (id: string, name: string, level: number, value: number, color: string): StackDef => ({
  id, name, category: 'material', weight: 1.5, value, icon: '▬', color, source: { skill: 'woodcutting', level }, desc: 'Logs. Light a campfire or sell to the smith.',
});
const fish = (id: string, name: string, level: number, value: number, color: string): StackDef => ({
  id, name, category: 'material', weight: 0.6, value, icon: '🐟', color, source: { skill: 'fishing', level }, desc: 'Raw fish. Cook it at a fire.',
});
const herb = (id: string, name: string, level: number, value: number, color: string): StackDef => ({
  id, name, category: 'material', weight: 0.2, value, icon: '❦', color, source: { skill: 'foraging', level }, desc: 'A useful herb for cooking and brewing.',
});
const food = (id: string, name: string, heal: number, bonus: Bonus, value: number, color: string): StackDef => ({
  id, name, category: 'food', weight: 0.4, value, icon: '🍖', color, food: { heal, bonus, duration: 300 }, desc: 'Eat to heal and gain a Well Fed buff for 5 minutes.',
});
const trophy = (id: string, name: string, value: number, color: string, weight = 0.5): StackDef => ({
  id, name, category: 'junk', weight, value, icon: '✦', color, desc: 'A trophy. Merchants will pay for it.',
});

export const STACKABLES: Record<string, StackDef> = Object.fromEntries(
  ([
    ore('copper_ore', 'Copper Ore', 1, 6, '#c87533'),
    ore('iron_ore', 'Iron Ore', 10, 12, '#8a8f99'),
    ore('coal', 'Coal', 15, 14, '#3a3a3a'),
    ore('silver_ore', 'Silver Ore', 20, 22, '#d8dde6'),
    ore('mithril_ore', 'Mithril Ore', 30, 35, '#6fa8dc'),
    ore('adamantite_ore', 'Adamantite Ore', 40, 55, '#4fbf7f'),
    log('oak_log', 'Oak Logs', 1, 4, '#9a6b3c'),
    log('willow_log', 'Willow Logs', 10, 8, '#a8a060'),
    log('maple_log', 'Maple Logs', 20, 14, '#c0662a'),
    log('yew_log', 'Yew Logs', 30, 22, '#6a3f2a'),
    log('elder_log', 'Elderwood Logs', 40, 34, '#7a5aa8'),
    fish('raw_trout', 'Raw Trout', 1, 5, '#9fb7c9'),
    fish('raw_perch', 'Raw Perch', 10, 9, '#b8c26a'),
    fish('raw_salmon', 'Raw Salmon', 20, 15, '#e08a6a'),
    fish('raw_pike', 'Raw Pike', 30, 22, '#6a9a6a'),
    fish('raw_eel', 'Raw Cave Eel', 40, 32, '#5a6a8a'),
    herb('meadowleaf', 'Meadowleaf', 1, 4, '#7ac04a'),
    herb('sunpetal', 'Sunpetal', 10, 8, '#f0c030'),
    herb('nightshade', 'Nightshade', 20, 14, '#7a4ab0'),
    herb('frostbloom', 'Frostbloom', 30, 22, '#9ad8f0'),
    herb('emberroot', 'Emberroot', 40, 32, '#e0502a'),
    { id: 'raw_meat', name: 'Raw Meat', category: 'material', weight: 0.8, value: 3, icon: '🥩', color: '#c04a4a', desc: 'Cook at a fire.' },
    { id: 'prime_meat', name: 'Prime Cut', category: 'material', weight: 1, value: 10, icon: '🥩', color: '#a02a3a', desc: 'Choice meat from a large beast.' },
    food('grilled_trout', 'Grilled Trout', 40, { con: 2 }, 10, '#d9a066'),
    food('roast_meat', 'Roast Meat', 50, { str: 2 }, 8, '#9a5a2a'),
    food('herb_roast', 'Herb-Crusted Roast', 70, { str: 3, con: 2 }, 18, '#7a8a3a'),
    food('perch_fillet', 'Pan-Fried Perch', 70, { dex: 3, con: 1 }, 18, '#d0b060'),
    food('hunters_stew', "Hunter's Stew", 120, { str: 4, con: 4 }, 34, '#8a4a2a'),
    food('salmon_steak', 'Salmon Steak', 100, { con: 4, wis: 2 }, 30, '#e08a6a'),
    food('sage_pike', 'Sage-Baked Pike', 140, { int: 5, wis: 5 }, 48, '#6a8a5a'),
    food('frost_eel_soup', 'Frost Eel Soup', 180, { con: 5, dex: 5, resist: 10 }, 70, '#7ab8d8'),
    food('ember_feast', 'Ember Feast', 220, { str: 6, dex: 6, int: 6, con: 4 }, 110, '#e0602a'),
    { id: 'burnt_food', name: 'Burnt Food', category: 'junk', weight: 0.3, value: 1, icon: '◼', color: '#333', desc: 'Charcoal with ambitions.' },
    { id: 'minor_potion', name: 'Minor Healing Potion', category: 'potion', weight: 0.2, value: 15, icon: '⚗', color: '#e04a4a', potion: { healPct: 35 }, desc: 'Restores 35% of maximum life.' },
    { id: 'healing_potion', name: 'Healing Potion', category: 'potion', weight: 0.2, value: 40, icon: '⚗', color: '#f03030', potion: { healPct: 55 }, desc: 'Restores 55% of maximum life.' },
    { id: 'greater_potion', name: 'Greater Healing Potion', category: 'potion', weight: 0.2, value: 90, icon: '⚗', color: '#ff2060', potion: { healPct: 75, resourcePct: 30 }, desc: 'Restores 75% of maximum life and 30% resource.' },
    trophy('wolf_pelt', 'Wolf Pelt', 6, '#8a8a8a', 1),
    trophy('boar_tusk', 'Boar Tusk', 5, '#e8e0c8'),
    trophy('spider_silk', 'Spider Silk', 9, '#e8e8f0', 0.2),
    trophy('bandit_insignia', 'Bandit Insignia', 8, '#b08030', 0.1),
    trophy('goblin_ear', 'Goblin Ear', 6, '#6a9a3a', 0.1),
    trophy('bone_dust', 'Bone Dust', 10, '#e8e4d8', 0.3),
    trophy('grave_relic', 'Grave Relic', 22, '#9a8ab0', 0.5),
    trophy('orc_tusk', 'Orc Tusk', 16, '#d8d0a0', 0.4),
    trophy('elven_charm', 'Elven Charm', 26, '#8ad8a0', 0.1),
    trophy('drake_scale', 'Drake Scale', 40, '#c0402a', 0.5),
    trophy('ember_core', 'Ember Core', 55, '#ff8a2a', 0.5),
  ] as StackDef[]).map((d) => [d.id, d]),
);

// ---------------------------------------------------------------- gear

export const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
export const RARITY_COLORS = ['#e8e8e8', '#4fd05a', '#4a9af0', '#b060f0', '#ff9a20'];
export const RARITY_BASE_MULT = [1, 1.1, 1.22, 1.38, 1.6];
export const RARITY_VALUE_MULT = [1, 2.2, 4.5, 9, 20];
export const RARITY_AFFIXES: [number, number][] = [
  [0, 0],
  [1, 1],
  [2, 3],
  [3, 4],
  [4, 5],
];

export interface GearBase {
  id: string;
  category: 'weapon' | 'offhand' | 'armor' | 'jewelry';
  slot: EquipSlot;
  weaponType?: WeaponType;
  offhandType?: OffhandType;
  armorType?: ArmorType;
  twoHanded?: boolean;
  /** weapons: damage multiplier and attacks per second */
  dmgFactor?: number;
  aps?: number;
  armorFactor?: number;
  weight: number;
  icon: string;
  tierNames: string[];
}

const METALS = ['Rusty', 'Copper', 'Iron', 'Steel', 'Mithril', 'Adamant', 'Dragonforged'];
const WOODS = ['Gnarled', 'Oak', 'Willow', 'Maple', 'Yew', 'Elderwood', 'Starwood'];
const LEATHERS = ['Ragged', 'Hide', 'Leather', 'Studded', "Ranger's", 'Shadowhide', 'Wyrmskin'];
const CLOTHS = ['Tattered', 'Linen', 'Wool', 'Silk', 'Mystic', 'Arcane', 'Starweave'];
const PLATES = ['Dented', 'Copper', 'Iron', 'Steel', 'Mithril', 'Adamant', 'Dragonplate'];
const JEWELS = ['Tin', 'Copper', 'Silver', 'Gold', 'Mithril', 'Platinum', 'Celestial'];

function tiered(prefixes: string[], noun: string): string[] {
  return prefixes.map((p) => `${p} ${noun}`);
}

const ARMOR_NOUNS: Record<ArmorType, Record<string, string>> = {
  plate: { head: 'Helm', chest: 'Cuirass', hands: 'Gauntlets', legs: 'Greaves', feet: 'Sabatons' },
  leather: { head: 'Hood', chest: 'Jerkin', hands: 'Bracers', legs: 'Trousers', feet: 'Boots' },
  cloth: { head: 'Hat', chest: 'Robe', hands: 'Gloves', legs: 'Leggings', feet: 'Slippers' },
};
const ARMOR_PREFIX: Record<ArmorType, string[]> = { plate: PLATES, leather: LEATHERS, cloth: CLOTHS };
const ARMOR_FACTOR: Record<ArmorType, number> = { plate: 1.6, leather: 1, cloth: 0.55 };
const ARMOR_WEIGHT: Record<ArmorType, number> = { plate: 2.2, leather: 1, cloth: 0.5 };
export const SLOT_ARMOR_FACTOR: Record<string, number> = { head: 1, chest: 1.6, hands: 0.7, legs: 1.2, feet: 0.8 };
const SLOT_ICONS: Record<string, string> = { head: '⛑', chest: '👕', hands: '🧤', legs: '👖', feet: '👢' };

export const GEAR_BASES: Record<string, GearBase> = {};
function addBase(b: GearBase) {
  GEAR_BASES[b.id] = b;
}
addBase({ id: 'sword', category: 'weapon', slot: 'mainhand', weaponType: 'sword', dmgFactor: 1, aps: 1.3, weight: 4, icon: '🗡', tierNames: tiered(METALS, 'Sword') });
addBase({ id: 'axe', category: 'weapon', slot: 'mainhand', weaponType: 'axe', dmgFactor: 1.18, aps: 1.12, weight: 5, icon: '🪓', tierNames: tiered(METALS, 'Axe') });
addBase({ id: 'mace', category: 'weapon', slot: 'mainhand', weaponType: 'mace', dmgFactor: 1.3, aps: 1.0, weight: 6, icon: '🔨', tierNames: tiered(METALS, 'Mace') });
addBase({ id: 'dagger', category: 'weapon', slot: 'mainhand', weaponType: 'dagger', dmgFactor: 0.78, aps: 1.7, weight: 1.5, icon: '🔪', tierNames: tiered(METALS, 'Dagger') });
addBase({ id: 'staff', category: 'weapon', slot: 'mainhand', weaponType: 'staff', twoHanded: true, dmgFactor: 1.3, aps: 1.0, weight: 4, icon: '🦯', tierNames: tiered(WOODS, 'Staff') });
addBase({ id: 'wand', category: 'weapon', slot: 'mainhand', weaponType: 'wand', dmgFactor: 0.95, aps: 1.35, weight: 1, icon: '🪄', tierNames: tiered(WOODS, 'Wand') });
addBase({ id: 'bow', category: 'weapon', slot: 'mainhand', weaponType: 'bow', dmgFactor: 1.1, aps: 1.2, weight: 3, icon: '🏹', tierNames: tiered(WOODS, 'Bow') });
addBase({ id: 'shield', category: 'offhand', slot: 'offhand', offhandType: 'shield', armorFactor: 1.4, weight: 6, icon: '🛡', tierNames: tiered(PLATES, 'Shield') });
addBase({ id: 'tome', category: 'offhand', slot: 'offhand', offhandType: 'tome', weight: 1.5, icon: '📕', tierNames: tiered(CLOTHS, 'Tome') });
addBase({ id: 'quiver', category: 'offhand', slot: 'offhand', offhandType: 'quiver', weight: 1, icon: '🎒', tierNames: tiered(LEATHERS, 'Quiver') });
for (const at of ['plate', 'leather', 'cloth'] as ArmorType[]) {
  for (const slot of ['head', 'chest', 'hands', 'legs', 'feet'] as const) {
    addBase({
      id: `${at}_${slot}`,
      category: 'armor',
      slot,
      armorType: at,
      armorFactor: ARMOR_FACTOR[at] * SLOT_ARMOR_FACTOR[slot],
      weight: Math.round(ARMOR_WEIGHT[at] * SLOT_ARMOR_FACTOR[slot] * 3 * 10) / 10,
      icon: SLOT_ICONS[slot],
      tierNames: tiered(ARMOR_PREFIX[at], ARMOR_NOUNS[at][slot]),
    });
  }
}
addBase({ id: 'amulet', category: 'jewelry', slot: 'amulet', weight: 0.2, icon: '📿', tierNames: tiered(JEWELS, 'Amulet') });
addBase({ id: 'ring', category: 'jewelry', slot: 'ring', weight: 0.1, icon: '💍', tierNames: tiered(JEWELS, 'Ring') });

export function tierForIlvl(ilvl: number): number {
  return Math.max(0, Math.min(6, Math.floor((ilvl + 1) / 5)));
}

/** Which classes may equip this base? */
export function classesForBase(base: GearBase): ClassId[] {
  const out: ClassId[] = [];
  const check = (c: ClassId, ok: boolean) => ok && out.push(c);
  const fighterW = ['sword', 'axe', 'mace', 'dagger'];
  const mageW = ['staff', 'wand'];
  const rangerW = ['bow', 'dagger'];
  if (base.category === 'weapon') {
    check('fighter', fighterW.includes(base.weaponType!));
    check('mage', mageW.includes(base.weaponType!));
    check('ranger', rangerW.includes(base.weaponType!));
  } else if (base.category === 'offhand') {
    check('fighter', base.offhandType === 'shield');
    check('mage', base.offhandType === 'tome');
    check('ranger', base.offhandType === 'quiver');
  } else if (base.category === 'armor') {
    check('fighter', base.armorType === 'plate' || base.armorType === 'leather');
    check('mage', base.armorType === 'cloth');
    check('ranger', base.armorType === 'leather');
  } else {
    out.push('fighter', 'mage', 'ranger');
  }
  return out;
}

// ---------------------------------------------------------------- affixes

export type AffixSlotGroup = 'weapon' | 'offhand' | 'armor' | 'jewelry' | 'feet' | 'hands' | 'head';

export interface AffixDef {
  id: string;
  name: string;
  kind: 'prefix' | 'suffix';
  groups: AffixSlotGroup[];
  roll: (ilvl: number) => Bonus;
}

const r1 = (v: number) => Math.max(1, Math.round(v));
const r10 = (v: number) => Math.round(v * 10) / 10;

export const AFFIXES: AffixDef[] = [
  { id: 'sharp', name: 'Sharp', kind: 'prefix', groups: ['weapon'], roll: (l) => ({ dmgPct: r1(5 + l * 0.7) }) },
  { id: 'blazing', name: 'Blazing', kind: 'prefix', groups: ['weapon', 'offhand', 'jewelry'], roll: (l) => ({ firePct: r1(6 + l * 0.8) }) },
  { id: 'frozen', name: 'Frozen', kind: 'prefix', groups: ['weapon', 'offhand', 'jewelry'], roll: (l) => ({ frostPct: r1(6 + l * 0.8) }) },
  { id: 'shocking', name: 'Shocking', kind: 'prefix', groups: ['weapon', 'offhand', 'jewelry'], roll: (l) => ({ lightningPct: r1(6 + l * 0.8) }) },
  { id: 'venomous', name: 'Venomous', kind: 'prefix', groups: ['weapon', 'offhand', 'jewelry'], roll: (l) => ({ poisonPct: r1(6 + l * 0.8) }) },
  { id: 'sturdy', name: 'Sturdy', kind: 'prefix', groups: ['armor', 'offhand', 'feet', 'hands', 'head'], roll: (l) => ({ armor: r1(3 + l * 1.8) }) },
  { id: 'vital', name: 'Vital', kind: 'prefix', groups: ['armor', 'offhand', 'jewelry', 'feet', 'hands', 'head'], roll: (l) => ({ hp: r1(8 + l * 4) }) },
  { id: 'swift', name: 'Swift', kind: 'prefix', groups: ['weapon', 'hands', 'jewelry'], roll: (l) => ({ speedPct: r1(4 + l * 0.3) }) },
  { id: 'fleet', name: 'Fleet', kind: 'prefix', groups: ['feet'], roll: (l) => ({ moveSpeed: r1(4 + l * 0.25) }) },
  { id: 'keen', name: 'Keen', kind: 'prefix', groups: ['weapon', 'jewelry', 'hands', 'offhand'], roll: (l) => ({ critChance: r10(1.5 + l * 0.15) }) },
  { id: 'brutal', name: 'Brutal', kind: 'prefix', groups: ['weapon', 'jewelry'], roll: (l) => ({ critDmg: r1(10 + l * 1.2) }) },
  { id: 'lucky', name: 'Lucky', kind: 'prefix', groups: ['armor', 'jewelry', 'head', 'hands', 'feet'], roll: (l) => ({ magicFind: r1(6 + l * 1) }) },
  { id: 'bear', name: 'of the Bear', kind: 'suffix', groups: ['weapon', 'armor', 'offhand', 'jewelry', 'feet', 'hands', 'head'], roll: (l) => ({ str: r1(1 + l * 0.3), con: r1(1 + l * 0.3) }) },
  { id: 'fox', name: 'of the Fox', kind: 'suffix', groups: ['weapon', 'armor', 'offhand', 'jewelry', 'feet', 'hands', 'head'], roll: (l) => ({ dex: r1(2 + l * 0.45) }) },
  { id: 'owl', name: 'of the Owl', kind: 'suffix', groups: ['weapon', 'armor', 'offhand', 'jewelry', 'feet', 'hands', 'head'], roll: (l) => ({ int: r1(1 + l * 0.3), wis: r1(1 + l * 0.3) }) },
  { id: 'giant', name: 'of the Giant', kind: 'suffix', groups: ['weapon', 'armor', 'offhand', 'jewelry', 'feet', 'hands', 'head'], roll: (l) => ({ str: r1(2 + l * 0.45) }) },
  { id: 'wit', name: 'of Wit', kind: 'suffix', groups: ['weapon', 'armor', 'offhand', 'jewelry', 'feet', 'hands', 'head'], roll: (l) => ({ int: r1(2 + l * 0.45) }) },
  { id: 'titan', name: 'of the Titan', kind: 'suffix', groups: ['armor', 'offhand', 'jewelry', 'feet', 'hands', 'head'], roll: (l) => ({ con: r1(2 + l * 0.45) }) },
  { id: 'tiger', name: 'of the Tiger', kind: 'suffix', groups: ['weapon', 'armor', 'jewelry', 'hands', 'feet'], roll: (l) => ({ str: r1(1 + l * 0.3), dex: r1(1 + l * 0.3) }) },
  { id: 'fortune', name: 'of Fortune', kind: 'suffix', groups: ['jewelry', 'armor', 'head', 'hands'], roll: (l) => ({ goldFind: r1(6 + l * 1), cha: r1(1 + l * 0.2) }) },
  { id: 'leech', name: 'of the Leech', kind: 'suffix', groups: ['weapon', 'jewelry'], roll: (l) => ({ lifeOnHit: r1(1 + l * 0.35) }) },
  { id: 'warding', name: 'of Warding', kind: 'suffix', groups: ['armor', 'offhand', 'jewelry', 'feet', 'hands', 'head'], roll: (l) => ({ resist: r1(3 + l * 0.4) }) },
  { id: 'mule', name: 'of the Mule', kind: 'suffix', groups: ['armor', 'feet', 'jewelry'], roll: (l) => ({ carry: r1(6 + l * 0.8) }) },
  { id: 'prospector', name: 'of the Prospector', kind: 'suffix', groups: ['hands', 'jewelry', 'head'], roll: (l) => ({ gatherSpeed: r1(8 + l * 0.6) }) },
  { id: 'haste', name: 'of Haste', kind: 'suffix', groups: ['jewelry', 'head', 'offhand'], roll: (l) => ({ cdr: r1(3 + l * 0.2) }) },
  { id: 'regrowth', name: 'of Regrowth', kind: 'suffix', groups: ['armor', 'jewelry', 'head'], roll: (l) => ({ regen: r10(0.4 + l * 0.12) }) },
  { id: 'focus', name: 'of Focus', kind: 'suffix', groups: ['weapon', 'offhand', 'jewelry', 'head'], roll: (l) => ({ resRegen: r10(0.4 + l * 0.08) }) },
];

export const LEGENDARY_NAMES = [
  "Guildmaster's Pride", 'Dawnbreaker', 'Whisper of Hearthvale', 'The Last Ember', 'Grizzlemaw\'s Bane', 'Frostfall',
  'Stormcaller', 'Widowmaker', 'Oathkeeper', 'Thornheart', 'The Hollow Crown', 'Ashen Requiem', 'Moonlit Promise',
  'Gorrak\'s Folly', 'Silverleaf Song', 'Wanderer\'s Fortune',
];

export const BONUS_LABELS: Record<keyof Bonus, (v: number) => string> = {
  str: (v) => `+${v} Strength`,
  dex: (v) => `+${v} Dexterity`,
  con: (v) => `+${v} Constitution`,
  int: (v) => `+${v} Intelligence`,
  wis: (v) => `+${v} Wisdom`,
  cha: (v) => `+${v} Charisma`,
  hp: (v) => `+${v} Life`,
  resource: (v) => `+${v} Resource`,
  armor: (v) => `${v} Armour`,
  dmgMin: (v) => `${v}`,
  dmgMax: (v) => `${v}`,
  attackSpeed: (v) => `${v.toFixed(2)} Attacks/sec`,
  speedPct: (v) => `+${v}% Attack Speed`,
  critChance: (v) => `+${v}% Critical Chance`,
  critDmg: (v) => `+${v}% Critical Damage`,
  dmgPct: (v) => `+${v}% Damage`,
  firePct: (v) => `+${v}% Fire Damage`,
  frostPct: (v) => `+${v}% Frost Damage`,
  lightningPct: (v) => `+${v}% Lightning Damage`,
  poisonPct: (v) => `+${v}% Poison Damage`,
  resist: (v) => `+${v}% All Resistances`,
  moveSpeed: (v) => `+${v}% Movement Speed`,
  carry: (v) => `+${v} Carry Weight`,
  regen: (v) => `+${v} Life per Second`,
  resRegen: (v) => `+${v} Resource per Second`,
  lifeOnHit: (v) => `+${v} Life on Hit`,
  gatherSpeed: (v) => `+${v}% Gathering Speed`,
  goldFind: (v) => `+${v}% Gold Find`,
  magicFind: (v) => `+${v}% Magic Find`,
  cdr: (v) => `-${v}% Cooldowns`,
  blockChance: (v) => `${v}% Block Chance`,
};

export const TOOL_NAMES = ['Crude', 'Copper', 'Iron', 'Steel', 'Mithril', 'Adamant'];
export const TOOL_INFO = {
  pickaxe: { name: 'Pickaxe', skill: 'mining' as LifeSkillId, icon: '⛏' },
  hatchet: { name: 'Hatchet', skill: 'woodcutting' as LifeSkillId, icon: '🪓' },
  rod: { name: 'Fishing Rod', skill: 'fishing' as LifeSkillId, icon: '🎣' },
  sickle: { name: 'Sickle', skill: 'foraging' as LifeSkillId, icon: '🌿' },
};
export type ToolId = keyof typeof TOOL_INFO;
