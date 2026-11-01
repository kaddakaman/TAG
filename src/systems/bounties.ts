import type { Bounty, LifeSkillId } from '../types';
import type { Rng } from '../core/rng';
import { ENEMIES, BOUNTY_NAMES, ENEMY_SCALING } from '../data/enemies';
import { ZONE_MAP } from '../data/zones';
import { STACKABLES } from '../data/items';
import { NODES, RECIPES } from '../data/lifeskills';
import type { Session } from './session';

const GIVERS = ['Farmer Hob', 'Widow Tansy', 'Miller Odo', 'Sister Adela', 'Young Pip', 'Merchant Guild', 'The Town Watch', 'Old Gil', 'Tomas the Innkeeper', 'Brenna Ironhand'];

export function generateBounty(r: Rng, s: Session, id: string): Bounty | null {
  const unlocked = s.data.world.unlockedZones.map((z) => ZONE_MAP[z]).filter(Boolean);
  if (!unlocked.length) return null;
  // favour the most recent zones
  const zone = r.chance(0.6) ? unlocked[unlocked.length - 1] : r.pick(unlocked);
  const midLvl = Math.round((zone.level[0] + zone.level[1]) / 2);
  const kind = r.weighted([
    ['kill', 38],
    ['elite', 20],
    ['gather', 30],
    ['deliver', 12],
  ] as const);
  const giver = r.pick(GIVERS);

  if (kind === 'kill' || kind === 'elite') {
    const enemyId = r.weighted(zone.roster);
    const def = ENEMIES[enemyId];
    const xpEach = def.xp * ENEMY_SCALING.xp(midLvl);
    if (kind === 'kill') {
      const count = r.int(6, 12);
      return {
        id, giver, accepted: false, progress: 0,
        title: `Cull the ${def.plural}`,
        desc: `${giver} reports that ${def.plural.toLowerCase()} in ${zone.name} have grown bold. Slay ${count}.`,
        objective: { kind: 'kill', enemyId, zoneId: zone.id, count },
        rewardGold: Math.round((15 + midLvl * 10) * (count / 8) * r.range(0.9, 1.15)),
        rewardXp: Math.round(xpEach * count * 0.6),
      };
    }
    const eliteName = r.pick(BOUNTY_NAMES);
    return {
      id, giver, accepted: false, progress: 0,
      title: `Wanted: ${eliteName}`,
      desc: `A notorious ${def.name.toLowerCase()} known as "${eliteName}" stalks ${zone.name}. Find it and bring proof of the kill.`,
      objective: { kind: 'elite', enemyId, zoneId: zone.id, count: 1, eliteName },
      rewardGold: Math.round((50 + midLvl * 22) * r.range(0.9, 1.2)),
      rewardXp: Math.round(xpEach * 7),
    };
  }

  if (kind === 'gather') {
    // A material the player can actually gather (within a few levels)
    const options = Object.values(NODES).filter((n) => {
      const lvl = s.lifeLevel(n.skill);
      return n.level <= lvl + 4 && unlocked.some((z) => [...z.ores, ...z.trees, ...z.fish, ...z.herbs].includes(n.item));
    });
    if (!options.length) return null;
    const node = r.pick(options);
    const item = STACKABLES[node.item];
    const count = r.int(5, 12);
    return {
      id, giver, accepted: false, progress: 0,
      title: `Supply Request: ${item.name}`,
      desc: `${giver} needs ${count} ${item.name} delivered to the bounty board.`,
      objective: { kind: 'gather', itemId: node.item, count },
      rewardGold: Math.round((item.value * count * 2.5 + 20) * r.range(0.9, 1.15)),
      rewardXp: 0,
      rewardSkillXp: { skill: node.skill as LifeSkillId, xp: Math.round(node.xp * count * 0.5) },
    };
  }

  // deliver cooked food
  const cookLvl = s.lifeLevel('cooking');
  const recipes = RECIPES.filter((rc) => rc.station === 'cook' && rc.level <= cookLvl + 3);
  if (!recipes.length) return null;
  const rc = r.pick(recipes);
  const food = STACKABLES[rc.output];
  const count = r.int(3, 6);
  return {
    id, giver, accepted: false, progress: 0,
    title: `Kitchen Order: ${food.name}`,
    desc: `${giver} is hosting a feast and needs ${count} ${food.name}.`,
    objective: { kind: 'deliver', itemId: rc.output, count },
    rewardGold: Math.round((food.value * count * 3 + 25) * r.range(0.9, 1.15)),
    rewardXp: 0,
    rewardSkillXp: { skill: 'cooking', xp: Math.round(rc.xp * count * 0.8) },
  };
}
