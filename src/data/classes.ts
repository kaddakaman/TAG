import type { ClassId, Stats, WeaponType, OffhandType, ArmorType, StatId } from '../types';

export interface ClassDef {
  id: ClassId;
  name: string;
  tagline: string;
  description: string;
  baseStats: Stats;
  /** stat recommended for each point; shown as a hint in the UI */
  primaryStats: StatId[];
  resourceName: string;
  resourceColor: string;
  baseResource: number;
  weapons: WeaponType[];
  offhands: OffhandType[];
  armor: ArmorType[];
  startingGear: { base: string; slot: string }[];
  color: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  fighter: {
    id: 'fighter',
    name: 'Fighter',
    tagline: 'Steel, sweat and stubbornness.',
    description:
      'A frontline warrior who masters swords, axes and maces. Each weapon unlocks its own techniques and devastating major attacks.',
    baseStats: { str: 16, dex: 11, con: 15, int: 8, wis: 10, cha: 10 },
    primaryStats: ['str', 'con'],
    resourceName: 'Stamina',
    resourceColor: '#e0b030',
    baseResource: 60,
    weapons: ['sword', 'axe', 'mace', 'dagger'],
    offhands: ['shield'],
    armor: ['plate', 'leather'],
    startingGear: [
      { base: 'sword', slot: 'mainhand' },
      { base: 'shield', slot: 'offhand' },
      { base: 'leather_chest', slot: 'chest' },
    ],
    color: '#c0563a',
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    tagline: 'Fire, frost and the storm answer your call.',
    description:
      'A scholar of the arcane who channels Fire, Frost or Lightning. Invest in a school to conjure ever more powerful spells.',
    baseStats: { str: 8, dex: 11, con: 11, int: 17, wis: 14, cha: 10 },
    primaryStats: ['int', 'wis'],
    resourceName: 'Mana',
    resourceColor: '#3a7be0',
    baseResource: 80,
    weapons: ['staff', 'wand'],
    offhands: ['tome'],
    armor: ['cloth'],
    startingGear: [
      { base: 'staff', slot: 'mainhand' },
      { base: 'cloth_chest', slot: 'chest' },
    ],
    color: '#5a6be0',
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    tagline: 'Every arrow finds its mark.',
    description:
      'A wilderness hunter deadly with the bow. Loose volleys of arrows, coat them in poison, lay traps and outmanoeuvre foes.',
    baseStats: { str: 10, dex: 17, con: 12, int: 9, wis: 13, cha: 10 },
    primaryStats: ['dex', 'wis'],
    resourceName: 'Focus',
    resourceColor: '#45b060',
    baseResource: 70,
    weapons: ['bow', 'dagger'],
    offhands: ['quiver'],
    armor: ['leather'],
    startingGear: [
      { base: 'bow', slot: 'mainhand' },
      { base: 'quiver', slot: 'offhand' },
      { base: 'leather_chest', slot: 'chest' },
    ],
    color: '#3f9a52',
  },
};

export const STAT_INFO: Record<StatId, { name: string; short: string; desc: string }> = {
  str: { name: 'Strength', short: 'STR', desc: '+2% melee weapon damage, +3 carry weight per point.' },
  dex: { name: 'Dexterity', short: 'DEX', desc: '+2% bow & dagger damage, +0.3% crit, +0.4% attack speed, +0.15% dodge.' },
  con: { name: 'Constitution', short: 'CON', desc: '+5 maximum life and +0.06 life regen per point.' },
  int: { name: 'Intelligence', short: 'INT', desc: '+2% spell damage, +3 maximum mana per point.' },
  wis: { name: 'Wisdom', short: 'WIS', desc: '+0.08 resource regen, +0.4% cooldown reduction, +0.5% resistances.' },
  cha: { name: 'Charisma', short: 'CHA', desc: 'Better vendor prices, +1% gold found and +1.5% bounty rewards per point.' },
};

export const SKIN_TONES = ['#f6d7c3', '#eac09a', '#d9a57c', '#b97f57', '#8d5a3b', '#5e3b26', '#c4d8a8', '#a9b8d6'];
export const HAIR_COLORS = ['#1d1612', '#4a2e1b', '#8a5a2b', '#c9a35c', '#e8d9a0', '#b03a21', '#e9e9ea', '#6a6f7a', '#3a5fb0', '#7a3fa0'];
export const CLOTH_COLORS = [
  '#8b1e1e', '#c0563a', '#d9a020', '#3f6b2a', '#2e7d5a', '#2a4d8b', '#5a3f8b', '#2b2b30',
  '#e6e0d0', '#7a5230', '#4a6f80', '#b04a7a',
];
export const HAIR_STYLES: Record<'male' | 'female', string[]> = {
  male: ['Cropped', 'Shaggy', 'Topknot', 'Bald'],
  female: ['Long', 'Ponytail', 'Bob', 'Braids'],
};

export const MAX_LEVEL = 30;
export const STAT_POINTS_PER_LEVEL = 5;

export function xpToNext(level: number): number {
  return Math.floor(50 * Math.pow(level, 1.6));
}
