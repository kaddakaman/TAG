// Inventory, character sheet and ability panels.

import type { EquipSlot, Item, StatId } from '../../types';
import { EQUIP_SLOTS, LIFE_SKILL_IDS, STAT_IDS } from '../../types';
import { STAT_INFO } from '../../data/classes';
import { ABILITY_MAP, TREES, abilitiesFor } from '../../data/abilities';
import { GEAR_BASES, STACKABLES, TOOL_INFO, TOOL_NAMES, type ToolId } from '../../data/items';
import { LIFE_SKILLS, LIFE_MAX_LEVEL, lifeXpForLevel } from '../../data/lifeskills';
import { canEquip, getInfo, itemWeight } from '../../systems/items';
import { sfx } from '../../core/audio';
import { h, bar } from '../dom';
import type { PanelDef, PanelInst } from '../ui';
import { confirmSheet, itemRow, itemSheet, sortItems } from './common';

const SLOT_NAMES: Record<EquipSlot, string> = {
  mainhand: 'Main Hand', offhand: 'Off Hand', head: 'Head', chest: 'Chest', hands: 'Hands', legs: 'Legs', feet: 'Feet', amulet: 'Amulet', ring: 'Ring',
};

function weightBar(p: PanelInst): HTMLElement {
  const s = p.game.session!;
  const cur = s.carried();
  const cap = s.capacity();
  const over = cur > cap;
  return h('div', { class: 'weight' },
    bar(cur, cap * 1.5, over ? '#d05a3a' : '#7ab04a', `Weight ${cur.toFixed(1)} / ${cap}${over ? ' - OVERBURDENED (walking)' : ''}`),
    h('div', { class: 'weight-mark', style: { left: `${(1 / 1.5) * 100}%` } }),
    h('div', { class: 'gold-line' }, `Gold: ${s.char.gold}`),
  );
}

export function itemActions(p: PanelInst, item: Item): void {
  const s = p.game.session!;
  const w = p.game.world!;
  const info = getInfo(item);
  const def = STACKABLES[item.id];
  const acts: { label: string; fn: () => void; cls?: string; disabled?: boolean }[] = [];
  const done = () => {
    p.ui.closeSheet(p);
    p.ui.refresh();
  };
  if (!info.stack) {
    const ok = canEquip(item, s.char.classId, s.char.level);
    acts.push({
      label: ok.ok ? 'Equip' : ok.reason ?? 'Cannot equip', cls: 'primary', disabled: !ok.ok,
      fn: () => {
        const err = s.equip(item.uid);
        if (err) p.ui.toast(err);
        else sfx('pickup');
        done();
      },
    });
  }
  if (def?.food) acts.push({ label: 'Eat', cls: 'primary', fn: () => { const e = s.eat(item.uid); if (e) p.ui.toast(e); else sfx('potion'); done(); } });
  if (def?.potion) acts.push({ label: 'Drink', cls: 'primary', fn: () => { const e = s.drinkPotion(); if (e) p.ui.toast(e); else sfx('potion'); done(); } });
  if (def?.source?.skill === 'woodcutting') {
    acts.push({
      label: 'Light Campfire', cls: 'primary', disabled: w.map.isTown,
      fn: () => {
        const e = w.lightCampfire(item.uid);
        if (e) p.ui.toast(e);
        else p.ui.closeAll();
      },
    });
  }
  acts.push({
    label: item.qty > 1 ? 'Drop 1' : 'Drop', cls: 'danger',
    fn: () => {
      const doDrop = () => {
        const it = s.removeItem(item.uid, item.qty > 1 ? 1 : undefined);
        if (it) w.dropPickup(w.player.x, w.player.y, it, 0);
        done();
      };
      if (!info.stack && (item.rarity ?? 0) >= 2) confirmSheet(p, 'Drop item?', `Drop ${info.name} on the ground?`, 'Drop', doDrop);
      else doDrop();
    },
  });
  if (item.qty > 1) {
    acts.push({
      label: 'Drop All', cls: 'danger',
      fn: () => {
        const it = s.removeItem(item.uid);
        if (it) w.dropPickup(w.player.x, w.player.y, it, 0);
        done();
      },
    });
  }
  const cmp = !info.stack ? s.char.equipment[GEAR_BASES[item.id].slot] : null;
  itemSheet(p, item, acts, cmp && cmp.uid !== item.uid ? cmp : null);
}

export const inventoryPanel: PanelDef = {
  title: () => 'Inventory',
  tabs: () => ['Bag', 'Equipped', 'Tools'],
  wide: true,
  render(body, p) {
    const s = p.game.session!;
    body.appendChild(weightBar(p));
    if (p.tab === 0) {
      const filters = ['All', 'Gear', 'Supplies', 'Materials', 'Trophies'];
      const f = p.state.filter ?? 0;
      body.appendChild(
        h('div', { class: 'chips' }, ...filters.map((n, i) => h('button', { class: `chip ${i === f ? 'sel' : ''}`, onclick: () => { p.state.filter = i; p.ui.render(p); } }, n))),
      );
      const items = sortItems(s.char.inventory).filter((it) => {
        const c = getInfo(it).category;
        if (f === 1) return ['weapon', 'offhand', 'armor', 'jewelry'].includes(c);
        if (f === 2) return c === 'food' || c === 'potion';
        if (f === 3) return c === 'material';
        if (f === 4) return c === 'junk' || c === 'quest';
        return true;
      });
      if (!items.length) body.appendChild(h('div', { class: 'empty-note' }, 'Nothing here.'));
      const list = h('div', { class: 'item-list' });
      for (const it of items) list.appendChild(itemRow(it, s, { onclick: () => itemActions(p, it), right: `${itemWeight(it).toFixed(1)}` }));
      body.appendChild(list);
    } else if (p.tab === 1) {
      const list = h('div', { class: 'item-list' });
      for (const slot of EQUIP_SLOTS) {
        const it = s.char.equipment[slot];
        if (it) {
          list.appendChild(
            h('div', { class: 'equip-row' }, h('div', { class: 'slot-label' }, SLOT_NAMES[slot]),
              itemRow(it, s, {
                key: 'eq-' + slot,
                onclick: () => itemSheet(p, it, [{ label: 'Unequip', fn: () => { s.unequip(slot); p.ui.closeSheet(p); p.ui.refresh(); } }]),
              }),
            ),
          );
        } else {
          list.appendChild(h('div', { class: 'equip-row' }, h('div', { class: 'slot-label' }, SLOT_NAMES[slot]), h('div', { class: 'item-row empty' }, 'Empty')));
        }
      }
      body.appendChild(list);
      body.appendChild(h('p', { class: 'muted' }, 'Equipped items count for half their weight.'));
    } else {
      const list = h('div', { class: 'item-list' });
      for (const t of Object.keys(TOOL_INFO) as ToolId[]) {
        const tier = s.char.tools[t];
        list.appendChild(
          h('div', { class: 'tool-row' },
            h('span', { class: 'item-icon' }, TOOL_INFO[t].icon),
            h('span', { class: 'item-main' },
              h('span', { class: 'item-name' }, `${TOOL_NAMES[tier]} ${TOOL_INFO[t].name}`),
              h('span', { class: 'item-sub' }, `${LIFE_SKILLS[TOOL_INFO[t].skill].name} speed ×${s.toolSpeed(t).toFixed(2)} · upgrade at the blacksmith`),
            ),
          ),
        );
      }
      body.appendChild(list);
      body.appendChild(h('p', { class: 'muted' }, 'Tools live on your belt and weigh nothing.'));
    }
  },
};

export const characterPanel: PanelDef = {
  title: (p) => p.game.session!.char.name,
  tabs: () => ['Attributes', 'Life Skills', 'Record'],
  wide: true,
  render(body, p) {
    const s = p.game.session!;
    const c = s.char;
    const d = s.derived;
    if (p.tab === 0) {
      body.appendChild(
        h('div', { class: 'char-head' },
          h('div', null, `Level ${c.level} ${s.cls.name}`),
          bar(c.xp, s.xpNeeded(), '#a070e0', `XP ${c.xp} / ${s.xpNeeded()}`),
          h('div', { class: c.statPoints ? 'points hi' : 'points' }, `Unspent stat points: ${c.statPoints}`),
        ),
      );
      const grid = h('div', { class: 'stat-grid' });
      for (const st of STAT_IDS as StatId[]) {
        const bonus = d.stats[st] - c.baseStats[st];
        grid.appendChild(
          h('div', { class: `stat-row ${s.cls.primaryStats.includes(st) ? 'primary' : ''}` },
            h('div', { class: 'stat-name' }, STAT_INFO[st].name, s.cls.primaryStats.includes(st) ? h('span', { class: 'tag' }, 'key') : null),
            h('div', { class: 'stat-val' }, String(d.stats[st]), bonus ? h('span', { class: 'bonus' }, ` (+${bonus})`) : null),
            h('div', { class: 'stat-desc' }, STAT_INFO[st].desc),
            h('div', { class: 'stat-btns' },
              h('button', { class: 'small', disabled: c.statPoints < 1, 'data-key': `st-${st}`, onclick: () => { s.allocate(st); sfx('click'); p.ui.refresh(); } }, '+1'),
              h('button', { class: 'small', disabled: c.statPoints < 5, 'data-key': `st5-${st}`, onclick: () => { s.allocate(st, 5); sfx('click'); p.ui.refresh(); } }, '+5'),
            ),
          ),
        );
      }
      body.appendChild(grid);
      const dl = (k: string, v: string) => h('div', { class: 'dstat' }, h('span', null, k), h('b', null, v));
      body.appendChild(
        h('div', { class: 'derived' },
          dl('Life', `${d.maxHp}`),
          dl(s.cls.resourceName, `${d.maxRes}`),
          dl('Weapon damage', `${d.dmgMin}-${d.dmgMax}`),
          dl('Attacks / sec', d.attacksPerSec.toFixed(2)),
          dl('Critical chance', `${d.critChance.toFixed(1)}%`),
          dl('Critical damage', `+${Math.round(d.critDmg + 50)}%`),
          dl('Armour', `${d.armor}`),
          dl('Resistances', `${Math.round(d.resist)}%`),
          dl('Dodge', `${d.dodge.toFixed(1)}%`),
          dl('Block', `${d.block}%`),
          dl('Life regen', `${d.regen.toFixed(1)}/s`),
          dl(`${s.cls.resourceName} regen`, `${d.resRegen.toFixed(1)}/s`),
          dl('Cooldown reduction', `${Math.round(d.cdr * 100)}%`),
          dl('Carry capacity', `${d.carry}`),
          dl('Move speed', `${Math.round(d.moveSpeed * 100)}%`),
          dl('Gold find', `+${d.goldFind}%`),
          dl('Magic find', `+${d.magicFind}%`),
          dl('Vendor discount', `${Math.round(d.buyDiscount * 100)}%`),
        ),
      );
      if (c.foodBuff) body.appendChild(h('p', { class: 'muted' }, `Well Fed: ${c.foodBuff.name} (${Math.ceil(c.foodBuff.remaining / 60)} min left)`));
    } else if (p.tab === 1) {
      body.appendChild(h('p', { class: 'muted' }, 'Life skills improve with use. They never grant combat experience, but they feed your adventure: ore for the forge, logs for campfires, fish and herbs for buffing meals and potions.'));
      for (const id of LIFE_SKILL_IDS) {
        const info = LIFE_SKILLS[id];
        const lvl = s.lifeLevel(id);
        const xp = c.lifeSkills[id].xp;
        const lo = lifeXpForLevel(lvl);
        const hi = lifeXpForLevel(lvl + 1);
        const tool = info.tool ? `${TOOL_NAMES[c.tools[info.tool]]} ${TOOL_INFO[info.tool].name}` : 'Campfire or the inn range';
        body.appendChild(
          h('div', { class: 'life-row' },
            h('div', { class: 'life-head' }, h('span', { class: 'ico' }, info.icon), h('b', null, info.name), h('span', { class: 'lvl' }, `Level ${lvl}${lvl >= LIFE_MAX_LEVEL ? ' (max)' : ''}`)),
            bar(xp - lo, hi - lo, '#4a9ad0', lvl >= LIFE_MAX_LEVEL ? 'Mastered' : `${xp - lo} / ${hi - lo}`),
            h('div', { class: 'muted' }, `${info.desc} Tool: ${tool}.`),
          ),
        );
      }
    } else {
      const st = s.data.stats;
      body.append(
        h('div', { class: 'derived' },
          h('div', { class: 'dstat' }, h('span', null, 'Enemies slain'), h('b', null, String(st.kills))),
          h('div', { class: 'dstat' }, h('span', null, 'Deaths'), h('b', null, String(st.deaths))),
          h('div', { class: 'dstat' }, h('span', null, 'Bosses slain'), h('b', null, String(st.bossesSlain.length))),
          h('div', { class: 'dstat' }, h('span', null, 'Quests completed'), h('b', null, String(s.data.quests.completed.length))),
          h('div', { class: 'dstat' }, h('span', null, 'Donated to Hearthvale'), h('b', null, `${s.data.town.donated}g`)),
        ),
      );
    }
  },
};

export const skillsPanel: PanelDef = {
  title: (p) => `Abilities - ${p.game.session!.char.skillPoints} point${p.game.session!.char.skillPoints === 1 ? '' : 's'}`,
  tabs: (p) => TREES[p.game.session!.char.classId].map((t) => t.name),
  wide: true,
  render(body, p) {
    const s = p.game.session!;
    const c = s.char;
    const tree = TREES[c.classId][p.tab];
    // action bar
    body.appendChild(
      h('div', { class: 'actionbar' },
        h('span', { class: 'muted' }, 'Action bar:'),
        ...c.actionBar.map((id, i) =>
          h('button', {
            class: 'bar-slot', 'data-key': `bar${i}`, title: id ? ABILITY_MAP[id].name : 'Empty',
            onclick: () => { c.actionBar[i] = null; p.ui.refresh(); },
          }, h('span', { class: 'n' }, String(i + 1)), id ? ABILITY_MAP[id].icon : '·'),
        ),
        h('span', { class: 'muted small' }, '(tap a slot to clear it)'),
      ),
    );
    body.appendChild(h('p', { class: 'muted' }, tree.desc));
    const list = h('div', { class: 'ability-list' });
    for (const a of abilitiesFor(c.classId).filter((x) => x.tree === tree.id)) {
      const rank = s.rank(a.id);
      const can = s.canRankUp(a.id);
      const reqs: string[] = [`Level ${a.reqLevel}`];
      if (a.prereq) reqs.push(`${ABILITY_MAP[a.prereq.id].name} ${a.prereq.rank}`);
      if (a.weapons) reqs.push(a.weapons.join('/'));
      if (a.offhand) reqs.push(a.offhand);
      const wc = s.weaponCheck(a.id);
      list.appendChild(
        h('div', { class: `ability ${a.major ? 'major' : ''} ${rank ? 'learned' : ''}` },
          h('div', { class: 'ab-icon' }, a.icon),
          h('div', { class: 'ab-main' },
            h('div', { class: 'ab-name' }, a.name, a.major ? h('span', { class: 'tag major' }, 'MAJOR') : null, h('span', { class: 'tag' }, a.kind === 'passive' ? 'passive' : `${s.cls.resourceName} ${a.cost?.(Math.max(1, rank)) ?? 0} · ${a.cooldown?.(Math.max(1, rank)).toFixed(1) ?? 0}s`)),
            h('div', { class: 'pips' }, ...Array.from({ length: a.maxRank }, (_, i) => h('span', { class: i < rank ? 'pip on' : 'pip' }))),
            h('div', { class: 'ab-desc' }, a.desc(Math.max(1, rank))),
            rank > 0 && rank < a.maxRank ? h('div', { class: 'ab-next' }, `Next rank: ${a.desc(rank + 1)}`) : null,
            h('div', { class: 'ab-req' }, `Requires: ${reqs.join(', ')}`, rank > 0 && wc ? h('span', { class: 'bad' }, ` - ${wc} equipped`) : null),
            h('div', { class: 'row wrap' },
              h('button', { class: 'small primary', 'data-key': `learn-${a.id}`, disabled: !can.ok, onclick: () => { if (s.rankUp(a.id)) sfx('buff'); p.ui.refresh(); } }, rank ? (can.ok ? 'Rank up' : can.reason ?? 'Rank up') : can.ok ? 'Learn' : can.reason ?? 'Learn'),
              ...(a.kind === 'active' && rank > 0
                ? [0, 1, 2, 3].map((i) =>
                    h('button', {
                      class: `small ${c.actionBar[i] === a.id ? 'sel' : ''}`, 'data-key': `slot-${a.id}-${i}`,
                      onclick: () => { const prev = c.actionBar.indexOf(a.id); if (prev >= 0) c.actionBar[prev] = null; c.actionBar[i] = a.id; p.ui.refresh(); },
                    }, `Slot ${i + 1}`),
                  )
                : []),
            ),
          ),
        ),
      );
    }
    body.appendChild(list);
  },
};
