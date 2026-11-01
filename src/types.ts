// Shared type definitions for TAG - The Adventurer's Guild

export type ClassId = 'fighter' | 'mage' | 'ranger';
export type StatId = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export const STAT_IDS: StatId[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export type Stats = Record<StatId, number>;

export type Gender = 'male' | 'female';
export type LifeSkillId = 'mining' | 'woodcutting' | 'fishing' | 'foraging' | 'cooking';
export const LIFE_SKILL_IDS: LifeSkillId[] = ['mining', 'woodcutting', 'fishing', 'foraging', 'cooking'];

/** 0 common, 1 uncommon, 2 rare, 3 epic, 4 legendary */
export type Rarity = 0 | 1 | 2 | 3 | 4;

export type EquipSlot = 'mainhand' | 'offhand' | 'head' | 'chest' | 'hands' | 'legs' | 'feet' | 'amulet' | 'ring';
export const EQUIP_SLOTS: EquipSlot[] = ['mainhand', 'offhand', 'head', 'chest', 'hands', 'legs', 'feet', 'amulet', 'ring'];
export type WeaponType = 'sword' | 'axe' | 'mace' | 'staff' | 'wand' | 'bow' | 'dagger';
export type OffhandType = 'shield' | 'tome' | 'quiver';
export type ArmorType = 'plate' | 'leather' | 'cloth';
export type DamageType = 'physical' | 'fire' | 'frost' | 'lightning' | 'poison' | 'arcane';

export type ItemCategory = 'weapon' | 'offhand' | 'armor' | 'jewelry' | 'material' | 'food' | 'potion' | 'junk' | 'quest';

export interface Appearance {
  gender: Gender;
  skin: string;
  hair: string;
  hairStyle: number;
  primary: string;
  secondary: string;
  tertiary: string;
}

/** Additive bonuses carried by gear, buffs and passives. */
export interface Bonus {
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  hp?: number;
  resource?: number;
  armor?: number;
  dmgMin?: number;
  dmgMax?: number;
  /** attacks per second for weapons */
  attackSpeed?: number;
  /** percent bonus to attack speed */
  speedPct?: number;
  critChance?: number;
  critDmg?: number;
  dmgPct?: number;
  firePct?: number;
  frostPct?: number;
  lightningPct?: number;
  poisonPct?: number;
  resist?: number;
  moveSpeed?: number;
  carry?: number;
  regen?: number;
  resRegen?: number;
  lifeOnHit?: number;
  gatherSpeed?: number;
  goldFind?: number;
  magicFind?: number;
  cdr?: number;
  blockChance?: number;
}

export interface Item {
  uid: string;
  /** stackable def id, or gear base id */
  id: string;
  qty: number;
  // --- gear only ---
  name?: string;
  rarity?: Rarity;
  ilvl?: number;
  bonus?: Bonus;
  /** human readable affix names (prefix/suffix) */
  affixes?: string[];
  crafted?: boolean;
}

export interface AbilityBarSlot {
  abilityId: string | null;
}

export interface LifeSkillState {
  xp: number;
}

export interface FoodBuff {
  itemId: string;
  name: string;
  bonus: Bonus;
  remaining: number;
}

export interface CharacterData {
  name: string;
  classId: ClassId;
  appearance: Appearance;
  level: number;
  xp: number;
  statPoints: number;
  skillPoints: number;
  baseStats: Stats;
  abilityRanks: Record<string, number>;
  actionBar: (string | null)[];
  hp: number;
  resource: number;
  gold: number;
  equipment: Partial<Record<EquipSlot, Item>>;
  inventory: Item[];
  storage: Item[];
  lifeSkills: Record<LifeSkillId, LifeSkillState>;
  tools: { pickaxe: number; hatchet: number; rod: number; sickle: number };
  foodBuff: FoodBuff | null;
  potionCooldown: number;
}

export interface ZoneState {
  killed: string[];
  depleted: Record<string, number>;
  timesCleared: number;
  clearedThisCycle: boolean;
}

export interface QuestProgress {
  questId: string;
  counts: number[];
  done: boolean;
}

export interface BountyObjective {
  kind: 'kill' | 'elite' | 'gather' | 'deliver';
  enemyId?: string;
  zoneId?: string;
  itemId?: string;
  count: number;
  eliteName?: string;
}

export interface Bounty {
  id: string;
  title: string;
  desc: string;
  giver: string;
  objective: BountyObjective;
  progress: number;
  rewardGold: number;
  rewardXp: number;
  rewardSkillXp?: { skill: LifeSkillId; xp: number };
  accepted: boolean;
}

export interface SatchelData {
  zoneId: string;
  x: number;
  y: number;
  gold: number;
}

export interface SaveData {
  version: number;
  slot: number;
  createdAt: number;
  updatedAt: number;
  playTime: number;
  character: CharacterData;
  world: {
    zoneId: string;
    x: number;
    y: number;
    unlockedZones: string[];
    waystones: string[];
    zoneStates: Record<string, ZoneState>;
    satchel: SatchelData | null;
  };
  quests: {
    active: QuestProgress[];
    completed: string[];
    bounties: Bounty[];
    bountyCounter: number;
  };
  town: {
    donated: number;
    raidCooldown: number;
  };
  stats: {
    kills: number;
    deaths: number;
    bossesSlain: string[];
  };
}

export interface SharedData {
  version: number;
  stash: Item[];
  /** highest town prosperity level reached by any character, expands stash */
  bestProsperity: number;
}
