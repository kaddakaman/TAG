import type { HumanoidLook } from './enemies';

export interface TownLevel {
  level: number;
  name: string;
  threshold: number;
  storage: number;
  guards: number;
  discount: number;
  vendorRarity: number;
  smithBonus: number;
  perks: string[];
}

export const TOWN_LEVELS: TownLevel[] = [
  { level: 0, name: 'Humble Hamlet', threshold: 0, storage: 20, guards: 1, discount: 0, vendorRarity: 0, smithBonus: 0, perks: ['A single guard watches the gate', 'Storage: 20 slots'] },
  { level: 1, name: 'Growing Village', threshold: 400, storage: 30, guards: 2, discount: 2, vendorRarity: 1, smithBonus: 1, perks: ['Storage expanded to 30 slots', 'A second guard is hired', 'Merchants stock Uncommon gear', 'Blacksmith can forge Steel', '2% discount at vendors'] },
  { level: 2, name: 'Bustling Village', threshold: 1200, storage: 45, guards: 3, discount: 4, vendorRarity: 2, smithBonus: 2, perks: ['Storage expanded to 45 slots', 'Three guards on patrol', 'Merchants stock Rare gear', 'Blacksmith can forge Mithril', '4% discount at vendors'] },
  { level: 3, name: 'Fortified Town', threshold: 3000, storage: 60, guards: 4, discount: 6, vendorRarity: 2, smithBonus: 3, perks: ['Stone walls replace the palisade', 'Storage expanded to 60 slots', 'Four guards', 'Blacksmith can forge Adamant', '6% discount'] },
  { level: 4, name: 'Prosperous Town', threshold: 7000, storage: 80, guards: 5, discount: 8, vendorRarity: 3, smithBonus: 4, perks: ['Storage expanded to 80 slots', 'Five veteran guards', 'Merchants stock Epic gear', 'Forged gear is higher quality', '8% discount'] },
  { level: 5, name: 'Hearthvale Stronghold', threshold: 15000, storage: 100, guards: 6, discount: 10, vendorRarity: 3, smithBonus: 6, perks: ['Storage expanded to 100 slots', 'A full garrison of six guards', 'Masterwork forging', '10% discount'] },
];

export function townLevelFor(donated: number): TownLevel {
  let t = TOWN_LEVELS[0];
  for (const l of TOWN_LEVELS) if (donated >= l.threshold) t = l;
  return t;
}

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  x: number;
  y: number;
  facing: number;
  look: HumanoidLook;
  greeting: string[];
  services: ('quests' | 'bounties' | 'shop' | 'forge' | 'tools' | 'cook' | 'brew' | 'donate' | 'storage' | 'stash' | 'travel')[];
  shop?: 'smith' | 'general' | 'inn';
}

export const NPCS: NpcDef[] = [
  {
    id: 'guildmaster', name: 'Aldric Vane', title: 'Guildmaster', x: 16.5, y: 16.7, facing: Math.PI / 2,
    look: { skin: '#d9a57c', hair: '#c9c9c9', primary: '#2a4d8b', secondary: '#3a3a3a', tertiary: '#d9a020', weapon: 'sword', bulk: 1.1 },
    greeting: ['The Guild always has work for capable hands.', 'Back already? Good. Hearthvale needs you.', 'Every legend starts with a single contract.'],
    services: ['quests'],
  },
  {
    id: 'bounty', name: 'Wren', title: 'Bounty Clerk', x: 21.5, y: 15.3, facing: Math.PI / 2,
    look: { skin: '#eac09a', hair: '#b03a21', primary: '#7a5230', secondary: '#3a2a1a', tertiary: '#e6e0d0', female: true },
    greeting: ['Fresh bounties on the board! Coin for the brave.', 'Pick a contract, any contract. They all pay.', 'Folk post their troubles here. You fix them, you get paid.'],
    services: ['bounties'],
  },
  {
    id: 'smith', name: 'Brenna Ironhand', title: 'Blacksmith', x: 31.5, y: 15.7, facing: Math.PI,
    look: { skin: '#b97f57', hair: '#1d1612', primary: '#5a3a2a', secondary: '#2b2b30', tertiary: '#8b1e1e', weapon: 'mace', female: true, bulk: 1.15 },
    greeting: ['Ore, coin, or both? I work with either.', 'Bring me ore and I\'ll make you something worth bleeding for.', 'Mind the sparks.'],
    services: ['quests', 'shop', 'forge', 'tools'],
    shop: 'smith',
  },
  {
    id: 'merchant', name: 'Pell', title: 'Merchant', x: 11.7, y: 21.5, facing: 0,
    look: { skin: '#eac09a', hair: '#8a5a2b', primary: '#5a3f8b', secondary: '#7a5230', tertiary: '#d9a020' },
    greeting: ['Finest wares this side of the river!', 'Buying, selling, I do it all. Mostly selling.', 'Potions! Get your potions! Don\'t die without one!'],
    services: ['shop'],
    shop: 'general',
  },
  {
    id: 'innkeeper', name: 'Tomas', title: 'Innkeeper', x: 12.7, y: 29, facing: 0,
    look: { skin: '#f6d7c3', hair: '#4a2e1b', primary: '#e6e0d0', secondary: '#7a5230', tertiary: '#8b1e1e', bulk: 1.25 },
    greeting: ['Welcome to the Wandering Boar! Mind the boar.', 'Hungry? The range is hot if you want to cook.', 'A full belly makes a stronger arm.'],
    services: ['quests', 'shop', 'cook'],
    shop: 'inn',
  },
  {
    id: 'herbalist', name: 'Old Maren', title: 'Herbalist', x: 19.7, y: 32.5, facing: Math.PI,
    look: { skin: '#d9a57c', hair: '#e9e9ea', primary: '#3f6b2a', secondary: '#5a3a1a', tertiary: '#b04a7a', female: true, hood: true },
    greeting: ['Herbs heal, dear. Most of them.', 'Bring me plants and I\'ll brew you something.', 'Ah, my knees. Rain is coming.'],
    services: ['quests', 'brew'],
  },
  {
    id: 'steward', name: 'Elara Brightwater', title: 'Town Steward', x: 31, y: 32.7, facing: -Math.PI / 2,
    look: { skin: '#8d5a3b', hair: '#1d1612', primary: '#2e7d5a', secondary: '#e6e0d0', tertiary: '#d9a020', female: true },
    greeting: ['Every coin donated makes Hearthvale stronger.', 'With your help, this hamlet could become a fortress.', 'The people are grateful for all you do.'],
    services: ['donate'],
  },
  {
    id: 'storage', name: 'Bram', title: 'Warehouse Keeper', x: 32.5, y: 23.5, facing: Math.PI,
    look: { skin: '#d9a57c', hair: '#8a5a2b', primary: '#7a5230', secondary: '#4a3a2a', tertiary: '#3f6b2a', weapon: 'axe', bulk: 1.2 },
    greeting: ['Your things are safe with me.', 'The guild vault holds items for all Guild members - shared between all your adventurers.', 'Need room? Donate to the town and I\'ll build more shelves.'],
    services: ['quests', 'storage', 'stash'],
  },
  {
    id: 'fisher', name: 'Old Gil', title: 'Fisherman', x: 22.5, y: 29.5, facing: -Math.PI / 4,
    look: { skin: '#b97f57', hair: '#e9e9ea', primary: '#4a6f80', secondary: '#7a5230', tertiary: '#d9a020', hood: true },
    greeting: ['Fish are biting today. Or maybe that was a turtle.', 'Patience is the secret, lad. Or lass.', 'Cook your catch and you\'ll fight better. Old fisherman\'s secret.'],
    services: ['quests'],
  },
  {
    id: 'captain', name: 'Captain Reyna', title: 'Guard Captain', x: 27.8, y: 6.5, facing: Math.PI / 2,
    look: { skin: '#d9a57c', hair: '#c9a35c', primary: '#2a4d8b', secondary: '#4a4a52', tertiary: '#d9a020', weapon: 'spear', offhand: 'shield', helmet: '#9aa0aa', female: true },
    greeting: ['Raiders test our walls more each week.', 'The more the town prospers, the more guards I can hire.', 'Stay sharp out there.'],
    services: ['quests'],
  },
];

export const NPC_MAP: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));
