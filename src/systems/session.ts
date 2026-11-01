// The Session wraps one loaded save slot and provides every persistent
// operation on the character: inventory, equipment, experience, skills,
// quests, bounties and the town.

import type { Bonus, Bounty, EquipSlot, Item, LifeSkillId, QuestProgress, SaveData, SharedData, StatId, ZoneState } from '../types';
import { CLASSES, MAX_LEVEL, STAT_POINTS_PER_LEVEL, xpToNext } from '../data/classes';
import { ABILITY_MAP } from '../data/abilities';
import { STACKABLES, GEAR_BASES, TOOL_INFO, type ToolId } from '../data/items';
import { LIFE_MAX_LEVEL, lifeLevelFromXp } from '../data/lifeskills';
import { QUESTS, QUEST_MAP, type QuestDef } from '../data/quests';
import { TOWN_LEVELS, townLevelFor, type TownLevel } from '../data/town';
import { ENEMIES } from '../data/enemies';
import { TOWN_ID, ZONES } from '../data/zones';
import { bus } from '../core/events';
import { Rng, rng } from '../core/rng';
import { canEquip, generateGear, getInfo, isStackable, itemWeight, makeStack } from './items';
import { computeDerived, type Derived } from './stats';
import { randomBaseFor } from './loot';
import { writeShared, writeSlot } from './save';
import { generateBounty } from './bounties';

export const OVERBURDEN_HARD_CAP = 1.5;
export const STASH_BASE = 24;

export class Session {
  data: SaveData;
  shared: SharedData;
  /** temporary combat buffs (War Cry etc) keyed by id */
  buffs = new Map<string, { bonus: Bonus; remaining: number; name: string }>();
  private cache: Derived | null = null;

  constructor(data: SaveData, shared: SharedData) {
    this.data = data;
    this.shared = shared;
    const d = this.derived;
    this.char.hp = Math.min(this.char.hp, d.maxHp);
    this.char.resource = Math.min(this.char.resource, d.maxRes);
  }

  get char() {
    return this.data.character;
  }
  get cls() {
    return CLASSES[this.char.classId];
  }

  get derived(): Derived {
    if (!this.cache) {
      const buffs = [...this.buffs.values()].map((b) => b.bonus);
      this.cache = computeDerived(this.char, buffs, this.townLevel().discount);
    }
    return this.cache;
  }

  invalidate(): void {
    this.cache = null;
    const d = this.derived;
    if (this.char.hp > d.maxHp) this.char.hp = d.maxHp;
    if (this.char.resource > d.maxRes) this.char.resource = d.maxRes;
    bus.emit('ui', {});
  }

  save(): boolean {
    this.shared.bestProsperity = Math.max(this.shared.bestProsperity, this.townLevel().level);
    writeShared(this.shared);
    return writeSlot(this.data);
  }

  // ------------------------------------------------------------------ weight

  carried(): number {
    let w = 0;
    for (const it of this.char.inventory) w += itemWeight(it);
    for (const it of Object.values(this.char.equipment)) if (it) w += itemWeight(it) * 0.5;
    return Math.round(w * 10) / 10;
  }

  capacity(): number {
    return this.derived.carry;
  }

  isOverburdened(): boolean {
    return this.carried() > this.capacity();
  }

  canCarry(extra: number): boolean {
    return this.carried() + extra <= this.capacity() * OVERBURDEN_HARD_CAP;
  }

  // ------------------------------------------------------------------ inventory

  /** Adds an item to the bag. Returns false if it is too heavy to carry. */
  addItem(item: Item, force = false): boolean {
    if (!force && !this.canCarry(itemWeight(item))) return false;
    this.addTo(this.char.inventory, item);
    bus.emit('itemGained', { itemId: item.id, qty: item.qty });
    this.invalidate();
    return true;
  }

  addTo(list: Item[], item: Item): void {
    if (isStackable(item.id)) {
      const ex = list.find((i) => i.id === item.id);
      if (ex) {
        ex.qty += item.qty;
        return;
      }
    }
    list.push(item);
  }

  removeFrom(list: Item[], uid: string, qty?: number): Item | null {
    const idx = list.findIndex((i) => i.uid === uid);
    if (idx < 0) return null;
    const it = list[idx];
    if (qty !== undefined && qty < it.qty) {
      it.qty -= qty;
      return { ...it, uid: it.uid + 'x' + Math.floor(Math.random() * 1e6), qty };
    }
    list.splice(idx, 1);
    return it;
  }

  removeItem(uid: string, qty?: number): Item | null {
    const it = this.removeFrom(this.char.inventory, uid, qty);
    if (it) this.invalidate();
    return it;
  }

  count(id: string): number {
    let n = 0;
    for (const it of this.char.inventory) if (it.id === id) n += it.qty;
    return n;
  }

  consume(id: string, qty: number): boolean {
    if (this.count(id) < qty) return false;
    let left = qty;
    for (const it of [...this.char.inventory]) {
      if (it.id !== id || left <= 0) continue;
      const take = Math.min(left, it.qty);
      this.removeFrom(this.char.inventory, it.uid, take);
      left -= take;
    }
    this.invalidate();
    return true;
  }

  // ------------------------------------------------------------------ equipment

  equip(uid: string): string | null {
    const item = this.char.inventory.find((i) => i.uid === uid);
    if (!item) return 'Item not found';
    const check = canEquip(item, this.char.classId, this.char.level);
    if (!check.ok) return check.reason ?? 'Cannot equip';
    const base = GEAR_BASES[item.id];
    const slot = base.slot;
    this.removeFrom(this.char.inventory, uid);
    const prev = this.char.equipment[slot];
    if (prev) this.char.inventory.push(prev);
    this.char.equipment[slot] = item;
    // two-handed staves cannot be used with an offhand
    if (slot === 'mainhand' && base.twoHanded && this.char.equipment.offhand) {
      this.char.inventory.push(this.char.equipment.offhand);
      delete this.char.equipment.offhand;
    }
    if (slot === 'offhand') {
      const main = this.char.equipment.mainhand;
      if (main && GEAR_BASES[main.id]?.twoHanded) {
        this.char.inventory.push(main);
        delete this.char.equipment.mainhand;
      }
    }
    this.invalidate();
    return null;
  }

  unequip(slot: EquipSlot): boolean {
    const it = this.char.equipment[slot];
    if (!it) return false;
    delete this.char.equipment[slot];
    this.char.inventory.push(it);
    this.invalidate();
    return true;
  }

  // ------------------------------------------------------------------ experience

  xpNeeded(): number {
    return xpToNext(this.char.level);
  }

  /** Combat experience. Life skills never call this. */
  gainXp(amount: number): number {
    const c = this.char;
    if (c.level >= MAX_LEVEL || amount <= 0) return 0;
    c.xp += Math.round(amount);
    let gained = 0;
    while (c.level < MAX_LEVEL && c.xp >= xpToNext(c.level)) {
      c.xp -= xpToNext(c.level);
      c.level++;
      c.statPoints += STAT_POINTS_PER_LEVEL;
      c.skillPoints += 1;
      gained++;
      bus.emit('levelUp', { level: c.level });
    }
    if (c.level >= MAX_LEVEL) c.xp = 0;
    if (gained) {
      this.invalidate();
      c.hp = this.derived.maxHp;
      c.resource = this.derived.maxRes;
    }
    return gained;
  }

  lifeLevel(skill: LifeSkillId): number {
    return lifeLevelFromXp(this.char.lifeSkills[skill].xp);
  }

  gainLifeXp(skill: LifeSkillId, xp: number): void {
    const before = this.lifeLevel(skill);
    this.char.lifeSkills[skill].xp += Math.round(xp);
    const after = this.lifeLevel(skill);
    if (after > before && after <= LIFE_MAX_LEVEL) bus.emit('lifeLevelUp', { skill, level: after });
  }

  allocate(stat: StatId, n = 1): boolean {
    if (this.char.statPoints < n) return false;
    this.char.statPoints -= n;
    this.char.baseStats[stat] += n;
    this.invalidate();
    return true;
  }

  // ------------------------------------------------------------------ abilities

  rank(id: string): number {
    return this.char.abilityRanks[id] ?? 0;
  }

  canRankUp(id: string): { ok: boolean; reason?: string } {
    const def = ABILITY_MAP[id];
    if (!def || def.classId !== this.char.classId) return { ok: false, reason: 'Unknown ability' };
    const r = this.rank(id);
    if (r >= def.maxRank) return { ok: false, reason: 'Maximum rank' };
    if (this.char.skillPoints <= 0) return { ok: false, reason: 'No skill points' };
    const lvlReq = def.reqLevel + r * (def.major ? 3 : 2);
    if (this.char.level < lvlReq) return { ok: false, reason: `Requires level ${lvlReq}` };
    if (def.prereq && this.rank(def.prereq.id) < def.prereq.rank) {
      return { ok: false, reason: `Requires ${ABILITY_MAP[def.prereq.id].name} rank ${def.prereq.rank}` };
    }
    return { ok: true };
  }

  rankUp(id: string): boolean {
    if (!this.canRankUp(id).ok) return false;
    const def = ABILITY_MAP[id];
    const wasZero = this.rank(id) === 0;
    this.char.abilityRanks[id] = this.rank(id) + 1;
    this.char.skillPoints--;
    if (wasZero && def.kind === 'active') {
      const empty = this.char.actionBar.indexOf(null);
      if (empty >= 0) this.char.actionBar[empty] = id;
    }
    this.invalidate();
    return true;
  }

  /** Returns a reason string if the ability can't be used with current gear. */
  weaponCheck(id: string): string | null {
    const def = ABILITY_MAP[id];
    if (!def) return 'Unknown';
    const d = this.derived;
    if (def.weapons && (!d.weapon || !def.weapons.includes(d.weapon))) return `Requires ${def.weapons.join(' or ')}`;
    if (def.offhand && d.offhand !== def.offhand) return `Requires ${def.offhand}`;
    return null;
  }

  // ------------------------------------------------------------------ food & potions

  eat(uid: string): string | null {
    const it = this.char.inventory.find((i) => i.uid === uid);
    if (!it) return 'Nothing to eat';
    const def = STACKABLES[it.id];
    if (!def?.food) return 'Not edible';
    this.removeFrom(this.char.inventory, uid, 1);
    this.char.foodBuff = { itemId: def.id, name: def.name, bonus: def.food.bonus, remaining: def.food.duration };
    this.invalidate();
    this.char.hp = Math.min(this.derived.maxHp, this.char.hp + def.food.heal);
    return null;
  }

  bestPotion(): Item | null {
    const order = ['greater_potion', 'healing_potion', 'minor_potion'];
    const hpPct = this.char.hp / this.derived.maxHp;
    // use the smallest potion that is still useful when only lightly hurt
    const pref = hpPct > 0.6 ? [...order].reverse() : order;
    for (const id of pref) {
      const it = this.char.inventory.find((i) => i.id === id);
      if (it) return it;
    }
    return null;
  }

  drinkPotion(): string | null {
    if (this.char.potionCooldown > 0) return 'Potion not ready';
    const it = this.bestPotion();
    if (!it) return 'No potions';
    const def = STACKABLES[it.id].potion!;
    this.removeFrom(this.char.inventory, it.uid, 1);
    const d = this.derived;
    this.char.hp = Math.min(d.maxHp, this.char.hp + (d.maxHp * def.healPct) / 100);
    if (def.resourcePct) this.char.resource = Math.min(d.maxRes, this.char.resource + (d.maxRes * def.resourcePct) / 100);
    this.char.potionCooldown = 8;
    this.invalidate();
    return null;
  }

  // ------------------------------------------------------------------ tools

  toolSpeed(tool: ToolId): number {
    return 1 + this.char.tools[tool] * 0.25;
  }

  upgradeTool(tool: ToolId, tier: number): void {
    if (this.char.tools[tool] < tier) this.char.tools[tool] = tier;
    bus.emit('toast', { text: `${TOOL_INFO[tool].name} upgraded!`, color: '#ffd060' });
  }

  // ------------------------------------------------------------------ town

  townLevel(): TownLevel {
    return townLevelFor(this.data.town.donated);
  }

  nextTownLevel(): TownLevel | undefined {
    return TOWN_LEVELS[this.townLevel().level + 1];
  }

  donate(amount: number): boolean {
    amount = Math.floor(amount);
    if (amount <= 0 || this.char.gold < amount) return false;
    const before = this.townLevel().level;
    this.char.gold -= amount;
    this.data.town.donated += amount;
    const after = this.townLevel();
    if (after.level > before) {
      bus.emit('toast', { text: `Hearthvale is now a ${after.name}!`, color: '#ffd060' });
    }
    this.invalidate();
    return true;
  }

  storageCapacity(): number {
    return this.townLevel().storage;
  }

  stashCapacity(): number {
    return STASH_BASE + 6 * Math.max(this.shared.bestProsperity, this.townLevel().level);
  }

  // ------------------------------------------------------------------ zones

  zoneState(zoneId: string): ZoneState {
    let s = this.data.world.zoneStates[zoneId];
    if (!s) s = this.data.world.zoneStates[zoneId] = { killed: [], depleted: {}, timesCleared: 0, clearedThisCycle: false };
    return s;
  }

  /** Called whenever the player returns to town: every area's enemies respawn. */
  resetZonesOnTownReturn(): void {
    for (const [id, s] of Object.entries(this.data.world.zoneStates)) {
      if (id === TOWN_ID) continue;
      if (s.clearedThisCycle) s.timesCleared++;
      s.clearedThisCycle = false;
      s.killed = [];
      s.depleted = {};
    }
  }

  isZoneUnlocked(zoneId: string): boolean {
    return zoneId === TOWN_ID || this.data.world.unlockedZones.includes(zoneId);
  }

  // ------------------------------------------------------------------ quests

  questProgress(id: string): QuestProgress | undefined {
    return this.data.quests.active.find((q) => q.questId === id);
  }

  questStatus(id: string): 'locked' | 'available' | 'active' | 'ready' | 'done' {
    if (this.data.quests.completed.includes(id)) return 'done';
    const prog = this.questProgress(id);
    if (prog) return this.questReady(id) ? 'ready' : 'active';
    const q = QUEST_MAP[id];
    if (q.requires && !this.data.quests.completed.includes(q.requires)) return 'locked';
    if (q.minLevel && this.char.level < q.minLevel) return 'locked';
    return 'available';
  }

  questsFor(npcId: string): QuestDef[] {
    return QUESTS.filter((q) => q.giver === npcId && this.questStatus(q.id) !== 'locked' && this.questStatus(q.id) !== 'done');
  }

  acceptQuest(id: string): boolean {
    if (this.questStatus(id) !== 'available') return false;
    const q = QUEST_MAP[id];
    this.data.quests.active.push({ questId: id, counts: q.objectives.map(() => 0), done: false });
    bus.emit('questUpdate', {});
    bus.emit('toast', { text: `Quest accepted: ${q.title}`, color: '#ffd060' });
    return true;
  }

  questReady(id: string): boolean {
    const q = QUEST_MAP[id];
    const prog = this.questProgress(id);
    if (!q || !prog) return false;
    return q.objectives.every((o, i) => {
      if (o.kind === 'collect') return this.count(o.item) >= o.count;
      return prog.counts[i] >= o.count;
    });
  }

  objectiveCount(id: string, idx: number): number {
    const q = QUEST_MAP[id];
    const o = q.objectives[idx];
    if (o.kind === 'collect') return Math.min(o.count, this.count(o.item));
    return Math.min(o.count, this.questProgress(id)?.counts[idx] ?? 0);
  }

  completeQuest(id: string): string[] | null {
    if (!this.questReady(id)) return null;
    const q = QUEST_MAP[id];
    for (const o of q.objectives) if (o.kind === 'collect') this.consume(o.item, o.count);
    this.data.quests.active = this.data.quests.active.filter((p) => p.questId !== id);
    this.data.quests.completed.push(id);
    const rewards: string[] = [];
    this.char.gold += q.rewardGold;
    rewards.push(`${q.rewardGold} gold`);
    if (q.rewardXp) {
      this.gainXp(q.rewardXp);
      rewards.push(`${q.rewardXp} experience`);
    }
    if (q.rewardItem) {
      const r = new Rng(rng.next() * 1e9);
      const item = generateGear(randomBaseFor(r, this.char.classId, 0.95), q.rewardItem.ilvl, q.rewardItem.rarity, r);
      this.addItem(item, true);
      rewards.push(getInfo(item).name);
    }
    for (const [itemId, n] of q.rewardItems ?? []) {
      this.addItem(makeStack(itemId, n), true);
      rewards.push(`${n}x ${STACKABLES[itemId].name}`);
    }
    if (q.rewardTool) {
      this.upgradeTool(q.rewardTool, Math.max(1, this.char.tools[q.rewardTool]));
      rewards.push(`Copper ${TOOL_INFO[q.rewardTool].name}`);
    }
    if (q.rewardSkillXp) {
      this.gainLifeXp(q.rewardSkillXp.skill, q.rewardSkillXp.xp);
      rewards.push(`${q.rewardSkillXp.xp} ${q.rewardSkillXp.skill} xp`);
    }
    if (q.unlockZone && !this.data.world.unlockedZones.includes(q.unlockZone)) {
      this.data.world.unlockedZones.push(q.unlockZone);
      rewards.push(`Passage to ${ZONES.find((z) => z.id === q.unlockZone)?.name}`);
    }
    bus.emit('questUpdate', {});
    this.invalidate();
    return rewards;
  }

  /** Record a kill for quests and bounties. */
  recordKill(enemyId: string, zoneId: string, opts: { bountyId?: string } = {}): void {
    const def = ENEMIES[enemyId];
    if (!def) return;
    let changed = false;
    for (const prog of this.data.quests.active) {
      const q = QUEST_MAP[prog.questId];
      q.objectives.forEach((o, i) => {
        if (o.kind === 'collect') return;
        if (o.zone && o.zone !== zoneId) return;
        if (o.kind === 'boss' && o.enemy !== enemyId) return;
        if (o.kind === 'kill') {
          if (o.enemy && o.enemy !== enemyId) return;
          if (o.faction && o.faction !== def.faction) return;
        }
        if (prog.counts[i] < o.count) {
          prog.counts[i]++;
          changed = true;
        }
      });
    }
    for (const b of this.data.quests.bounties) {
      if (!b.accepted || b.progress >= b.objective.count) continue;
      const o = b.objective;
      if (o.kind === 'kill' && o.enemyId === enemyId && (!o.zoneId || o.zoneId === zoneId)) {
        b.progress++;
        changed = true;
      } else if (o.kind === 'elite' && opts.bountyId === b.id) {
        b.progress = 1;
        changed = true;
      }
      if (changed && b.progress >= o.count) bus.emit('toast', { text: `Bounty complete: ${b.title}. Return to Wren.`, color: '#ffd060' });
    }
    if (changed) bus.emit('questUpdate', {});
  }

  // ------------------------------------------------------------------ bounties

  bountyOffers(): Bounty[] {
    return this.data.quests.bounties.filter((b) => !b.accepted);
  }

  activeBounties(): Bounty[] {
    return this.data.quests.bounties.filter((b) => b.accepted);
  }

  /** Replaces every unaccepted bounty with fresh postings. */
  refreshBounties(): void {
    const q = this.data.quests;
    q.bounties = q.bounties.filter((b) => b.accepted);
    const r = new Rng(rng.next() * 1e9);
    let guard = 0;
    while (this.bountyOffers().length < 3 && guard++ < 20) {
      q.bountyCounter++;
      const b = generateBounty(r, this, 'b' + q.bountyCounter);
      if (b) q.bounties.push(b);
    }
  }

  acceptBounty(id: string): string | null {
    const b = this.data.quests.bounties.find((x) => x.id === id);
    if (!b || b.accepted) return 'Not available';
    if (this.activeBounties().length >= 3) return 'You can only hold 3 bounties at once';
    b.accepted = true;
    bus.emit('questUpdate', {});
    return null;
  }

  abandonBounty(id: string): void {
    this.data.quests.bounties = this.data.quests.bounties.filter((b) => b.id !== id);
    bus.emit('questUpdate', {});
  }

  bountyCount(b: Bounty): number {
    const o = b.objective;
    if (o.kind === 'gather' || o.kind === 'deliver') return Math.min(o.count, this.count(o.itemId!));
    return Math.min(o.count, b.progress);
  }

  bountyReady(b: Bounty): boolean {
    return b.accepted && this.bountyCount(b) >= b.objective.count;
  }

  completeBounty(id: string): string[] | null {
    const b = this.data.quests.bounties.find((x) => x.id === id);
    if (!b || !this.bountyReady(b)) return null;
    if (b.objective.kind === 'gather' || b.objective.kind === 'deliver') this.consume(b.objective.itemId!, b.objective.count);
    this.data.quests.bounties = this.data.quests.bounties.filter((x) => x.id !== id);
    const gold = Math.round(b.rewardGold * (1 + this.derived.bountyBonus));
    this.char.gold += gold;
    const out = [`${gold} gold`];
    if (b.rewardXp) {
      this.gainXp(b.rewardXp);
      out.push(`${b.rewardXp} experience`);
    }
    if (b.rewardSkillXp) {
      this.gainLifeXp(b.rewardSkillXp.skill, b.rewardSkillXp.xp);
      out.push(`${b.rewardSkillXp.xp} ${b.rewardSkillXp.skill} xp`);
    }
    bus.emit('questUpdate', {});
    this.invalidate();
    return out;
  }

  /** The bounty whose elite target should spawn in this zone, if any. */
  eliteBountyFor(zoneId: string): Bounty | undefined {
    return this.data.quests.bounties.find((b) => b.accepted && b.objective.kind === 'elite' && b.objective.zoneId === zoneId && b.progress < 1);
  }
}
