// Shared widgets for panels: item rows, item detail sheets.

import type { Item } from '../../types';
import { GEAR_BASES, RARITY_COLORS, STACKABLES } from '../../data/items';
import { canEquip, getInfo, itemScore, itemTooltip, requiredLevel } from '../../systems/items';
import type { Session } from '../../systems/session';
import { h } from '../dom';
import type { PanelInst } from '../ui';

export function itemColor(item: Item): string {
  const info = getInfo(item);
  return info.stack ? STACKABLES[item.id].color : RARITY_COLORS[info.rarity];
}

export function itemRow(item: Item, s: Session, opts: { onclick: () => void; right?: string | HTMLElement; key?: string; dim?: boolean }): HTMLElement {
  const info = getInfo(item);
  const color = itemColor(item);
  let sub = '';
  if (!info.stack) {
    const base = GEAR_BASES[item.id];
    sub = `${base.weaponType ?? base.offhandType ?? base.armorType ?? base.slot} · ilvl ${item.ilvl}`;
    const ok = canEquip(item, s.char.classId, s.char.level);
    if (!ok.ok) sub += ` · ${ok.reason}`;
    else {
      const cur = s.char.equipment[base.slot];
      if (cur) {
        const diff = itemScore(item) - itemScore(cur);
        if (diff > 0) sub += ` · ▲ upgrade`;
      } else sub += ' · ▲ empty slot';
    }
  } else sub = `${info.category} · ${(info.weight * item.qty).toFixed(1)} wt`;
  return h('button', { class: `item-row ${opts.dim ? 'dim' : ''}`, 'data-key': opts.key ?? item.uid, onclick: opts.onclick },
    h('span', { class: 'item-icon', style: { borderColor: color, color } }, info.icon),
    h('span', { class: 'item-main' },
      h('span', { class: 'item-name', style: { color } }, info.name + (item.qty > 1 ? ` ×${item.qty}` : '')),
      h('span', { class: 'item-sub' }, sub),
    ),
    opts.right ? h('span', { class: 'item-right' }, opts.right) : null,
  );
}

export interface SheetAction {
  label: string;
  fn: () => void;
  cls?: string;
  disabled?: boolean;
}

export function itemSheet(p: PanelInst, item: Item, actions: SheetAction[], compareWith?: Item | null): void {
  const s = p.game.session!;
  const tt = itemTooltip(item);
  const info = getInfo(item);
  const parts: HTMLElement[] = [
    h('div', { class: 'tt-title', style: { color: tt.color } }, tt.title),
    h('div', { class: 'tt-sub' }, tt.sub),
    h('div', { class: 'tt-lines' }, ...tt.lines.map((l) => h('div', null, l))),
    h('div', { class: 'tt-meta' }, `Weight ${(info.weight * item.qty).toFixed(1)} · Value ${info.value * item.qty}g` + (info.stack ? '' : ` · Requires level ${requiredLevel(item)}`)),
  ];
  if (!info.stack) {
    const classes = info.classes ?? [];
    parts.push(h('div', { class: 'tt-meta' }, `Usable by: ${classes.map((c) => c[0].toUpperCase() + c.slice(1)).join(', ')}`));
    if (!classes.includes(s.char.classId)) parts.push(h('div', { class: 'tt-warn' }, 'Your class cannot use this. Store it in the Guild Vault for another adventurer!'));
  }
  if (compareWith) {
    const ct = itemTooltip(compareWith);
    const diff = itemScore(item) - itemScore(compareWith);
    parts.push(
      h('div', { class: 'tt-compare' },
        h('div', { class: 'tt-sub' }, `Currently equipped: `, h('span', { style: { color: ct.color } }, ct.title)),
        h('div', { class: 'tt-lines dim' }, ...ct.lines.map((l) => h('div', null, l))),
        h('div', { class: diff >= 0 ? 'good' : 'bad' }, diff >= 0 ? `▲ Overall better (+${diff})` : `▼ Overall worse (${diff})`),
      ),
    );
  }
  parts.push(
    h('div', { class: 'sheet-actions' },
      ...actions.map((a) => h('button', { class: a.cls ?? '', disabled: a.disabled, onclick: () => a.fn() }, a.label)),
      h('button', { onclick: () => p.ui.closeSheet(p) }, 'Close'),
    ),
  );
  p.ui.openSheet(p, h('div', { class: 'item-detail' }, ...parts));
}

export function confirmSheet(p: PanelInst, title: string, text: string, okLabel: string, fn: () => void): void {
  p.ui.openSheet(p, h('div', { class: 'item-detail' },
    h('div', { class: 'tt-title' }, title),
    h('p', null, text),
    h('div', { class: 'sheet-actions' },
      h('button', { class: 'primary', onclick: () => { p.ui.closeSheet(p); fn(); } }, okLabel),
      h('button', { onclick: () => p.ui.closeSheet(p) }, 'Cancel'),
    ),
  ));
}

export function sortItems(list: Item[]): Item[] {
  const order = ['weapon', 'offhand', 'armor', 'jewelry', 'potion', 'food', 'material', 'junk', 'quest'];
  return [...list].sort((a, b) => {
    const ia = getInfo(a);
    const ib = getInfo(b);
    const c = order.indexOf(ia.category) - order.indexOf(ib.category);
    if (c) return c;
    if (ib.rarity !== ia.rarity) return ib.rarity - ia.rarity;
    return ia.name.localeCompare(ib.name);
  });
}

export function goldText(n: number): string {
  return `${n}g`;
}

export function costLine(s: Session, inputs: [string, number][], gold: number): HTMLElement {
  return h('div', { class: 'cost' },
    ...inputs.map(([id, n]) => {
      const have = s.count(id);
      return h('span', { class: have >= n ? 'ok' : 'missing' }, `${STACKABLES[id].name} ${have}/${n}`);
    }),
    gold ? h('span', { class: s.char.gold >= gold ? 'ok' : 'missing' }, `${gold}g`) : null,
  );
}
