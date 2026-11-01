import type { DamageType } from '../types';
import type { ProjVisual } from './abilities';

export type Faction = 'beast' | 'human' | 'goblin' | 'undead' | 'orc' | 'elf' | 'monster';
export type BodyType = 'quadruped' | 'spider' | 'humanoid' | 'ghost' | 'golem' | 'drake' | 'imp' | 'treant';
export type AiKind = 'melee' | 'ranged' | 'caster' | 'charger' | 'swarm';

export type SpecialKind = 'charge' | 'slam' | 'summon' | 'nova' | 'breath' | 'volley' | 'heal' | 'enrage' | 'web' | 'blink' | 'meteor' | 'root';

export interface SpecialDef {
  kind: SpecialKind;
  cd: number;
  /** damage multiplier relative to the enemy's base damage */
  mult?: number;
  radius?: number;
  summon?: string;
  count?: number;
}

export interface HumanoidLook {
  skin: string;
  hair: string;
  primary: string;
  secondary: string;
  tertiary: string;
  weapon?: 'sword' | 'axe' | 'mace' | 'dagger' | 'staff' | 'bow' | 'spear' | 'club';
  offhand?: 'shield' | 'tome' | 'quiver';
  hood?: boolean;
  helmet?: string;
  ears?: boolean;
  tusks?: boolean;
  skeleton?: boolean;
  female?: boolean;
  bulk?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  plural: string;
  faction: Faction;
  body: BodyType;
  size: number;
  color: string;
  color2: string;
  look?: HumanoidLook;
  hp: number;
  dmg: number;
  armor: number;
  speed: number;
  attackRange: number;
  attackCd: number;
  xp: number;
  ai: AiKind;
  element: DamageType;
  projectile?: ProjVisual;
  specials?: SpecialDef[];
  drops?: [string, number][];
  resist?: Partial<Record<DamageType, number>>;
  aggro?: number;
  boss?: boolean;
  title?: string;
}

const E = (d: EnemyDef) => d;

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(
  [
    // ------------------------------------------------ beasts
    E({ id: 'wolf', name: 'Grey Wolf', plural: 'Grey Wolves', faction: 'beast', body: 'quadruped', size: 0.9, color: '#7d7f86', color2: '#c9cbd0', hp: 26, dmg: 5, armor: 2, speed: 3.7, attackRange: 1.2, attackCd: 1.1, xp: 10, ai: 'melee', element: 'physical', drops: [['raw_meat', 0.4], ['wolf_pelt', 0.25]] }),
    E({ id: 'boar', name: 'Wild Boar', plural: 'Wild Boars', faction: 'beast', body: 'quadruped', size: 0.95, color: '#6a4a32', color2: '#e8dcc0', hp: 38, dmg: 6, armor: 5, speed: 3, attackRange: 1.2, attackCd: 1.3, xp: 13, ai: 'charger', element: 'physical', specials: [{ kind: 'charge', cd: 6, mult: 1.6 }], drops: [['raw_meat', 0.6], ['boar_tusk', 0.25]] }),
    E({ id: 'giant_rat', name: 'Giant Rat', plural: 'Giant Rats', faction: 'beast', body: 'quadruped', size: 0.6, color: '#5a4e48', color2: '#d0a0a0', hp: 14, dmg: 3, armor: 0, speed: 3.4, attackRange: 1, attackCd: 0.9, xp: 6, ai: 'swarm', element: 'physical', drops: [['raw_meat', 0.15]] }),
    E({ id: 'giant_spider', name: 'Giant Spider', plural: 'Giant Spiders', faction: 'beast', body: 'spider', size: 0.9, color: '#3a2f3a', color2: '#b02a2a', hp: 30, dmg: 6, armor: 3, speed: 3.4, attackRange: 1.2, attackCd: 1.1, xp: 14, ai: 'melee', element: 'poison', specials: [{ kind: 'web', cd: 7 }], drops: [['spider_silk', 0.4]], resist: { poison: 50 } }),
    E({ id: 'spiderling', name: 'Spiderling', plural: 'Spiderlings', faction: 'beast', body: 'spider', size: 0.5, color: '#4a3a4a', color2: '#c04040', hp: 10, dmg: 3, armor: 0, speed: 4, attackRange: 1, attackCd: 0.9, xp: 3, ai: 'swarm', element: 'poison' }),
    E({ id: 'bear', name: 'Brown Bear', plural: 'Brown Bears', faction: 'beast', body: 'quadruped', size: 1.35, color: '#5a3a22', color2: '#3a2414', hp: 80, dmg: 10, armor: 8, speed: 2.8, attackRange: 1.5, attackCd: 1.6, xp: 26, ai: 'melee', element: 'physical', specials: [{ kind: 'slam', cd: 7, mult: 1.6, radius: 2.4 }], drops: [['prime_meat', 0.7], ['raw_meat', 0.5]] }),
    E({ id: 'hellhound', name: 'Hellhound', plural: 'Hellhounds', faction: 'monster', body: 'quadruped', size: 1, color: '#3a1a14', color2: '#ff6a2a', hp: 50, dmg: 10, armor: 6, speed: 4.2, attackRange: 1.2, attackCd: 1, xp: 26, ai: 'melee', element: 'fire', resist: { fire: 60 }, drops: [['prime_meat', 0.3], ['ember_core', 0.08]] }),
    E({ id: 'spirit_wolf', name: 'Spirit Wolf', plural: 'Spirit Wolves', faction: 'beast', body: 'quadruped', size: 0.95, color: '#7ad0f0', color2: '#e0f8ff', hp: 40, dmg: 7, armor: 6, speed: 5, attackRange: 1.2, attackCd: 0.9, xp: 0, ai: 'melee', element: 'frost' }),

    // ------------------------------------------------ humans
    E({ id: 'bandit', name: 'Bandit Cutthroat', plural: 'Bandits', faction: 'human', body: 'humanoid', size: 1, color: '#7a5230', color2: '#3a2a1a', look: { skin: '#d9a57c', hair: '#3a2a1a', primary: '#6a4a2a', secondary: '#3a3a3a', tertiary: '#8b1e1e', weapon: 'sword', hood: true }, hp: 34, dmg: 6, armor: 6, speed: 3.1, attackRange: 1.4, attackCd: 1.2, xp: 14, ai: 'melee', element: 'physical', drops: [['bandit_insignia', 0.3], ['minor_potion', 0.06]] }),
    E({ id: 'bandit_archer', name: 'Bandit Archer', plural: 'Bandit Archers', faction: 'human', body: 'humanoid', size: 1, color: '#5a6a30', color2: '#3a2a1a', look: { skin: '#eac09a', hair: '#8a5a2b', primary: '#4a5a2a', secondary: '#3a2a1a', tertiary: '#8b1e1e', weapon: 'bow', offhand: 'quiver', hood: true }, hp: 24, dmg: 5, armor: 3, speed: 3.1, attackRange: 7, attackCd: 1.8, xp: 14, ai: 'ranged', element: 'physical', projectile: 'arrow', drops: [['bandit_insignia', 0.3]] }),
    E({ id: 'bandit_captain', name: 'Bandit Captain', plural: 'Bandit Captains', faction: 'human', body: 'humanoid', size: 1.15, color: '#8b1e1e', color2: '#2b2b30', look: { skin: '#b97f57', hair: '#1d1612', primary: '#8b1e1e', secondary: '#2b2b30', tertiary: '#d9a020', weapon: 'axe', offhand: 'shield', helmet: '#7a7a80' }, hp: 70, dmg: 9, armor: 10, speed: 3.2, attackRange: 1.5, attackCd: 1.3, xp: 32, ai: 'melee', element: 'physical', specials: [{ kind: 'charge', cd: 7, mult: 1.5 }], drops: [['bandit_insignia', 1], ['healing_potion', 0.15]] }),
    E({ id: 'cultist', name: 'Ashen Cultist', plural: 'Cultists', faction: 'human', body: 'humanoid', size: 1, color: '#3a1a2a', color2: '#e05a2a', look: { skin: '#c4b0a0', hair: '#1d1612', primary: '#3a1a2a', secondary: '#1a1a1a', tertiary: '#e05a2a', weapon: 'staff', hood: true }, hp: 30, dmg: 7, armor: 3, speed: 2.9, attackRange: 6.5, attackCd: 2, xp: 17, ai: 'caster', element: 'fire', projectile: 'fire', drops: [['grave_relic', 0.1], ['minor_potion', 0.08]] }),
    E({ id: 'town_guard', name: 'Town Guard', plural: 'Town Guards', faction: 'human', body: 'humanoid', size: 1.05, color: '#2a4d8b', color2: '#d9a020', look: { skin: '#d9a57c', hair: '#4a2e1b', primary: '#2a4d8b', secondary: '#4a4a52', tertiary: '#d9a020', weapon: 'spear', offhand: 'shield', helmet: '#9aa0aa' }, hp: 120, dmg: 10, armor: 15, speed: 3.3, attackRange: 1.6, attackCd: 1.1, xp: 0, ai: 'melee', element: 'physical' }),

    // ------------------------------------------------ goblins
    E({ id: 'goblin', name: 'Goblin Sneak', plural: 'Goblins', faction: 'goblin', body: 'humanoid', size: 0.75, color: '#5a8a3a', color2: '#6a4a2a', look: { skin: '#6a9a3a', hair: '#2a2a1a', primary: '#6a4a2a', secondary: '#4a3a2a', tertiary: '#a03a2a', weapon: 'dagger', ears: true, bulk: 0.85 }, hp: 20, dmg: 4, armor: 2, speed: 3.9, attackRange: 1.1, attackCd: 0.9, xp: 9, ai: 'swarm', element: 'physical', drops: [['goblin_ear', 0.35]] }),
    E({ id: 'goblin_shaman', name: 'Goblin Shaman', plural: 'Goblin Shamans', faction: 'goblin', body: 'humanoid', size: 0.8, color: '#5a8a3a', color2: '#8a3a8a', look: { skin: '#6a9a3a', hair: '#e8e8e8', primary: '#5a2a6a', secondary: '#3a2a1a', tertiary: '#e0c040', weapon: 'staff', ears: true, bulk: 0.85 }, hp: 22, dmg: 5, armor: 2, speed: 3.2, attackRange: 6, attackCd: 2, xp: 15, ai: 'caster', element: 'fire', projectile: 'fire', specials: [{ kind: 'heal', cd: 8, radius: 6 }], drops: [['goblin_ear', 0.5], ['meadowleaf', 0.3]] }),

    // ------------------------------------------------ undead
    E({ id: 'skeleton', name: 'Skeleton Warrior', plural: 'Skeletons', faction: 'undead', body: 'humanoid', size: 1, color: '#e8e4d8', color2: '#5a5040', look: { skin: '#e8e4d8', hair: '#e8e4d8', primary: '#5a5a5a', secondary: '#3a3a3a', tertiary: '#6a5a40', weapon: 'sword', offhand: 'shield', skeleton: true }, hp: 34, dmg: 6, armor: 9, speed: 2.8, attackRange: 1.4, attackCd: 1.3, xp: 15, ai: 'melee', element: 'physical', resist: { poison: 75, frost: 25 }, drops: [['bone_dust', 0.4]] }),
    E({ id: 'skeleton_archer', name: 'Skeleton Archer', plural: 'Skeleton Archers', faction: 'undead', body: 'humanoid', size: 1, color: '#e8e4d8', color2: '#5a5040', look: { skin: '#e8e4d8', hair: '#e8e4d8', primary: '#4a4a4a', secondary: '#3a3a3a', tertiary: '#6a5a40', weapon: 'bow', skeleton: true }, hp: 26, dmg: 6, armor: 5, speed: 2.8, attackRange: 7.5, attackCd: 1.9, xp: 15, ai: 'ranged', element: 'physical', projectile: 'arrow', resist: { poison: 75 }, drops: [['bone_dust', 0.4]] }),
    E({ id: 'zombie', name: 'Rotting Zombie', plural: 'Zombies', faction: 'undead', body: 'humanoid', size: 1.05, color: '#7a8a6a', color2: '#4a3a3a', look: { skin: '#8a9a7a', hair: '#2a2a2a', primary: '#4a4a3a', secondary: '#3a3a3a', tertiary: '#5a3a3a', bulk: 1.15 }, hp: 58, dmg: 8, armor: 4, speed: 1.9, attackRange: 1.3, attackCd: 1.6, xp: 16, ai: 'melee', element: 'physical', resist: { poison: 75 }, drops: [['grave_relic', 0.06]] }),
    E({ id: 'ghoul', name: 'Ghoul', plural: 'Ghouls', faction: 'undead', body: 'humanoid', size: 0.95, color: '#6a7a7a', color2: '#3a3a3a', look: { skin: '#7a8a8a', hair: '#1a1a1a', primary: '#3a3a3a', secondary: '#2a2a2a', tertiary: '#5a2a2a', bulk: 0.9 }, hp: 32, dmg: 6, armor: 3, speed: 4.1, attackRange: 1.2, attackCd: 0.9, xp: 15, ai: 'swarm', element: 'physical', resist: { poison: 50 }, drops: [['bone_dust', 0.2]] }),
    E({ id: 'wraith', name: 'Barrow Wraith', plural: 'Wraiths', faction: 'undead', body: 'ghost', size: 1, color: '#9ab0d0', color2: '#3a4a6a', hp: 40, dmg: 8, armor: 0, speed: 3, attackRange: 6, attackCd: 2.2, xp: 23, ai: 'caster', element: 'frost', projectile: 'frost', specials: [{ kind: 'blink', cd: 6 }, { kind: 'nova', cd: 9, mult: 1.2, radius: 2.8 }], resist: { physical: 30, poison: 100, frost: 50 }, drops: [['grave_relic', 0.2]] }),

    // ------------------------------------------------ orcs
    E({ id: 'orc_grunt', name: 'Orc Grunt', plural: 'Orc Grunts', faction: 'orc', body: 'humanoid', size: 1.2, color: '#4a7a3a', color2: '#5a3a2a', look: { skin: '#5a8a3a', hair: '#1a1a1a', primary: '#5a3a2a', secondary: '#3a3a3a', tertiary: '#8b1e1e', weapon: 'axe', tusks: true, bulk: 1.25, helmet: '#5a5a5a' }, hp: 60, dmg: 9, armor: 11, speed: 3, attackRange: 1.5, attackCd: 1.3, xp: 22, ai: 'melee', element: 'physical', drops: [['orc_tusk', 0.3], ['raw_meat', 0.2]] }),
    E({ id: 'orc_berserker', name: 'Orc Berserker', plural: 'Orc Berserkers', faction: 'orc', body: 'humanoid', size: 1.2, color: '#5a8a3a', color2: '#8b1e1e', look: { skin: '#6a9a3a', hair: '#8b1e1e', primary: '#8b1e1e', secondary: '#3a2a1a', tertiary: '#e8e0c8', weapon: 'axe', tusks: true, bulk: 1.3 }, hp: 55, dmg: 10, armor: 6, speed: 3.4, attackRange: 1.5, attackCd: 1.1, xp: 27, ai: 'charger', element: 'physical', specials: [{ kind: 'charge', cd: 6, mult: 1.6 }, { kind: 'enrage', cd: 999 }], drops: [['orc_tusk', 0.4]] }),
    E({ id: 'orc_shaman', name: 'Orc Shaman', plural: 'Orc Shamans', faction: 'orc', body: 'humanoid', size: 1.1, color: '#4a7a3a', color2: '#3a6a9a', look: { skin: '#5a8a3a', hair: '#e8e8e8', primary: '#3a4a6a', secondary: '#3a2a1a', tertiary: '#e0c040', weapon: 'staff', tusks: true, bulk: 1.1 }, hp: 40, dmg: 9, armor: 5, speed: 2.9, attackRange: 6.5, attackCd: 2, xp: 25, ai: 'caster', element: 'lightning', projectile: 'spark', specials: [{ kind: 'heal', cd: 9, radius: 7 }], drops: [['orc_tusk', 0.3], ['sunpetal', 0.2]] }),
    E({ id: 'ogre', name: 'Hill Ogre', plural: 'Ogres', faction: 'orc', body: 'humanoid', size: 1.7, color: '#8a7a5a', color2: '#5a4a3a', look: { skin: '#a09070', hair: '#3a2a1a', primary: '#5a4a3a', secondary: '#4a3a2a', tertiary: '#6a5a3a', weapon: 'club', bulk: 1.6 }, hp: 140, dmg: 16, armor: 12, speed: 2.4, attackRange: 1.9, attackCd: 2, xp: 46, ai: 'melee', element: 'physical', specials: [{ kind: 'slam', cd: 6, mult: 1.5, radius: 2.8 }], drops: [['prime_meat', 0.5], ['orc_tusk', 0.3]] }),

    // ------------------------------------------------ elves
    E({ id: 'elf_archer', name: 'Silverleaf Archer', plural: 'Elf Archers', faction: 'elf', body: 'humanoid', size: 1, color: '#2e7d5a', color2: '#d8d0a0', look: { skin: '#f0dcc8', hair: '#e8d9a0', primary: '#2e7d5a', secondary: '#3a4a2a', tertiary: '#d8d0a0', weapon: 'bow', offhand: 'quiver', ears: true, female: true }, hp: 38, dmg: 9, armor: 5, speed: 3.5, attackRange: 8, attackCd: 1.6, xp: 25, ai: 'ranged', element: 'physical', projectile: 'arrow', drops: [['elven_charm', 0.2]] }),
    E({ id: 'elf_bladedancer', name: 'Elven Bladedancer', plural: 'Bladedancers', faction: 'elf', body: 'humanoid', size: 1, color: '#2a4d8b', color2: '#d8d0a0', look: { skin: '#f0dcc8', hair: '#e9e9ea', primary: '#2a4d8b', secondary: '#2a2a3a', tertiary: '#d8d0a0', weapon: 'sword', ears: true }, hp: 45, dmg: 9, armor: 7, speed: 4, attackRange: 1.4, attackCd: 0.9, xp: 27, ai: 'melee', element: 'physical', specials: [{ kind: 'blink', cd: 5 }], drops: [['elven_charm', 0.25]] }),
    E({ id: 'elf_druid', name: 'Elven Druid', plural: 'Druids', faction: 'elf', body: 'humanoid', size: 1, color: '#5a8a2a', color2: '#8a5a2a', look: { skin: '#e8d0b8', hair: '#4a2e1b', primary: '#5a8a2a', secondary: '#5a3a1a', tertiary: '#f0c030', weapon: 'staff', ears: true, female: true, hood: true }, hp: 42, dmg: 8, armor: 4, speed: 3.1, attackRange: 6.5, attackCd: 2, xp: 27, ai: 'caster', element: 'poison', projectile: 'poison', specials: [{ kind: 'heal', cd: 8, radius: 7 }, { kind: 'root', cd: 10 }], drops: [['elven_charm', 0.2], ['frostbloom', 0.2]] }),
    E({ id: 'treant', name: 'Elder Treant', plural: 'Treants', faction: 'elf', body: 'treant', size: 1.6, color: '#5a4a2a', color2: '#4a8a3a', hp: 150, dmg: 14, armor: 16, speed: 1.9, attackRange: 1.8, attackCd: 2, xp: 46, ai: 'melee', element: 'physical', specials: [{ kind: 'slam', cd: 7, mult: 1.4, radius: 2.6 }, { kind: 'root', cd: 12 }], resist: { poison: 50, fire: -50 }, drops: [['elder_log', 0.6]] }),

    // ------------------------------------------------ monsters
    E({ id: 'imp', name: 'Cinder Imp', plural: 'Imps', faction: 'monster', body: 'imp', size: 0.75, color: '#c03a2a', color2: '#ffb030', hp: 28, dmg: 9, armor: 2, speed: 4, attackRange: 6.5, attackCd: 1.6, xp: 23, ai: 'ranged', element: 'fire', projectile: 'fire', resist: { fire: 75 }, drops: [['ember_core', 0.1]] }),
    E({ id: 'stone_golem', name: 'Stone Golem', plural: 'Stone Golems', faction: 'monster', body: 'golem', size: 1.6, color: '#7a7066', color2: '#ff8a2a', hp: 160, dmg: 16, armor: 26, speed: 1.9, attackRange: 1.8, attackCd: 2.2, xp: 50, ai: 'melee', element: 'physical', specials: [{ kind: 'slam', cd: 6, mult: 1.6, radius: 3 }], resist: { poison: 100, physical: 20 }, drops: [['adamantite_ore', 0.3], ['coal', 0.5]] }),
    E({ id: 'drake_whelp', name: 'Drake Whelp', plural: 'Drake Whelps', faction: 'monster', body: 'drake', size: 1.2, color: '#a03a2a', color2: '#e0a040', hp: 80, dmg: 12, armor: 12, speed: 3, attackRange: 1.6, attackCd: 1.5, xp: 38, ai: 'melee', element: 'fire', specials: [{ kind: 'breath', cd: 6, mult: 1.3 }], resist: { fire: 60 }, drops: [['drake_scale', 0.35], ['prime_meat', 0.3]] }),

    // ------------------------------------------------ bosses
    E({ id: 'grizzlemaw', name: 'Grizzlemaw', title: 'the Alpha', plural: 'Grizzlemaws', faction: 'beast', body: 'quadruped', size: 1.9, color: '#4a4a52', color2: '#e8e8e8', hp: 300, dmg: 10, armor: 8, speed: 3.6, attackRange: 1.8, attackCd: 1.3, xp: 220, ai: 'melee', element: 'physical', boss: true, specials: [{ kind: 'charge', cd: 7, mult: 1.6 }, { kind: 'summon', cd: 14, summon: 'wolf', count: 2 }, { kind: 'enrage', cd: 999 }], drops: [['wolf_pelt', 1], ['prime_meat', 1]] }),
    E({ id: 'brood_mother', name: 'Skitter', title: 'the Brood Mother', plural: 'Brood Mothers', faction: 'beast', body: 'spider', size: 2.1, color: '#2a1f2a', color2: '#d02a6a', hp: 420, dmg: 11, armor: 10, speed: 3, attackRange: 1.9, attackCd: 1.4, xp: 420, ai: 'melee', element: 'poison', boss: true, specials: [{ kind: 'summon', cd: 9, summon: 'spiderling', count: 4 }, { kind: 'web', cd: 6 }, { kind: 'slam', cd: 8, mult: 1.3, radius: 3 }], resist: { poison: 75 }, drops: [['spider_silk', 1]] }),
    E({ id: 'hollow_king', name: 'Morteth', title: 'the Hollow King', plural: 'Hollow Kings', faction: 'undead', body: 'humanoid', size: 1.6, color: '#d8d4c8', color2: '#5a3a8a', look: { skin: '#e8e4d8', hair: '#e8e4d8', primary: '#3a2a5a', secondary: '#1a1a2a', tertiary: '#d9a020', weapon: 'staff', skeleton: true, helmet: '#d9a020', bulk: 1.2 }, hp: 500, dmg: 12, armor: 12, speed: 2.6, attackRange: 7, attackCd: 1.8, xp: 720, ai: 'caster', element: 'frost', projectile: 'frost', boss: true, specials: [{ kind: 'summon', cd: 12, summon: 'skeleton', count: 3 }, { kind: 'nova', cd: 8, mult: 1.6, radius: 3.5 }, { kind: 'blink', cd: 9 }], resist: { poison: 75, frost: 50 }, drops: [['grave_relic', 1]] }),
    E({ id: 'gorrak', name: 'Gorrak', title: 'Warchief of Ironfang', plural: 'Warchiefs', faction: 'orc', body: 'humanoid', size: 1.75, color: '#3a6a2a', color2: '#8b1e1e', look: { skin: '#4a7a2a', hair: '#1a1a1a', primary: '#8b1e1e', secondary: '#2a2a2a', tertiary: '#d9a020', weapon: 'axe', offhand: 'shield', tusks: true, bulk: 1.5, helmet: '#4a4a4a' }, hp: 650, dmg: 16, armor: 20, speed: 3.2, attackRange: 2, attackCd: 1.4, xp: 1100, ai: 'melee', element: 'physical', boss: true, specials: [{ kind: 'charge', cd: 7, mult: 1.6 }, { kind: 'slam', cd: 8, mult: 1.8, radius: 3.2 }, { kind: 'summon', cd: 16, summon: 'orc_grunt', count: 2 }, { kind: 'enrage', cd: 999 }], drops: [['orc_tusk', 1]] }),
    E({ id: 'thornqueen', name: 'Sylvaris', title: 'the Thornqueen', plural: 'Thornqueens', faction: 'elf', body: 'humanoid', size: 1.5, color: '#2e7d5a', color2: '#b04a7a', look: { skin: '#f0dcc8', hair: '#b04a7a', primary: '#2e5a3a', secondary: '#1a2a1a', tertiary: '#b04a7a', weapon: 'bow', ears: true, female: true, helmet: '#5a9a3a' }, hp: 750, dmg: 17, armor: 14, speed: 3.6, attackRange: 8, attackCd: 1.3, xp: 1600, ai: 'ranged', element: 'poison', projectile: 'poison', boss: true, specials: [{ kind: 'volley', cd: 6, mult: 0.9, count: 7 }, { kind: 'root', cd: 9 }, { kind: 'blink', cd: 7 }, { kind: 'summon', cd: 18, summon: 'treant', count: 1 }], drops: [['elven_charm', 1]] }),
    E({ id: 'ashmaw', name: 'Ashmaw', title: 'the Cinder Drake', plural: 'Ashmaws', faction: 'monster', body: 'drake', size: 2.4, color: '#5a1a14', color2: '#ff8a2a', hp: 1000, dmg: 20, armor: 22, speed: 3, attackRange: 2.2, attackCd: 1.6, xp: 2600, ai: 'melee', element: 'fire', boss: true, specials: [{ kind: 'breath', cd: 6, mult: 1.4 }, { kind: 'meteor', cd: 9, mult: 2, radius: 2.6 }, { kind: 'slam', cd: 8, mult: 1.6, radius: 3.4 }, { kind: 'summon', cd: 18, summon: 'imp', count: 3 }], resist: { fire: 75 }, drops: [['drake_scale', 1], ['ember_core', 1]] }),
  ].map((d) => [d.id, d]),
);

export const ELITE_PREFIXES = ['Savage', 'Dread', 'Grim', 'Bloodthirsty', 'Ancient', 'Vicious', 'Blighted', 'Frenzied', 'Ironhide', 'Shadow'];
export const BOUNTY_NAMES = [
  'Old One-Eye', 'Mad Morrigan', 'Knuckles', 'The Butcher of Elm Hollow', 'Grimtooth', 'Silent Sal', 'Rotgut', 'Black Agnes',
  'Three-Fingers Fenn', 'The Widow', 'Scratch', 'Howling Hal', 'Lady Ashgrave', 'Brother Cinder', 'Gristle', 'Vex the Quick',
];

// Enemy growth roughly tracks player power: weapon damage, primary stat and
// gear all rise with level, so enemies use gentle polynomial curves.
export const ENEMY_SCALING = {
  hp: (lvl: number) => 1 + 0.35 * (lvl - 1) + 0.025 * (lvl - 1) ** 2,
  dmg: (lvl: number) => 1 + 0.18 * (lvl - 1) + 0.006 * (lvl - 1) ** 2,
  armor: (lvl: number) => 1 + 0.22 * (lvl - 1),
  xp: (lvl: number) => 1 + 0.5 * (lvl - 1),
};
