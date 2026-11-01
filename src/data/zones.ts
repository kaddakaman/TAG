export interface Biome {
  ground: string[];
  path: string;
  water: string;
  waterDeep: string;
  edge: string;
  sand: string;
  decor: ('rock' | 'bush' | 'flowers' | 'grave' | 'bones' | 'deadtree' | 'crystal' | 'lava' | 'mushroom' | 'stump' | 'pine' | 'snow')[];
  treeKinds: string[];
  fog?: string;
  ambient: string;
}

export interface ZoneDef {
  id: string;
  name: string;
  subtitle: string;
  level: [number, number];
  index: number;
  biome: Biome;
  roster: [string, number][];
  boss: string;
  ores: string[];
  trees: string[];
  fish: string[];
  herbs: string[];
  /** density of hostile packs */
  packs: number;
  size: number;
}

export const TOWN_ID = 'town';

export const ZONES: ZoneDef[] = [
  {
    id: 'greenmeadow', name: 'Greenmeadow Fields', subtitle: 'Rolling farmland plagued by wolves and bandits', level: [1, 4], index: 1,
    biome: { ground: ['#5f8f3e', '#679a44', '#58873a', '#6ea14a'], path: '#a08860', water: '#3a78a8', waterDeep: '#2c5f8a', edge: '#3f6a2a', sand: '#c9b77e', decor: ['bush', 'flowers', 'rock', 'stump'], treeKinds: ['oak'], ambient: 'rgba(255,240,200,0.05)' },
    roster: [['wolf', 4], ['boar', 3], ['giant_rat', 2], ['bandit', 3], ['bandit_archer', 2]],
    boss: 'grizzlemaw', ores: ['copper_ore'], trees: ['oak_log'], fish: ['raw_trout'], herbs: ['meadowleaf'], packs: 9, size: 64,
  },
  {
    id: 'whisperwood', name: 'Whisperwood', subtitle: 'An old forest thick with webs and goblin dens', level: [4, 8], index: 2,
    biome: { ground: ['#3f6e34', '#467a39', '#3a652f', '#4b7f3c'], path: '#8a7350', water: '#2f6a80', waterDeep: '#22526a', edge: '#2a4a22', sand: '#a89a6a', decor: ['mushroom', 'bush', 'stump', 'rock', 'pine'], treeKinds: ['oak', 'willow', 'pine'], ambient: 'rgba(20,60,30,0.10)' },
    roster: [['giant_spider', 4], ['goblin', 4], ['goblin_shaman', 2], ['wolf', 2], ['bear', 1], ['bandit', 1]],
    boss: 'brood_mother', ores: ['copper_ore', 'iron_ore'], trees: ['oak_log', 'willow_log'], fish: ['raw_trout', 'raw_perch'], herbs: ['meadowleaf', 'sunpetal'], packs: 10, size: 64,
  },
  {
    id: 'barrowmoor', name: 'Barrowmoor', subtitle: 'Fog-bound barrows where the dead do not rest', level: [8, 12], index: 3,
    biome: { ground: ['#5a6450', '#636c56', '#555e4a', '#6a705a'], path: '#7a7060', water: '#3a4a50', waterDeep: '#2a3840', edge: '#3a3f34', sand: '#8a8670', decor: ['grave', 'bones', 'deadtree', 'rock', 'mushroom'], treeKinds: ['deadtree', 'willow'], fog: 'rgba(160,170,190,0.16)', ambient: 'rgba(40,30,70,0.18)' },
    roster: [['skeleton', 4], ['skeleton_archer', 3], ['zombie', 3], ['ghoul', 3], ['wraith', 2], ['cultist', 1]],
    boss: 'hollow_king', ores: ['iron_ore', 'coal', 'silver_ore'], trees: ['willow_log', 'maple_log'], fish: ['raw_perch', 'raw_salmon'], herbs: ['sunpetal', 'nightshade'], packs: 11, size: 64,
  },
  {
    id: 'ironfang', name: 'Ironfang Highlands', subtitle: 'Windswept crags ruled by the orc warbands', level: [12, 17], index: 4,
    biome: { ground: ['#8a8060', '#948a68', '#7f7658', '#9a9070'], path: '#a89878', water: '#4a7a98', waterDeep: '#3a6680', edge: '#5a5444', sand: '#b8a880', decor: ['rock', 'rock', 'pine', 'snow', 'bones'], treeKinds: ['pine', 'maple'], ambient: 'rgba(200,210,230,0.06)' },
    roster: [['orc_grunt', 4], ['orc_berserker', 3], ['orc_shaman', 2], ['ogre', 1], ['wolf', 2], ['goblin', 2]],
    boss: 'gorrak', ores: ['coal', 'silver_ore', 'mithril_ore'], trees: ['maple_log', 'yew_log'], fish: ['raw_salmon', 'raw_pike'], herbs: ['nightshade', 'frostbloom'], packs: 11, size: 66,
  },
  {
    id: 'silverleaf', name: 'Silverleaf Glade', subtitle: 'An ancient elven wood that no longer welcomes outsiders', level: [17, 22], index: 5,
    biome: { ground: ['#3f8a6a', '#469672', '#3a7f62', '#4fa07a'], path: '#b0a888', water: '#3a8ab0', waterDeep: '#2a7096', edge: '#2a5a4a', sand: '#c8c09a', decor: ['flowers', 'flowers', 'mushroom', 'bush', 'crystal'], treeKinds: ['silver', 'willow'], ambient: 'rgba(120,255,220,0.05)' },
    roster: [['elf_archer', 4], ['elf_bladedancer', 3], ['elf_druid', 2], ['treant', 1], ['bear', 2]],
    boss: 'thornqueen', ores: ['silver_ore', 'mithril_ore'], trees: ['yew_log', 'elder_log'], fish: ['raw_pike', 'raw_eel'], herbs: ['frostbloom', 'emberroot'], packs: 12, size: 66,
  },
  {
    id: 'ashen', name: 'The Ashen Wastes', subtitle: 'Scorched badlands beneath the drake\'s mountain', level: [22, 28], index: 6,
    biome: { ground: ['#4a4240', '#524846', '#433c3a', '#5a4e4a'], path: '#6a5a50', water: '#a8401a', waterDeep: '#802a10', edge: '#2a2220', sand: '#7a6050', decor: ['lava', 'rock', 'deadtree', 'bones', 'crystal'], treeKinds: ['deadtree'], fog: 'rgba(80,30,20,0.12)', ambient: 'rgba(255,80,20,0.07)' },
    roster: [['imp', 4], ['hellhound', 3], ['stone_golem', 2], ['drake_whelp', 2], ['cultist', 3]],
    boss: 'ashmaw', ores: ['mithril_ore', 'adamantite_ore'], trees: ['elder_log'], fish: ['raw_eel'], herbs: ['emberroot'], packs: 12, size: 66,
  },
];

export const ZONE_MAP: Record<string, ZoneDef> = Object.fromEntries(ZONES.map((z) => [z.id, z]));

export const TOWN_BIOME: Biome = {
  ground: ['#6a9a48', '#72a24e', '#649444', '#78a854'],
  path: '#b8a07a',
  water: '#3a80b0',
  waterDeep: '#2c6890',
  edge: '#4a7a30',
  sand: '#d0c08a',
  decor: ['flowers', 'bush'],
  treeKinds: ['oak'],
  ambient: 'rgba(255,240,200,0.04)',
};

export function nextZone(id: string): ZoneDef | undefined {
  if (id === TOWN_ID) return ZONES[0];
  const i = ZONES.findIndex((z) => z.id === id);
  return ZONES[i + 1];
}

export function prevZoneId(id: string): string {
  const i = ZONES.findIndex((z) => z.id === id);
  return i <= 0 ? TOWN_ID : ZONES[i - 1].id;
}

export function zoneName(id: string): string {
  return id === TOWN_ID ? 'Hearthvale' : ZONE_MAP[id]?.name ?? id;
}
