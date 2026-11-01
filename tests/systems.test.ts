import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { screenDirToWorld, isoToScreen, screenToIso } from '../src/core/math';
import { xpToNext } from '../src/data/classes';
import { ABILITIES, ABILITY_MAP } from '../src/data/abilities';
import { ENEMIES } from '../src/data/enemies';
import { QUESTS, QUEST_MAP } from '../src/data/quests';
import { NODES, RECIPES, lifeLevelFromXp, lifeXpForLevel } from '../src/data/lifeskills';
import { STACKABLES } from '../src/data/items';
import { ZONES } from '../src/data/zones';
import { TOWN_LEVELS } from '../src/data/town';
import { canEquip, generateGear, getInfo, makeStack, rollRarity } from '../src/systems/items';
import { randomBaseFor, rollLoot } from '../src/systems/loot';
import { fatigueMult, levelDiffMult, xpForKill } from '../src/systems/progression';
import { loadShared, loadSlot, newSave, writeSlot, listSlots, deleteSlot } from '../src/systems/save';
import { Session } from '../src/systems/session';
import { smith, smithRecipes, cookOnce, upgradeTool } from '../src/systems/crafting';
import { GEAR_BASES, classesForBase } from '../src/data/items';

const APP = { gender: 'male' as const, skin: '#d9a57c', hair: '#1d1612', hairStyle: 0, primary: '#8b1e1e', secondary: '#2b2b30', tertiary: '#d9a020' };

function session(cls: 'fighter' | 'mage' | 'ranger' = 'fighter'): Session {
  return new Session(newSave(0, 'Test', cls, APP), { version: 1, stash: [], bestProsperity: 0 });
}

describe('math', () => {
  it('round-trips the isometric projection', () => {
    const s = isoToScreen(12.5, 7.25);
    const w = screenToIso(s.x, s.y);
    expect(w.x).toBeCloseTo(12.5);
    expect(w.y).toBeCloseTo(7.25);
  });
  it('maps stick-up to moving up the screen', () => {
    const d = screenDirToWorld(0, -1);
    const s = isoToScreen(d.x, d.y);
    expect(s.y).toBeLessThan(0);
    expect(Math.abs(s.x)).toBeLessThan(1e-6);
  });
});

describe('data integrity', () => {
  it('every ability prerequisite exists and belongs to the same class', () => {
    for (const a of ABILITIES) {
      if (a.prereq) {
        expect(ABILITY_MAP[a.prereq.id], a.id).toBeDefined();
        expect(ABILITY_MAP[a.prereq.id].classId).toBe(a.classId);
      }
      expect(a.kind === 'passive' ? !!a.passive : !!a.effect, a.id).toBe(true);
    }
  });
  it('each class has major abilities', () => {
    for (const c of ['fighter', 'mage', 'ranger']) {
      expect(ABILITIES.filter((a) => a.classId === c && a.major).length).toBeGreaterThanOrEqual(3);
    }
  });
  it('zones reference real enemies, bosses and resources', () => {
    for (const z of ZONES) {
      expect(ENEMIES[z.boss]?.boss, z.boss).toBe(true);
      for (const [e] of z.roster) expect(ENEMIES[e], e).toBeDefined();
      for (const it of [...z.ores, ...z.trees, ...z.fish, ...z.herbs]) expect(STACKABLES[it], it).toBeDefined();
    }
  });
  it('quests reference real enemies, items and zones', () => {
    for (const q of QUESTS) {
      if (q.requires) expect(QUEST_MAP[q.requires]).toBeDefined();
      for (const o of q.objectives) {
        if (o.kind === 'boss') expect(ENEMIES[o.enemy]?.boss).toBe(true);
        if (o.kind === 'kill' && o.enemy) expect(ENEMIES[o.enemy]).toBeDefined();
        if (o.kind === 'collect') expect(STACKABLES[o.item]).toBeDefined();
      }
    }
  });
  it('every enemy drop and recipe ingredient exists', () => {
    for (const e of Object.values(ENEMIES)) for (const [id] of e.drops ?? []) expect(STACKABLES[id], id).toBeDefined();
    for (const r of RECIPES) {
      expect(STACKABLES[r.output]).toBeDefined();
      for (const [id] of r.inputs) expect(STACKABLES[id], id).toBeDefined();
    }
    for (const n of Object.values(NODES)) expect(STACKABLES[n.item]).toBeDefined();
  });
  it('town levels are ordered and storage grows', () => {
    for (let i = 1; i < TOWN_LEVELS.length; i++) {
      expect(TOWN_LEVELS[i].threshold).toBeGreaterThan(TOWN_LEVELS[i - 1].threshold);
      expect(TOWN_LEVELS[i].storage).toBeGreaterThan(TOWN_LEVELS[i - 1].storage);
    }
  });
});

describe('items and loot', () => {
  it('higher rarity gives stronger and more valuable gear', () => {
    const r = new Rng(1);
    const common = generateGear('sword', 10, 0, r);
    const epic = generateGear('sword', 10, 3, new Rng(1));
    expect((epic.bonus!.dmgMax ?? 0)).toBeGreaterThan(common.bonus!.dmgMax ?? 0);
    expect(getInfo(epic).value).toBeGreaterThan(getInfo(common).value);
    expect(epic.affixes!.length).toBeGreaterThanOrEqual(3);
    expect(common.affixes!.length).toBe(0);
  });
  it('class restrictions are enforced', () => {
    const staff = generateGear('staff', 1, 0, new Rng(2));
    expect(canEquip(staff, 'fighter', 1).ok).toBe(false);
    expect(canEquip(staff, 'mage', 1).ok).toBe(true);
    const plate = generateGear('plate_chest', 1, 0, new Rng(2));
    expect(canEquip(plate, 'mage', 1).ok).toBe(false);
    expect(canEquip(plate, 'fighter', 1).ok).toBe(true);
    const hi = generateGear('sword', 20, 0, new Rng(3));
    expect(canEquip(hi, 'fighter', 5).ok).toBe(false);
  });
  it('rarity distribution favours common and rarely yields legendary', () => {
    const r = new Rng(42);
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 20000; i++) counts[rollRarity(r, 10)]++;
    expect(counts[0]).toBeGreaterThan(counts[1]);
    expect(counts[1]).toBeGreaterThan(counts[2]);
    expect(counts[2]).toBeGreaterThan(counts[3]);
    expect(counts[3]).toBeGreaterThan(counts[4]);
    expect(counts[4]).toBeGreaterThan(0);
  });
  it('loot is biased toward the player class', () => {
    const r = new Rng(7);
    let usable = 0;
    for (let i = 0; i < 2000; i++) if (classesForBase(GEAR_BASES[randomBaseFor(r, 'mage')]).includes('mage')) usable++;
    expect(usable / 2000).toBeGreaterThan(0.6);
  });
  it('bosses always drop multiple items', () => {
    const res = rollLoot(new Rng(9), 10, { boss: true, classId: 'ranger' });
    expect(res.items.length).toBeGreaterThanOrEqual(3);
    expect(res.gold).toBeGreaterThan(0);
  });
});

describe('progression', () => {
  it('xp falls off with level difference and reaches zero', () => {
    expect(levelDiffMult(5, 5)).toBe(1);
    expect(levelDiffMult(7, 5)).toBeLessThan(1);
    expect(levelDiffMult(10, 5)).toBe(0);
    expect(levelDiffMult(3, 5)).toBeGreaterThan(1);
  });
  it('re-cleared zones give less xp', () => {
    expect(fatigueMult(0)).toBe(1);
    expect(fatigueMult(2)).toBeLessThan(fatigueMult(1));
    expect(xpForKill(10, 5, 5, 3, false)).toBeLessThan(xpForKill(10, 5, 5, 0, false));
  });
  it('levelling grants stat and skill points', () => {
    const s = session();
    s.gainXp(xpToNext(1) + xpToNext(2));
    expect(s.char.level).toBe(3);
    expect(s.char.statPoints).toBe(10);
    expect(s.char.skillPoints).toBe(3);
    expect(s.allocate('str', 5)).toBe(true);
    expect(s.char.baseStats.str).toBe(21);
  });
  it('life skill levels are separate from combat level', () => {
    const s = session();
    s.gainLifeXp('mining', lifeXpForLevel(10));
    expect(s.lifeLevel('mining')).toBe(10);
    expect(s.char.level).toBe(1);
    expect(lifeLevelFromXp(0)).toBe(1);
  });
  it('abilities respect level, prerequisites and weapons', () => {
    const s = session('fighter');
    expect(s.canRankUp('lunge').ok).toBe(false); // level 4 + needs cleave
    expect(s.rankUp('cleave')).toBe(true);
    expect(s.char.actionBar[0]).toBe('cleave');
    expect(s.weaponCheck('cleave')).toBeNull();
    expect(s.weaponCheck('rend')).toMatch(/axe/);
  });
});

describe('inventory and weight', () => {
  it('becomes overburdened past capacity and refuses past the hard cap', () => {
    const s = session();
    const cap = s.capacity();
    expect(s.isOverburdened()).toBe(false);
    while (s.carried() <= cap) s.addItem(makeStack('copper_ore', 1));
    expect(s.isOverburdened()).toBe(true);
    let refused = false;
    for (let i = 0; i < 200 && !refused; i++) refused = !s.addItem(makeStack('copper_ore', 1));
    expect(refused).toBe(true);
  });
  it('stacks merge and consume works', () => {
    const s = session();
    s.addItem(makeStack('oak_log', 3));
    expect(s.count('oak_log')).toBe(5);
    expect(s.consume('oak_log', 4)).toBe(true);
    expect(s.count('oak_log')).toBe(1);
    expect(s.consume('oak_log', 4)).toBe(false);
  });
  it('equipping swaps items and food grants a buff', () => {
    const s = session();
    const sword = generateGear('sword', 1, 2, new Rng(5));
    s.addItem(sword);
    const before = s.derived.dmgMax;
    expect(s.equip(sword.uid)).toBeNull();
    expect(s.char.equipment.mainhand?.uid).toBe(sword.uid);
    expect(s.char.inventory.some((i) => i.id === 'sword')).toBe(true);
    expect(s.derived.dmgMax).not.toBe(before);
    const fish = s.char.inventory.find((i) => i.id === 'grilled_trout')!;
    const con = s.derived.stats.con;
    expect(s.eat(fish.uid)).toBeNull();
    expect(s.derived.stats.con).toBe(con + 2);
  });
});

describe('quests, bounties and town', () => {
  it('kill quests progress and unlock the next zone', () => {
    const s = session();
    s.acceptQuest('guild_1');
    for (let i = 0; i < 6; i++) s.recordKill('wolf', 'greenmeadow');
    expect(s.questStatus('guild_1')).toBe('ready');
    const gold = s.char.gold;
    expect(s.completeQuest('guild_1')).not.toBeNull();
    expect(s.char.gold).toBe(gold + QUEST_MAP.guild_1.rewardGold);
    s.acceptQuest('guild_2');
    s.recordKill('grizzlemaw', 'greenmeadow');
    s.completeQuest('guild_2');
    expect(s.isZoneUnlocked('whisperwood')).toBe(true);
  });
  it('kills in the wrong zone do not count', () => {
    const s = session();
    s.acceptQuest('guild_1');
    s.recordKill('wolf', 'whisperwood');
    expect(s.objectiveCount('guild_1', 0)).toBe(0);
  });
  it('collection quests consume items and never give combat xp', () => {
    const s = session();
    s.acceptQuest('smith_1');
    s.addItem(makeStack('copper_ore', 8));
    const xp = s.char.xp;
    expect(s.completeQuest('smith_1')).not.toBeNull();
    expect(s.count('copper_ore')).toBe(0);
    expect(s.char.xp).toBe(xp);
    expect(s.char.tools.pickaxe).toBe(1);
  });
  it('bounty board offers three bounties and gathering bounties give no combat xp', () => {
    const s = session();
    s.refreshBounties();
    expect(s.bountyOffers().length).toBe(3);
    for (let i = 0; i < 30; i++) {
      s.refreshBounties();
      for (const b of s.bountyOffers()) if (b.objective.kind === 'gather' || b.objective.kind === 'deliver') expect(b.rewardXp).toBe(0);
    }
  });
  it('donations raise the town level and expand storage', () => {
    const s = session();
    s.char.gold = 5000;
    expect(s.storageCapacity()).toBe(20);
    s.donate(1200);
    expect(s.townLevel().level).toBe(2);
    expect(s.storageCapacity()).toBe(45);
    expect(s.derived.buyDiscount).toBeGreaterThan(0);
  });
  it('returning to town respawns zones and counts clears', () => {
    const s = session();
    const zs = s.zoneState('greenmeadow');
    zs.killed.push('a', 'b');
    zs.clearedThisCycle = true;
    s.resetZonesOnTownReturn();
    expect(zs.killed.length).toBe(0);
    expect(zs.timesCleared).toBe(1);
  });
});

describe('crafting', () => {
  it('the smith forges uncommon-or-better gear from ore', () => {
    const s = session();
    const rc = smithRecipes('fighter').find((r) => r.id === 'copper_sword')!;
    expect(smith(s, rc).error).toBeDefined();
    s.addItem(makeStack('copper_ore', 10));
    s.char.gold = 100;
    const res = smith(s, rc);
    expect(res.item).toBeDefined();
    expect(res.item!.rarity).toBeGreaterThanOrEqual(1);
    expect(s.count('copper_ore')).toBe(5);
  });
  it('steel requires a grown town', () => {
    const s = session();
    const rc = smithRecipes('fighter').find((r) => r.tierId === 'steel')!;
    s.addItem(makeStack('iron_ore', 20), true);
    s.addItem(makeStack('coal', 20), true);
    s.addItem(makeStack('maple_log', 5), true);
    s.char.gold = 1000;
    expect(smith(s, rc).error).toMatch(/town/i);
  });
  it('cooking turns raw food into meals and tools upgrade', () => {
    const s = session();
    s.addItem(makeStack('raw_trout', 20), true);
    const rc = RECIPES.find((r) => r.id === 'c_trout')!;
    const before = s.count('grilled_trout');
    for (let i = 0; i < 20; i++) cookOnce(s, rc);
    expect(s.count('raw_trout')).toBe(0);
    expect(s.count('grilled_trout') + s.count('burnt_food')).toBe(before + 20);
    expect(s.char.lifeSkills.cooking.xp).toBeGreaterThan(0);
    s.addItem(makeStack('copper_ore', 10), true);
    s.char.gold = 100;
    expect(upgradeTool(s, 'hatchet')).toBeNull();
    expect(s.char.tools.hatchet).toBe(1);
  });
});

describe('saving', () => {
  it('saves and loads slots independently', () => {
    const a = newSave(0, 'Alpha', 'fighter', APP);
    const b = newSave(1, 'Beta', 'mage', APP);
    a.character.gold = 999;
    writeSlot(a);
    writeSlot(b);
    expect(loadSlot(0)!.character.gold).toBe(999);
    expect(loadSlot(1)!.character.classId).toBe('mage');
    const slots = listSlots();
    expect(slots[0]?.name).toBe('Alpha');
    expect(slots[2]).toBeNull();
    deleteSlot(0);
    expect(loadSlot(0)).toBeNull();
    expect(loadShared().stash).toEqual([]);
  });
});
