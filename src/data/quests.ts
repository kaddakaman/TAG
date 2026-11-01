import type { LifeSkillId, Rarity } from '../types';
import type { Faction } from './enemies';
import type { ToolId } from './items';

export type QuestObjective =
  | { kind: 'kill'; enemy?: string; faction?: Faction; zone?: string; count: number; label: string }
  | { kind: 'boss'; enemy: string; zone: string; count: 1; label: string }
  | { kind: 'collect'; item: string; count: number; label: string };

export interface QuestDef {
  id: string;
  giver: string;
  title: string;
  intro: string;
  done: string;
  objectives: QuestObjective[];
  rewardGold: number;
  /** combat quests only - non-combat requests never grant combat experience */
  rewardXp: number;
  rewardItem?: { rarity: Rarity; ilvl: number };
  rewardItems?: [string, number][];
  rewardTool?: ToolId;
  rewardSkillXp?: { skill: LifeSkillId; xp: number };
  unlockZone?: string;
  requires?: string;
  minLevel?: number;
  story?: boolean;
}

export const QUESTS: QuestDef[] = [
  // ------------------------------------------------------------- Guild story
  {
    id: 'guild_1', giver: 'guildmaster', story: true, title: 'Proving Your Mettle',
    intro: "So you want to wear the badge of the Adventurer's Guild? Words are cheap. The wolves in Greenmeadow have been savaging the farmsteads. Thin the pack - six of them - and we'll talk.",
    done: 'Not bad for a fresh recruit. Welcome to the Guild. Keep your blade sharp - Greenmeadow has bigger problems.',
    objectives: [{ kind: 'kill', enemy: 'wolf', zone: 'greenmeadow', count: 6, label: 'Slay Grey Wolves in Greenmeadow' }],
    rewardGold: 40, rewardXp: 90,
  },
  {
    id: 'guild_2', giver: 'guildmaster', story: true, title: 'The Alpha of Greenmeadow', requires: 'guild_1',
    intro: 'Those wolves answer to something. Farmers whisper of a monstrous alpha with a white mane - Grizzlemaw. It dens at the far end of the fields. Kill it, and the Guild will open the road to Whisperwood.',
    done: "Grizzlemaw's mane! The farmers will sleep soundly tonight. The road to Whisperwood is yours, adventurer.",
    objectives: [{ kind: 'boss', enemy: 'grizzlemaw', zone: 'greenmeadow', count: 1, label: 'Slay Grizzlemaw the Alpha' }],
    rewardGold: 150, rewardXp: 300, rewardItem: { rarity: 2, ilvl: 5 }, unlockZone: 'whisperwood',
  },
  {
    id: 'guild_3', giver: 'guildmaster', story: true, title: 'Silk and Shadows', requires: 'guild_2',
    intro: 'Whisperwood was once a woodcutter\'s paradise. Now it crawls with giant spiders and goblin raiders. Clear them out.',
    done: 'Good work. But the spiders keep coming... something is breeding them.',
    objectives: [
      { kind: 'kill', enemy: 'giant_spider', zone: 'whisperwood', count: 8, label: 'Slay Giant Spiders' },
      { kind: 'kill', faction: 'goblin', zone: 'whisperwood', count: 6, label: 'Slay Goblins' },
    ],
    rewardGold: 160, rewardXp: 650,
  },
  {
    id: 'guild_4', giver: 'guildmaster', story: true, title: 'The Brood Mother', requires: 'guild_3',
    intro: 'Our scouts found the nest: a spider the size of a hay cart. Skitter, the woodcutters call her. End her, and the Guild will grant you passage to Barrowmoor.',
    done: 'The Brood Mother is dead? Ha! The woodcutters owe you a round. Barrowmoor awaits - but beware, the dead walk there.',
    objectives: [{ kind: 'boss', enemy: 'brood_mother', zone: 'whisperwood', count: 1, label: 'Slay Skitter the Brood Mother' }],
    rewardGold: 300, rewardXp: 900, rewardItem: { rarity: 2, ilvl: 9 }, unlockZone: 'barrowmoor',
  },
  {
    id: 'guild_5', giver: 'guildmaster', story: true, title: 'Restless Barrows', requires: 'guild_4',
    intro: 'The barrows have broken open. Skeletons, ghouls, wraiths... Put fifteen of them back in the ground.',
    done: 'The dead are returning to their graves. But someone - something - is raising them.',
    objectives: [{ kind: 'kill', faction: 'undead', zone: 'barrowmoor', count: 15, label: 'Destroy the Undead' }],
    rewardGold: 320, rewardXp: 1600,
  },
  {
    id: 'guild_6', giver: 'guildmaster', story: true, title: 'The Hollow King', requires: 'guild_5',
    intro: 'Old Morteth - a king buried a thousand years ago - has risen as a lich. He commands the barrows. Destroy him.',
    done: 'The Hollow King falls! Tales of this will be told in every tavern from here to the coast. The Highlands are open to you now.',
    objectives: [{ kind: 'boss', enemy: 'hollow_king', zone: 'barrowmoor', count: 1, label: 'Destroy Morteth the Hollow King' }],
    rewardGold: 600, rewardXp: 2400, rewardItem: { rarity: 3, ilvl: 13 }, unlockZone: 'ironfang',
  },
  {
    id: 'guild_7', giver: 'guildmaster', story: true, title: 'Breaking the Warband', requires: 'guild_6',
    intro: 'The Ironfang orcs are massing. If they march, Hearthvale burns. Break their warband - fifteen orcs should get their attention.',
    done: 'Their numbers are thinning. Gorrak himself will come out now.',
    objectives: [{ kind: 'kill', faction: 'orc', zone: 'ironfang', count: 15, label: 'Slay Ironfang Orcs' }],
    rewardGold: 650, rewardXp: 3600,
  },
  {
    id: 'guild_8', giver: 'guildmaster', story: true, title: "Gorrak's End", requires: 'guild_7',
    intro: 'Warchief Gorrak holds the high pass. Cut off the head and the body will scatter.',
    done: 'Gorrak is dead and the warband scattered! Beyond the highlands lies Silverleaf Glade... the elves there have turned hostile. Find out why.',
    objectives: [{ kind: 'boss', enemy: 'gorrak', zone: 'ironfang', count: 1, label: 'Slay Warchief Gorrak' }],
    rewardGold: 1100, rewardXp: 5200, rewardItem: { rarity: 3, ilvl: 18 }, unlockZone: 'silverleaf',
  },
  {
    id: 'guild_9', giver: 'guildmaster', story: true, title: 'Wrath of the Silverleaf', requires: 'guild_8',
    intro: 'The elves shoot first and never ask. Something has poisoned their minds. Fight your way through - fifteen of them.',
    done: 'They fought like the possessed. Their queen has been corrupted by something from the Ashen Wastes.',
    objectives: [{ kind: 'kill', faction: 'elf', zone: 'silverleaf', count: 15, label: 'Defeat Silverleaf Elves' }],
    rewardGold: 1200, rewardXp: 7600,
  },
  {
    id: 'guild_10', giver: 'guildmaster', story: true, title: 'The Thornqueen', requires: 'guild_9',
    intro: 'Sylvaris, the Thornqueen. Free her from the corruption - by the only means left to us.',
    done: 'With her last breath she named it: Ashmaw, the Cinder Drake. The source of all this rot. The Wastes are open to you.',
    objectives: [{ kind: 'boss', enemy: 'thornqueen', zone: 'silverleaf', count: 1, label: 'Defeat Sylvaris the Thornqueen' }],
    rewardGold: 2000, rewardXp: 10000, rewardItem: { rarity: 3, ilvl: 23 }, unlockZone: 'ashen',
  },
  {
    id: 'guild_11', giver: 'guildmaster', story: true, title: 'Into the Ash', requires: 'guild_10',
    intro: 'The Ashen Wastes swarm with fire-spawn and mad cultists. Carve a path to the drake\'s mountain.',
    done: 'You\'ve reached the mountain\'s foot. Only Ashmaw remains.',
    objectives: [
      { kind: 'kill', faction: 'monster', zone: 'ashen', count: 12, label: 'Slay creatures of the Wastes' },
      { kind: 'kill', enemy: 'cultist', zone: 'ashen', count: 6, label: 'Slay Ashen Cultists' },
    ],
    rewardGold: 2200, rewardXp: 14000,
  },
  {
    id: 'guild_12', giver: 'guildmaster', story: true, title: 'Ashmaw', requires: 'guild_11',
    intro: 'This is it. Every guild member who ever lived would envy you this moment. Go slay a dragon.',
    done: 'Ashmaw is slain! Hearthvale - no, the whole realm - is in your debt. You are a legend of the Adventurer\'s Guild.',
    objectives: [{ kind: 'boss', enemy: 'ashmaw', zone: 'ashen', count: 1, label: 'Slay Ashmaw the Cinder Drake' }],
    rewardGold: 5000, rewardXp: 20000, rewardItem: { rarity: 4, ilvl: 28 },
  },

  // ------------------------------------------------------------- Villager requests
  {
    id: 'captain_1', giver: 'captain', title: 'Bandit Trouble', minLevel: 2,
    intro: 'Bandits are robbing travellers on the Greenmeadow road. My guards can\'t leave the walls. Deal with eight of them, would you?',
    done: 'The road is safer for it. Here - payment from the town coffers.',
    objectives: [{ kind: 'kill', faction: 'human', zone: 'greenmeadow', count: 8, label: 'Defeat Greenmeadow Bandits' }],
    rewardGold: 80, rewardXp: 200, rewardItems: [['minor_potion', 3]],
  },
  {
    id: 'smith_1', giver: 'smith', title: 'Ore for the Forge',
    intro: "My forge is cold and my ore bins are empty. Bring me 8 Copper Ore from the Greenmeadow veins and I'll make you a proper copper pickaxe.",
    done: 'Good, honest ore. Here\'s your pickaxe - you\'ll mine twice as fast with that. Bring me ore any time; I can forge it into gear.',
    objectives: [{ kind: 'collect', item: 'copper_ore', count: 8, label: 'Bring Copper Ore' }],
    rewardGold: 30, rewardXp: 0, rewardTool: 'pickaxe', rewardSkillXp: { skill: 'mining', xp: 120 },
  },
  {
    id: 'smith_2', giver: 'smith', title: 'Iron Will', requires: 'smith_1',
    intro: 'Iron is the backbone of a good blade. Whisperwood has iron veins for those skilled enough. Bring me 10 Iron Ore.',
    done: 'Fine iron. I forged you something special while I waited.',
    objectives: [{ kind: 'collect', item: 'iron_ore', count: 10, label: 'Bring Iron Ore' }],
    rewardGold: 150, rewardXp: 0, rewardItem: { rarity: 2, ilvl: 10 }, rewardSkillXp: { skill: 'mining', xp: 400 },
  },
  {
    id: 'woodsman_1', giver: 'storage', title: 'Firewood for Winter',
    intro: 'The warehouse needs firewood before the cold comes. 10 Oak Logs and I\'ll give you my old hatchet - copper head, still sharp.',
    done: 'Ah, that\'ll keep us warm. The hatchet\'s yours.',
    objectives: [{ kind: 'collect', item: 'oak_log', count: 10, label: 'Bring Oak Logs' }],
    rewardGold: 30, rewardXp: 0, rewardTool: 'hatchet', rewardSkillXp: { skill: 'woodcutting', xp: 120 },
  },
  {
    id: 'fisher_1', giver: 'fisher', title: 'Something Fishy',
    intro: "Heh. You look like you've never held a rod. Catch me 6 Raw Trout - the town pond has some - and I'll give you a real rod.",
    done: 'Not bad at all! Take this copper-tipped rod. The fish practically jump onto it.',
    objectives: [{ kind: 'collect', item: 'raw_trout', count: 6, label: 'Bring Raw Trout' }],
    rewardGold: 25, rewardXp: 0, rewardTool: 'rod', rewardSkillXp: { skill: 'fishing', xp: 120 },
  },
  {
    id: 'inn_1', giver: 'innkeeper', title: 'A Taste of Home',
    intro: 'My cook ran off with a bard. Can you cook? Bring me 5 Grilled Trout - catch it, then cook it at a campfire or my range.',
    done: 'Delicious! You\'ve a knack for this. Here, for your trouble.',
    objectives: [{ kind: 'collect', item: 'grilled_trout', count: 5, label: 'Bring Grilled Trout' }],
    rewardGold: 60, rewardXp: 0, rewardSkillXp: { skill: 'cooking', xp: 200 }, rewardItems: [['minor_potion', 2]],
  },
  {
    id: 'inn_2', giver: 'innkeeper', title: "The Hunter's Table", requires: 'inn_1',
    intro: "The guild lads want something heartier. 4 Hunter's Stews - prime cuts from bears, plus sunpetal.",
    done: 'They\'ll be singing about this stew for weeks. Thank you, friend.',
    objectives: [{ kind: 'collect', item: 'hunters_stew', count: 4, label: "Bring Hunter's Stew" }],
    rewardGold: 260, rewardXp: 0, rewardSkillXp: { skill: 'cooking', xp: 900 },
  },
  {
    id: 'herb_1', giver: 'herbalist', title: 'Herbal Remedies',
    intro: 'My old knees can\'t take me to the fields anymore, dear. Fetch me 8 Meadowleaf and I\'ll brew potions for you whenever you bring herbs - and give you my sickle.',
    done: 'Lovely, fresh leaves. Now, bring me herbs any time and I\'ll brew you remedies.',
    objectives: [{ kind: 'collect', item: 'meadowleaf', count: 8, label: 'Bring Meadowleaf' }],
    rewardGold: 30, rewardXp: 0, rewardTool: 'sickle', rewardItems: [['minor_potion', 3]], rewardSkillXp: { skill: 'foraging', xp: 120 },
  },
  {
    id: 'herb_2', giver: 'herbalist', title: 'Deadly Nightshade', requires: 'herb_1',
    intro: 'Nightshade grows on the moors. Poison, yes - but in the right hands, medicine. Bring me 6.',
    done: 'Careful handling, I see. You\'d have made a fine herbalist.',
    objectives: [{ kind: 'collect', item: 'nightshade', count: 6, label: 'Bring Nightshade' }],
    rewardGold: 180, rewardXp: 0, rewardItems: [['healing_potion', 4]], rewardSkillXp: { skill: 'foraging', xp: 700 },
  },
];

export const QUEST_MAP: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
