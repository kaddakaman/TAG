// NPC dialogue and every town service.

import type { Item } from '../../types';
import { NPC_MAP, TOWN_LEVELS } from '../../data/town';
import type { QuestDef } from '../../data/quests';
import { STACKABLES, TOOL_INFO, TOOL_NAMES, type ToolId } from '../../data/items';
import { burnChance } from '../../data/lifeskills';
import { ZONES, TOWN_ID, zoneName } from '../../data/zones';
import { ENEMIES } from '../../data/enemies';
import { BONUS_LABELS } from '../../data/items';
import { getInfo, isStackable, makeStack } from '../../systems/items';
import { buyPrice, sellPrice, type ShopId } from '../../systems/vendors';
import { canAfford, cookOnce, recipeName, recipesFor, smith, smithRecipes, toolUpgradeCost, upgradeTool } from '../../systems/crafting';
import { sfx } from '../../core/audio';
import { h, bar } from '../dom';
import type { PanelDef, PanelInst } from '../ui';
import { costLine, itemRow, itemSheet, sortItems } from './common';

// ------------------------------------------------------------------ NPC dialogue

function questSheet(p: PanelInst, q: QuestDef): void {
  const s = p.game.session!;
  const status = s.questStatus(q.id);
  const rewards: string[] = [`${q.rewardGold} gold`];
  if (q.rewardXp) rewards.push(`${q.rewardXp} experience`);
  if (q.rewardItem) rewards.push(`${['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'][q.rewardItem.rarity]} item`);
  if (q.rewardItems) rewards.push(...q.rewardItems.map(([id, n]) => `${n}x ${STACKABLES[id].name}`));
  if (q.rewardTool) rewards.push(`Copper ${TOOL_INFO[q.rewardTool].name}`);
  if (q.rewardSkillXp) rewards.push(`${q.rewardSkillXp.xp} ${q.rewardSkillXp.skill} xp`);
  if (q.unlockZone) rewards.push(`Passage to ${zoneName(q.unlockZone)}`);
  const objectives = q.objectives.map((o, i) => {
    const n = status === 'available' ? 0 : s.objectiveCount(q.id, i);
    return h('div', { class: n >= o.count ? 'obj done' : 'obj' }, `${n >= o.count ? '✔' : '•'} ${o.label}: ${n}/${o.count}`);
  });
  const actions: HTMLElement[] = [];
  if (status === 'available') {
    actions.push(h('button', { class: 'primary', onclick: () => { s.acceptQuest(q.id); sfx('quest'); p.ui.closeSheet(p); p.ui.refresh(); } }, 'Accept'));
  } else if (status === 'ready') {
    actions.push(h('button', {
      class: 'primary',
      onclick: () => {
        const r = s.completeQuest(q.id);
        if (r) {
          sfx('quest');
          p.ui.toast(`Quest complete! ${r.join(', ')}`, '#ffd060');
          p.game.save();
        }
        p.ui.closeSheet(p);
        p.ui.refresh();
      },
    }, 'Complete'));
  }
  p.ui.openSheet(p, h('div', { class: 'item-detail quest' },
    h('div', { class: 'tt-title' }, q.title),
    h('p', { class: 'quest-text' }, status === 'ready' ? q.done : q.intro),
    h('div', { class: 'tt-sub' }, 'Objectives'),
    ...objectives,
    h('div', { class: 'tt-sub' }, 'Rewards'),
    h('div', { class: 'tt-lines' }, rewards.join(' · ')),
    h('div', { class: 'sheet-actions' }, ...actions, h('button', { onclick: () => p.ui.closeSheet(p) }, 'Close')),
  ));
}

export const npcPanel: PanelDef = {
  title: (p) => {
    const n = NPC_MAP[p.args.npcId];
    return `${n.name}, ${n.title}`;
  },
  render(body, p) {
    const s = p.game.session!;
    const n = NPC_MAP[p.args.npcId];
    p.state.greet ??= n.greeting[Math.floor(Math.random() * n.greeting.length)];
    body.appendChild(h('p', { class: 'npc-greet' }, `"${p.state.greet}"`));
    const opts = h('div', { class: 'npc-options' });
    for (const q of s.questsFor(n.id)) {
      const st = s.questStatus(q.id);
      const icon = st === 'ready' ? '✔' : st === 'active' ? '…' : '!';
      opts.appendChild(h('button', { class: `opt quest-${st}`, 'data-key': `q-${q.id}`, onclick: () => questSheet(p, q) }, `${icon} ${q.title}${st === 'active' ? ' (in progress)' : st === 'ready' ? ' (complete!)' : ''}`));
    }
    const svc = (label: string, fn: () => void, disabled = false) => opts.appendChild(h('button', { class: 'opt', disabled, onclick: fn }, label));
    for (const sv of n.services) {
      if (sv === 'shop') svc('🛒 Trade', () => p.ui.open('shop', { shop: n.shop as ShopId, npcId: n.id }));
      if (sv === 'forge') svc('⚒ Forge equipment', () => p.ui.open('forge'));
      if (sv === 'tools') svc('⛏ Upgrade tools', () => p.ui.open('forge', { tab: 4 }));
      if (sv === 'cook') svc('🍳 Use the cooking range', () => p.ui.open('cook'));
      if (sv === 'brew') {
        const ok = s.data.quests.completed.includes('herb_1');
        svc(ok ? '⚗ Brew potions' : '⚗ Brew potions (help Maren first)', () => p.ui.open('brew'), !ok);
      }
      if (sv === 'donate') svc('🏛 Donate to Hearthvale', () => p.ui.open('donate'));
      if (sv === 'storage') svc('📦 Open your storage', () => p.ui.open('storage'));
      if (sv === 'stash') svc('✨ Open the Guild Vault (shared)', () => p.ui.open('stash'));
      if (sv === 'bounties') svc('📋 View the bounty board', () => p.ui.open('bounties'));
    }
    if (n.id === 'guildmaster' && !s.questsFor('guildmaster').length) {
      const done = s.data.quests.completed.includes('guild_12');
      opts.appendChild(h('p', { class: 'muted' }, done ? 'You have done everything the Guild could ask. The bounty board still has work for a legend.' : 'Return when you are stronger - and check the bounty board in the meantime.'));
    }
    if (n.id === 'captain') {
      const tl = s.townLevel();
      opts.appendChild(h('p', { class: 'muted' }, `Garrison: ${tl.guards} guard${tl.guards > 1 ? 's' : ''}. Donations to the Steward fund more guards and stronger walls.`));
    }
    svc('Farewell', () => p.ui.close());
    body.appendChild(opts);
  },
};

// ------------------------------------------------------------------ shop

export const shopPanel: PanelDef = {
  title: (p) => `${NPC_MAP[p.args.npcId]?.name ?? 'Shop'} - ${p.game.session!.char.gold}g`,
  tabs: () => ['Buy', 'Sell'],
  wide: true,
  render(body, p) {
    const s = p.game.session!;
    const g = p.game;
    const shop = p.args.shop as ShopId;
    const stock = g.vendorStock[shop] ?? [];
    body.appendChild(h('div', { class: 'muted' }, `Weight ${s.carried().toFixed(1)} / ${s.capacity()} · Prices include your ${Math.round(s.derived.buyDiscount * 100)}% discount`));
    const list = h('div', { class: 'item-list' });
    if (p.tab === 0) {
      for (const it of stock) {
        const price = buyPrice(it, s);
        list.appendChild(itemRow(it, s, {
          right: `${price}g`, dim: s.char.gold < price, key: 'buy' + it.uid,
          onclick: () => {
            const buy = (n: number) => {
              const total = price * n;
              if (s.char.gold < total) return p.ui.toast('Not enough gold.');
              const item = isStackable(it.id) ? makeStack(it.id, n) : it;
              if (!s.addItem(item)) return p.ui.toast("You can't carry that much.");
              s.char.gold -= total;
              if (!isStackable(it.id)) g.vendorStock[shop] = stock.filter((x) => x !== it);
              sfx('coin');
              p.ui.closeSheet(p);
              p.ui.refresh();
            };
            const acts = [{ label: `Buy (${price}g)`, cls: 'primary', fn: () => buy(1), disabled: s.char.gold < price }];
            if (isStackable(it.id)) acts.push({ label: `Buy 5 (${price * 5}g)`, cls: '', fn: () => buy(5), disabled: s.char.gold < price * 5 });
            itemSheet(p, it, acts, !isStackable(it.id) ? s.char.equipment[getInfo(it).slot!] : null);
          },
        }));
      }
    } else {
      const junk = s.char.inventory.filter((i) => getInfo(i).category === 'junk');
      if (junk.length) {
        const total = junk.reduce((n, i) => n + sellPrice(i, s) * i.qty, 0);
        body.appendChild(h('button', {
          class: 'small', onclick: () => {
            for (const j of junk) s.removeItem(j.uid);
            s.char.gold += total;
            sfx('coin');
            p.ui.refresh();
          },
        }, `Sell all trophies & junk (${total}g)`));
      }
      for (const it of sortItems(s.char.inventory)) {
        const price = sellPrice(it, s);
        list.appendChild(itemRow(it, s, {
          right: `${price}g`, key: 'sell' + it.uid,
          onclick: () => {
            const sell = (n: number) => {
              const removed = s.removeItem(it.uid, n);
              if (!removed) return;
              s.char.gold += price * n;
              if (!isStackable(it.id)) (g.vendorStock[shop] ??= []).push(removed);
              sfx('coin');
              p.ui.closeSheet(p);
              p.ui.refresh();
            };
            const acts = [{ label: `Sell (${price}g)`, cls: 'primary', fn: () => sell(1) }];
            if (it.qty > 1) acts.push({ label: `Sell all (${price * it.qty}g)`, cls: '', fn: () => sell(it.qty) });
            itemSheet(p, it, acts);
          },
        }));
      }
    }
    body.appendChild(list);
  },
};

// ------------------------------------------------------------------ forge

export const forgePanel: PanelDef = {
  title: (p) => `Brenna's Forge - ${p.game.session!.char.gold}g`,
  tabs: () => ['Weapons', 'Off-hand', 'Armour', 'Jewellery', 'Tools'],
  wide: true,
  render(body, p) {
    const s = p.game.session!;
    const tl = s.townLevel();
    if (p.tab === 4) {
      body.appendChild(h('p', { class: 'muted' }, 'Better tools gather faster. Upgrades need ore, logs and gold.'));
      for (const t of Object.keys(TOOL_INFO) as ToolId[]) {
        const tier = s.char.tools[t];
        const cost = toolUpgradeCost(t, tier);
        body.appendChild(
          h('div', { class: 'recipe' },
            h('div', { class: 'recipe-name' }, `${TOOL_INFO[t].icon} ${TOOL_NAMES[tier]} ${TOOL_INFO[t].name}`),
            cost ? h('div', null, `Upgrade to ${cost.name}${cost.townLevel > tl.level ? ` (needs town level ${cost.townLevel})` : ''}`) : h('div', null, 'Fully upgraded.'),
            cost ? costLine(s, cost.inputs, cost.gold) : null,
            cost ? h('button', {
              class: 'small primary', 'data-key': `tool-${t}`, disabled: !canAfford(s, cost.inputs, cost.gold) || cost.townLevel > tl.level,
              onclick: () => { const e = upgradeTool(s, t); if (e) p.ui.toast(e); else sfx('craft'); p.ui.refresh(); },
            }, 'Upgrade') : null,
          ),
        );
      }
      return;
    }
    const cat = ['weapon', 'offhand', 'armor', 'jewelry'][p.tab];
    body.appendChild(h('p', { class: 'muted' }, 'Bring ore (and logs) from your adventures. Forged gear is always Uncommon or better, and improves as Hearthvale prospers.'));
    let lastTier = '';
    for (const rc of smithRecipes(s.char.classId)) {
      const base = getInfo({ uid: '', id: rc.baseId, qty: 1 }).base!;
      if (base.category !== cat) continue;
      if (rc.tierId !== lastTier) {
        lastTier = rc.tierId;
        const locked = rc.townLevel > tl.level;
        body.appendChild(h('div', { class: `tier-head ${locked ? 'locked' : ''}` }, `${rc.tierName} - item level ${rc.ilvl}${locked ? ` · requires ${TOWN_LEVELS[rc.townLevel].name}` : ''}`));
      }
      const ok = canAfford(s, rc.inputs, rc.gold) && rc.townLevel <= tl.level;
      body.appendChild(
        h('div', { class: 'recipe' },
          h('div', { class: 'recipe-name' }, `${base.icon} ${rc.label}`),
          costLine(s, rc.inputs, rc.gold),
          h('button', {
            class: 'small primary', 'data-key': rc.id, disabled: !ok,
            onclick: () => {
              const r = smith(s, rc);
              if (r.error) return p.ui.toast(r.error);
              sfx('craft');
              p.game.world?.burst(p.game.world.player.x, p.game.world.player.y, '#ffb040', 12);
              p.ui.refresh();
              if (r.item) itemSheet(p, r.item, [{ label: 'Equip', cls: 'primary', fn: () => { const e = s.equip(r.item!.uid); if (e) p.ui.toast(e); p.ui.closeSheet(p); p.ui.refresh(); } }]);
            },
          }, 'Forge'),
        ),
      );
    }
  },
};

// ------------------------------------------------------------------ cooking & brewing

function craftList(body: HTMLElement, p: PanelInst, station: 'cook' | 'brew'): void {
  const s = p.game.session!;
  const cookLvl = s.lifeLevel('cooking');
  if (station === 'cook') {
    body.appendChild(h('p', { class: 'muted' }, `Cooking level ${cookLvl}. Meals heal and grant a Well Fed bonus for 5 minutes (only one at a time). Higher levels burn less food.`));
  } else body.appendChild(h('p', { class: 'muted' }, 'Maren brews potions from the herbs you gather. Brewing uses your herbs and a small fee.'));
  for (const rc of recipesFor(station)) {
    const out = STACKABLES[rc.output];
    const locked = station === 'cook' && cookLvl < rc.level;
    const can = !locked && canAfford(s, rc.inputs, rc.gold ?? 0);
    const effect = out.food
      ? `Heals ${out.food.heal} · ${Object.entries(out.food.bonus).map(([k, v]) => BONUS_LABELS[k as keyof typeof BONUS_LABELS](v as number)).join(', ')}`
      : out.potion ? `Restores ${out.potion.healPct}% life` : '';
    const burn = station === 'cook' && !locked ? ` · ${Math.round(burnChance(cookLvl, rc.level) * 100)}% burn chance` : '';
    const doCraft = (times: number) => {
      let made = 0;
      let burnt = 0;
      for (let i = 0; i < times; i++) {
        const r = cookOnce(s, rc);
        if (!r.ok) {
          if (i === 0) p.ui.toast(r.error ?? 'Cannot craft');
          break;
        }
        if (r.burnt) burnt++;
        else made++;
      }
      if (made + burnt > 0) {
        sfx('craft');
        p.ui.toast(`${station === 'cook' ? 'Cooked' : 'Brewed'} ${made * rc.qty} ${recipeName(rc)}${burnt ? `, burnt ${burnt}` : ''}.`);
      }
      p.ui.refresh();
    };
    let maxTimes = 0;
    if (can) maxTimes = Math.min(...rc.inputs.map(([id, n]) => Math.floor(s.count(id) / n)), rc.gold ? Math.floor(s.char.gold / rc.gold) : 999);
    body.appendChild(
      h('div', { class: `recipe ${locked ? 'locked' : ''}` },
        h('div', { class: 'recipe-name', style: { color: out.color } }, `${out.icon} ${out.name}${rc.qty > 1 ? ` ×${rc.qty}` : ''}`, locked ? h('span', { class: 'tag' }, `Cooking ${rc.level}`) : null),
        h('div', { class: 'muted small' }, effect + burn),
        costLine(s, rc.inputs, rc.gold ?? 0),
        h('div', { class: 'row' },
          h('button', { class: 'small primary', 'data-key': `c-${rc.id}`, disabled: !can, onclick: () => doCraft(1) }, station === 'cook' ? 'Cook' : 'Brew'),
          h('button', { class: 'small', disabled: maxTimes < 2, onclick: () => doCraft(maxTimes) }, `All (${maxTimes})`),
        ),
      ),
    );
  }
}

export const cookPanel: PanelDef = {
  title: (p) => (p.args.campfire ? 'Campfire Cooking' : 'Cooking Range'),
  render: (body, p) => craftList(body, p, 'cook'),
};

export const brewPanel: PanelDef = {
  title: () => "Maren's Brewing",
  render: (body, p) => craftList(body, p, 'brew'),
};

// ------------------------------------------------------------------ donations

export const donatePanel: PanelDef = {
  title: () => 'Hearthvale Town Hall',
  render(body, p) {
    const s = p.game.session!;
    const cur = s.townLevel();
    const next = s.nextTownLevel();
    body.appendChild(h('div', { class: 'town-head' }, h('h3', null, `${cur.name} (level ${cur.level})`), h('div', null, `Total donated: ${s.data.town.donated}g · Your gold: ${s.char.gold}g`)));
    if (next) {
      body.appendChild(bar(s.data.town.donated - cur.threshold, next.threshold - cur.threshold, '#d9a020', `${s.data.town.donated - cur.threshold} / ${next.threshold - cur.threshold} to ${next.name}`));
      body.appendChild(h('div', { class: 'tt-sub' }, `Next: ${next.name}`));
      body.appendChild(h('ul', { class: 'perks' }, ...next.perks.map((x) => h('li', null, x))));
    } else body.appendChild(h('p', null, 'Hearthvale has become a stronghold. The people sing your name.'));
    body.appendChild(h('div', { class: 'tt-sub' }, 'Current benefits'));
    body.appendChild(h('ul', { class: 'perks current' }, ...cur.perks.map((x) => h('li', null, x))));
    const give = (n: number) => {
      n = Math.min(n, s.char.gold);
      if (n <= 0) return p.ui.toast('You have no gold to give.');
      s.donate(n);
      sfx('coin');
      p.ui.toast(`You donate ${n} gold. The steward thanks you warmly.`, '#ffd060');
      p.game.save();
      p.ui.refresh();
    };
    body.appendChild(
      h('div', { class: 'row wrap' },
        ...[25, 100, 500, 2000].map((n) => h('button', { class: 'small', disabled: s.char.gold < n, onclick: () => give(n) }, `${n}g`)),
        h('button', { class: 'small', disabled: s.char.gold < 10, onclick: () => give(Math.floor(s.char.gold * 0.25)) }, '25%'),
        h('button', { class: 'small primary', disabled: s.char.gold < 1, onclick: () => give(s.char.gold) }, 'All'),
      ),
    );
    body.appendChild(h('p', { class: 'muted' }, 'Donations expand your storage, hire guards to fight off raids, improve vendor stock and prices, and unlock better forging.'));
  },
};

// ------------------------------------------------------------------ storage & shared vault

function storageRender(body: HTMLElement, p: PanelInst, shared: boolean): void {
  const s = p.game.session!;
  const store: Item[] = shared ? s.shared.stash : s.char.storage;
  const cap = shared ? s.stashCapacity() : s.storageCapacity();
  body.appendChild(h('div', { class: 'muted' }, `${shared ? 'Guild Vault - shared by every adventurer in your save slots.' : 'Your personal storage.'} ${store.length} / ${cap} slots · Carrying ${s.carried().toFixed(1)} / ${s.capacity()}`));
  const list = h('div', { class: 'item-list' });
  const persist = () => {
    s.invalidate();
    p.game.save();
    p.ui.refresh();
  };
  if (p.tab === 0) {
    // deposit
    for (const it of sortItems(s.char.inventory)) {
      list.appendChild(itemRow(it, s, {
        key: 'dep' + it.uid,
        onclick: () => {
          const canStack = isStackable(it.id) && store.some((x) => x.id === it.id);
          if (!canStack && store.length >= cap) return p.ui.toast('Storage is full. Donate to the town to expand it.');
          const removed = s.removeItem(it.uid);
          if (removed) s.addTo(store, removed);
          sfx('pickup');
          persist();
        },
        right: 'Store',
      }));
    }
    if (!s.char.inventory.length) list.appendChild(h('div', { class: 'empty-note' }, 'Your bag is empty.'));
  } else {
    for (const it of sortItems(store)) {
      list.appendChild(itemRow(it, s, {
        key: 'wd' + it.uid,
        onclick: () => {
          const removed = s.removeFrom(store, it.uid);
          if (!removed) return;
          if (!s.addItem(removed)) {
            s.addTo(store, removed);
            return p.ui.toast("You can't carry that much.");
          }
          sfx('pickup');
          persist();
        },
        right: 'Take',
      }));
    }
    if (!store.length) list.appendChild(h('div', { class: 'empty-note' }, 'Nothing stored.'));
  }
  body.appendChild(list);
}

export const storagePanel: PanelDef = {
  title: (p) => `Storage (${p.game.session!.char.storage.length}/${p.game.session!.storageCapacity()})`,
  tabs: () => ['Deposit', 'Withdraw'],
  wide: true,
  render: (body, p) => storageRender(body, p, false),
};

export const stashPanel: PanelDef = {
  title: (p) => `Guild Vault (${p.game.session!.shared.stash.length}/${p.game.session!.stashCapacity()})`,
  tabs: () => ['Deposit', 'Withdraw'],
  wide: true,
  render: (body, p) => storageRender(body, p, true),
};

// ------------------------------------------------------------------ bounties

export const bountiesPanel: PanelDef = {
  title: () => 'Bounty Board',
  tabs: (p) => ['Posted', `Active (${p.game.session!.activeBounties().length}/3)`],
  wide: true,
  render(body, p) {
    const s = p.game.session!;
    if (p.tab === 0) {
      body.appendChild(h('p', { class: 'muted' }, 'New bounties are posted every time you return to town. Gathering and cooking bounties pay in gold and life skill experience only.'));
      const offers = s.bountyOffers();
      if (!offers.length) body.appendChild(h('div', { class: 'empty-note' }, 'No new bounties. Check back after your next expedition.'));
      for (const b of offers) {
        body.appendChild(
          h('div', { class: 'bounty' },
            h('div', { class: 'recipe-name' }, b.title),
            h('div', null, b.desc),
            h('div', { class: 'muted small' }, `Posted by ${b.giver} · Reward: ${Math.round(b.rewardGold * (1 + s.derived.bountyBonus))}g${b.rewardXp ? ` + ${b.rewardXp} xp` : ''}${b.rewardSkillXp ? ` + ${b.rewardSkillXp.xp} ${b.rewardSkillXp.skill} xp` : ''}`),
            h('button', {
              class: 'small primary', 'data-key': 'acc' + b.id,
              onclick: () => { const e = s.acceptBounty(b.id); if (e) p.ui.toast(e); else sfx('quest'); p.ui.refresh(); },
            }, 'Accept'),
          ),
        );
      }
    } else {
      const act = s.activeBounties();
      if (!act.length) body.appendChild(h('div', { class: 'empty-note' }, 'No active bounties.'));
      for (const b of act) {
        const ready = s.bountyReady(b);
        const o = b.objective;
        const where = o.zoneId ? ` in ${zoneName(o.zoneId)}` : '';
        const what = o.kind === 'kill' ? `Slay ${ENEMIES[o.enemyId!].plural}${where}` : o.kind === 'elite' ? `Slay ${o.eliteName}${where}` : `Deliver ${STACKABLES[o.itemId!].name}`;
        body.appendChild(
          h('div', { class: `bounty ${ready ? 'ready' : ''}` },
            h('div', { class: 'recipe-name' }, b.title),
            h('div', null, `${what}: ${s.bountyCount(b)}/${o.count}`),
            h('div', { class: 'row' },
              h('button', {
                class: 'small primary', disabled: !ready, 'data-key': 'turn' + b.id,
                onclick: () => {
                  const r = s.completeBounty(b.id);
                  if (r) {
                    sfx('quest');
                    p.ui.toast(`Bounty complete! ${r.join(', ')}`, '#ffd060');
                    p.game.save();
                  }
                  p.ui.refresh();
                },
              }, 'Turn in'),
              h('button', { class: 'small danger', onclick: () => { s.abandonBounty(b.id); p.ui.refresh(); } }, 'Abandon'),
            ),
          ),
        );
      }
    }
  },
};

// ------------------------------------------------------------------ waystone travel

export const travelPanel: PanelDef = {
  title: () => 'Waystone',
  render(body, p) {
    const s = p.game.session!;
    const w = p.game.world!;
    body.appendChild(h('p', { class: 'muted' }, 'Travel instantly between attuned waystones. Touch a waystone in each region to attune it. Returning to Hearthvale makes the wilds repopulate.'));
    const all = [TOWN_ID, ...ZONES.map((z) => z.id)];
    for (const id of all) {
      const attuned = s.data.world.waystones.includes(id);
      const here = w.zoneId === id;
      const z = ZONES.find((x) => x.id === id);
      body.appendChild(
        h('div', { class: 'recipe' },
          h('div', { class: 'recipe-name' }, zoneName(id), z ? h('span', { class: 'tag' }, `Lv ${z.level[0]}-${z.level[1]}`) : null),
          h('div', { class: 'muted small' }, here ? 'You are here.' : attuned ? 'Attuned.' : s.isZoneUnlocked(id) ? 'Not yet attuned - reach its waystone first.' : 'Sealed by the Guild.'),
          h('button', { class: 'small primary', disabled: !attuned || here, 'data-key': 'tr' + id, onclick: () => p.game.travel(id) }, 'Travel'),
        ),
      );
    }
  },
};
