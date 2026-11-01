import { describe, expect, it } from 'vitest';
import { generateZone, generateTown } from '../src/world/gen';
import { floodReachable } from '../src/world/map';
import { ZONES } from '../src/data/zones';
import { NPCS } from '../src/data/town';
import { NODES } from '../src/data/lifeskills';
import { Session } from '../src/systems/session';
import { newSave } from '../src/systems/save';
import { World, type WorldHooks } from '../src/world/world';

const APP = { gender: 'female' as const, skin: '#d9a57c', hair: '#1d1612', hairStyle: 0, primary: '#8b1e1e', secondary: '#2b2b30', tertiary: '#d9a020' };

function makeWorld(cls: 'fighter' | 'mage' | 'ranger' = 'fighter') {
  const s = new Session(newSave(0, 'Sim', cls, APP), { version: 1, stash: [], bestProsperity: 0 });
  const events: string[] = [];
  const hooks: WorldHooks = {
    openNpc: (id) => events.push('npc:' + id),
    openStation: (k) => events.push('station:' + k),
    openCampfire: () => events.push('campfire'),
    exitZone: (e) => events.push('exit:' + e.to),
    playerDied: () => events.push('died'),
    recallComplete: () => events.push('recall'),
    sfx: () => {},
  };
  return { s, w: new World(s, hooks), events };
}

describe('zone generation', () => {
  it('is deterministic and everything is reachable from the entry', () => {
    for (const def of ZONES) {
      const a = generateZone(def);
      const b = generateZone(def);
      expect(a.spawns.map((x) => x.id)).toEqual(b.spawns.map((x) => x.id));
      const reach = floodReachable(a, a.entry.x, a.entry.y);
      const boss = a.spawns.find((x) => x.boss);
      expect(boss, def.id).toBeDefined();
      expect(reach[Math.floor(boss!.y) * a.w + Math.floor(boss!.x)], def.id).toBe(1);
      for (const e of a.exits) {
        const ex = Math.floor((e.x0 + e.x1) / 2);
        const ey = e.y0;
        expect(reach[ey * a.w + ex], `${def.id} exit ${e.to}`).toBe(1);
      }
      expect(a.spawns.length).toBeGreaterThan(25);
      expect(a.nodes.filter((n) => n.nodeId.includes('tree')).length).toBeGreaterThan(4);
      expect(a.nodes.some((n) => n.variant === 'fish')).toBe(true);
      expect(a.waystone).not.toBeNull();
    }
  });
  it('enemies get tougher deeper into a zone', () => {
    const z = generateZone(ZONES[2]);
    const near = z.spawns.filter((s) => !s.boss && s.y > z.h * 0.7);
    const far = z.spawns.filter((s) => !s.boss && s.y < z.h * 0.35);
    const avg = (l: typeof near) => l.reduce((n, s) => n + s.level, 0) / l.length;
    expect(avg(far)).toBeGreaterThan(avg(near));
  });
  it('every town NPC stands somewhere walkable and reachable', () => {
    const t = generateTown(0);
    const reach = floodReachable(t, t.entry.x, t.entry.y);
    for (const n of NPCS) expect(reach[Math.floor(n.y) * t.w + Math.floor(n.x)], n.id).toBe(1);
  });
});

describe('world simulation', () => {
  it('the player can fight and kill enemies, gaining xp and quest progress', () => {
    const { s, w } = makeWorld('fighter');
    s.acceptQuest('guild_1');
    w.load('greenmeadow', 'entry');
    const wolf = w.mobs.find((m) => m.def.id === 'wolf')!;
    w.player.x = wolf.x + 1;
    w.player.y = wolf.y;
    w.unstick(w.player);
    let t = 0;
    while (t < 30 && !wolf.dead) {
      s.char.hp = s.derived.maxHp;
      w.intent.attack = true;
      w.update(1 / 30);
      t += 1 / 30;
    }
    expect(wolf.dead).toBe(true);
    expect(s.char.xp).toBeGreaterThan(0);
    expect(s.data.stats.kills).toBeGreaterThan(0);
    expect(s.objectiveCount('guild_1', 0)).toBeGreaterThanOrEqual(1);
    expect(s.zoneState('greenmeadow').killed).toContain(wolf.spawnId);
  });
  it('dying drops half your gold as a recoverable satchel', () => {
    const { s, w, events } = makeWorld('mage');
    s.char.gold = 200;
    w.load('greenmeadow', 'entry');
    w.damagePlayer(99999, 'fire', null);
    expect(events).toContain('died');
    expect(s.char.gold).toBe(100);
    expect(s.data.world.satchel?.gold).toBe(100);
    w.load('greenmeadow', 'entry');
    expect(w.pickups.some((p) => p.satchel)).toBe(true);
  });
  it('gathering yields materials and life xp but no combat xp', () => {
    const { s, w } = makeWorld('ranger');
    w.load('town', 'entry');
    const node = w.map.nodes.find((n) => n.nodeId === 'copper_vein')!;
    w.player.x = node.x - 1;
    w.player.y = node.y;
    w.unstick(w.player);
    w.update(0.016);
    w.startGather(node, NODES.copper_vein);
    for (let i = 0; i < 300; i++) w.update(1 / 30);
    expect(s.count('copper_ore')).toBeGreaterThan(0);
    expect(s.char.lifeSkills.mining.xp).toBeGreaterThan(0);
    expect(s.char.xp).toBe(0);
  });
  it('walking into a sealed exit is refused, an open one triggers travel', () => {
    const { w, events } = makeWorld();
    w.load('greenmeadow', 'entry');
    const ex = w.map.exits.find((e) => e.to === 'whisperwood')!;
    w.exitLock = 0;
    w.player.x = (ex.x0 + ex.x1) / 2;
    w.player.y = ex.y0 + 0.5;
    w.update(0.016);
    expect(events.some((e) => e === 'exit:whisperwood')).toBe(false);
    const back = w.map.exits.find((e) => e.to === 'town')!;
    w.exitLock = 0;
    w.player.x = (back.x0 + back.x1) / 2;
    w.player.y = back.y0 + 0.5;
    w.update(0.016);
    expect(events).toContain('exit:town');
  });
  it('town raids spawn hostiles that guards will fight', () => {
    const { s, w } = makeWorld();
    s.data.town.donated = 3000;
    s.invalidate();
    w.load('town', 'entry');
    const guards = w.mobs.filter((m) => m.team === 0).length;
    expect(guards).toBe(s.townLevel().guards);
    w.startRaid();
    expect(w.raid).not.toBeNull();
    expect(w.mobs.filter((m) => m.team === 1).length).toBeGreaterThan(0);
    for (let i = 0; i < 600; i++) {
      s.char.hp = s.derived.maxHp;
      w.update(1 / 30);
    }
    // the guards repel the raid: every raider is slain and the town is rewarded
    expect(w.raid).toBeNull();
    expect(s.data.stats.kills).toBeGreaterThan(0);
    expect(s.data.town.donated).toBeGreaterThan(3000);
  });
});
