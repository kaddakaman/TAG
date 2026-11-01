import type { Appearance, ClassId, Item, SaveData, SharedData } from '../types';
import { LIFE_SKILL_IDS } from '../types';
import { CLASSES } from '../data/classes';
import { TOWN_ID } from '../data/zones';
import { Rng } from '../core/rng';
import { generateGear, makeStack } from './items';

export const SAVE_VERSION = 1;
export const SLOT_COUNT = 6;
const SLOT_KEY = (slot: number) => `tag.save.${slot}`;
const SHARED_KEY = 'tag.shared';
const SETTINGS_KEY = 'tag.settings';

interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const memory = new Map<string, string>();
const memoryStore: KV = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

function store(): KV {
  try {
    const ls = (globalThis as any).localStorage as KV | undefined;
    if (ls) return ls;
  } catch {
    /* storage blocked */
  }
  return memoryStore;
}

export interface SlotSummary {
  slot: number;
  name: string;
  classId: ClassId;
  level: number;
  zoneId: string;
  playTime: number;
  updatedAt: number;
  appearance: Appearance;
}

export function listSlots(): (SlotSummary | null)[] {
  const out: (SlotSummary | null)[] = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const d = loadSlot(i);
    out.push(
      d
        ? {
            slot: i,
            name: d.character.name,
            classId: d.character.classId,
            level: d.character.level,
            zoneId: d.world.zoneId,
            playTime: d.playTime,
            updatedAt: d.updatedAt,
            appearance: d.character.appearance,
          }
        : null,
    );
  }
  return out;
}

export function loadSlot(slot: number): SaveData | null {
  try {
    const raw = store().getItem(SLOT_KEY(slot));
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    return migrate(data);
  } catch (e) {
    console.warn('Failed to load save', slot, e);
    return null;
  }
}

export function writeSlot(data: SaveData): boolean {
  try {
    data.updatedAt = Date.now();
    store().setItem(SLOT_KEY(data.slot), JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Failed to save', e);
    return false;
  }
}

export function deleteSlot(slot: number): void {
  store().removeItem(SLOT_KEY(slot));
}

export function loadShared(): SharedData {
  try {
    const raw = store().getItem(SHARED_KEY);
    if (raw) {
      const d = JSON.parse(raw) as SharedData;
      if (Array.isArray(d.stash)) return { version: SAVE_VERSION, stash: d.stash, bestProsperity: d.bestProsperity ?? 0 };
    }
  } catch {
    /* ignore */
  }
  return { version: SAVE_VERSION, stash: [], bestProsperity: 0 };
}

export function writeShared(d: SharedData): void {
  try {
    store().setItem(SHARED_KEY, JSON.stringify(d));
  } catch (e) {
    console.warn('Failed to save shared stash', e);
  }
}

export interface Settings {
  touchControls: 'auto' | 'on' | 'off';
  showLabels: boolean;
  sound: boolean;
  screenShake: boolean;
  joystickSide: 'left' | 'right';
}

export function loadSettings(): Settings {
  const def: Settings = { touchControls: 'auto', showLabels: true, sound: true, screenShake: true, joystickSide: 'left' };
  try {
    const raw = store().getItem(SETTINGS_KEY);
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return def;
}

export function writeSettings(s: Settings): void {
  try {
    store().setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function migrate(d: SaveData): SaveData {
  // Fill in any fields that older saves may lack.
  d.version = SAVE_VERSION;
  d.character.lifeSkills ??= {} as SaveData['character']['lifeSkills'];
  for (const s of LIFE_SKILL_IDS) d.character.lifeSkills[s] ??= { xp: 0 };
  d.character.tools ??= { pickaxe: 0, hatchet: 0, rod: 0, sickle: 0 };
  d.character.storage ??= [];
  d.character.actionBar ??= [null, null, null, null];
  d.world.zoneStates ??= {};
  d.world.waystones ??= [TOWN_ID];
  d.quests.bounties ??= [];
  d.stats ??= { kills: 0, deaths: 0, bossesSlain: [] };
  d.town ??= { donated: 0, raidCooldown: 2 };
  return d;
}

export function newSave(slot: number, name: string, classId: ClassId, appearance: Appearance): SaveData {
  const cls = CLASSES[classId];
  const r = new Rng(name + Date.now());
  const equipment: SaveData['character']['equipment'] = {};
  for (const g of cls.startingGear) {
    const item = generateGear(g.base, 1, 0, r);
    // Starting gear is always the lowest tier name.
    equipment[g.slot as keyof typeof equipment] = item;
  }
  const inventory: Item[] = [makeStack('minor_potion', 4), makeStack('grilled_trout', 2), makeStack('oak_log', 2)];
  const now = Date.now();
  const lifeSkills = {} as SaveData['character']['lifeSkills'];
  for (const s of LIFE_SKILL_IDS) lifeSkills[s] = { xp: 0 };
  return {
    version: SAVE_VERSION,
    slot,
    createdAt: now,
    updatedAt: now,
    playTime: 0,
    character: {
      name,
      classId,
      appearance,
      level: 1,
      xp: 0,
      statPoints: 0,
      skillPoints: 1,
      baseStats: { ...cls.baseStats },
      abilityRanks: {},
      actionBar: [null, null, null, null],
      hp: 99999,
      resource: 99999,
      gold: 25,
      equipment,
      inventory,
      storage: [],
      lifeSkills,
      tools: { pickaxe: 0, hatchet: 0, rod: 0, sickle: 0 },
      foodBuff: null,
      potionCooldown: 0,
    },
    world: {
      zoneId: TOWN_ID,
      x: 22,
      y: 22,
      unlockedZones: ['greenmeadow'],
      waystones: [TOWN_ID],
      zoneStates: {},
      satchel: null,
    },
    quests: { active: [], completed: [], bounties: [], bountyCounter: 0 },
    town: { donated: 0, raidCooldown: 2 },
    stats: { kills: 0, deaths: 0, bossesSlain: [] },
  };
}
