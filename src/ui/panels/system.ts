// Journal, map, pause menu, settings and death screen.

import { QUEST_MAP } from '../../data/quests';
import { ENEMIES } from '../../data/enemies';
import { STACKABLES } from '../../data/items';
import { TOWN_ID, ZONES, zoneName } from '../../data/zones';
import { fatigueMult } from '../../systems/progression';
import { sfx } from '../../core/audio';
import { h } from '../dom';
import type { PanelDef } from '../ui';

export const journalPanel: PanelDef = {
  title: () => 'Journal',
  tabs: () => ['Quests', 'Bounties', 'Regions'],
  wide: true,
  render(body, p) {
    const s = p.game.session!;
    if (p.tab === 0) {
      const active = s.data.quests.active;
      if (!active.length) body.appendChild(h('div', { class: 'empty-note' }, 'No active quests. Visit Guildmaster Aldric at the Adventurer\'s Guild - villagers marked with ! have work for you too.'));
      for (const prog of active) {
        const q = QUEST_MAP[prog.questId];
        const ready = s.questReady(q.id);
        body.appendChild(
          h('div', { class: `bounty ${ready ? 'ready' : ''}` },
            h('div', { class: 'recipe-name' }, q.title, q.story ? h('span', { class: 'tag' }, 'Guild') : null),
            ...q.objectives.map((o, i) => {
              const n = s.objectiveCount(q.id, i);
              return h('div', { class: n >= o.count ? 'obj done' : 'obj' }, `${n >= o.count ? '✔' : '•'} ${o.label}: ${n}/${o.count}`);
            }),
            ready ? h('div', { class: 'good' }, 'Complete! Return to the quest giver.') : null,
          ),
        );
      }
      body.appendChild(h('p', { class: 'muted' }, `Completed quests: ${s.data.quests.completed.length}`));
    } else if (p.tab === 1) {
      const act = s.activeBounties();
      if (!act.length) body.appendChild(h('div', { class: 'empty-note' }, 'No active bounties. Visit Wren at the bounty board in Hearthvale.'));
      for (const b of act) {
        const o = b.objective;
        const what = o.kind === 'kill' ? `Slay ${ENEMIES[o.enemyId!].plural} in ${zoneName(o.zoneId!)}` : o.kind === 'elite' ? `Hunt ${o.eliteName} in ${zoneName(o.zoneId!)}` : `Deliver ${STACKABLES[o.itemId!].name}`;
        body.appendChild(h('div', { class: `bounty ${s.bountyReady(b) ? 'ready' : ''}` }, h('div', { class: 'recipe-name' }, b.title), h('div', null, `${what}: ${s.bountyCount(b)}/${o.count}`)));
      }
    } else {
      const w = p.game.world!;
      body.appendChild(h('p', { class: 'muted' }, 'Enemies return to every region whenever you go back to Hearthvale. Regions you have already cleared give less experience, and enemies far below your level give none.'));
      for (const z of ZONES) {
        const unlocked = s.isZoneUnlocked(z.id);
        const zs = s.data.world.zoneStates[z.id];
        const here = w.zoneId === z.id;
        body.appendChild(
          h('div', { class: `recipe ${unlocked ? '' : 'locked'}` },
            h('div', { class: 'recipe-name' }, `${z.index}. ${z.name}`, h('span', { class: 'tag' }, `Lv ${z.level[0]}-${z.level[1]}`), here ? h('span', { class: 'tag major' }, 'You are here') : null),
            h('div', { class: 'muted small' }, z.subtitle),
            h('div', { class: 'small' },
              unlocked ? 'Open' : 'Sealed by the Guild',
              s.data.world.waystones.includes(z.id) ? ' · Waystone attuned' : '',
              zs?.timesCleared ? ` · Cleared ${zs.timesCleared}x (XP ${Math.round(fatigueMult(zs.timesCleared) * 100)}%)` : '',
              s.data.stats.bossesSlain.includes(z.boss) ? ` · ${ENEMIES[z.boss].name} slain` : '',
            ),
          ),
        );
      }
      body.appendChild(h('p', { class: 'muted' }, `Hearthvale: ${s.townLevel().name}. Current location: ${zoneName(w.zoneId)}.`));
    }
  },
};

export const mapPanel: PanelDef = {
  title: (p) => zoneName(p.game.world!.zoneId),
  wide: true,
  render(body, p) {
    const w = p.game.world!;
    const m = w.map;
    const cv = h('canvas', { class: 'bigmap', width: 360, height: 240 });
    body.appendChild(cv);
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#0d0b09';
    ctx.fillRect(0, 0, cv.width, cv.height);
    // iso diamond projection of the whole map
    const sc = Math.min(cv.width / (m.w + m.h), (cv.height * 2) / (m.w + m.h)) * 0.95;
    const proj = (x: number, y: number) => ({ x: cv.width / 2 + (x - y) * sc, y: 6 + (x + y) * sc * 0.5 });
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) {
        const i = y * m.w + x;
        const t = m.tiles[i];
        let col = m.biome.ground[1];
        if (t === 1 || t === 5) col = m.biome.path;
        else if (t === 2 || t === 3) col = m.biome.water;
        else if (t === 6) col = m.biome.edge;
        else if (t === 4) col = m.biome.sand;
        if (m.solid[i] && t !== 2 && t !== 3 && t !== 6) col = '#2a3a22';
        const a = proj(x, y);
        ctx.fillStyle = col;
        ctx.fillRect(a.x - sc, a.y, sc * 2 + 0.5, sc + 0.5);
      }
    const dot = (x: number, y: number, c: string, r: number, label?: string) => {
      const a = proj(x, y);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (label) {
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#ffe9a0';
        ctx.textAlign = 'center';
        ctx.fillText(label, a.x, a.y - r - 3);
      }
    };
    for (const e of m.exits) dot((e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2, '#ffe080', 4, zoneName(e.to));
    if (m.waystone) dot(m.waystone.x, m.waystone.y, '#7ad8ff', 4, 'Waystone');
    for (const n of w.npcs) dot(n.x, n.y, '#ffd040', 2.5);
    for (const mob of w.mobs) if (!mob.dead && mob.boss) dot(mob.x, mob.y, '#ff3030', 5, 'Boss');
    const sat = w.session.data.world.satchel;
    if (sat && sat.zoneId === w.zoneId) dot(sat.x, sat.y, '#ffe080', 4, 'Lost satchel');
    dot(w.player.x, w.player.y, '#ffffff', 4, 'You');
    body.appendChild(h('p', { class: 'muted' }, w.zoneId === TOWN_ID ? 'Hearthvale - the gate leads north-east to Greenmeadow Fields.' : 'Head for the far exit to reach the next region. The Guild must grant passage first.'));
    body.appendChild(h('button', { onclick: () => p.ui.open('journal', { tab: 2 }) }, 'All regions'));
  },
};

export const menuPanel: PanelDef = {
  title: () => 'Paused',
  render(body, p) {
    const g = p.game;
    const w = g.world!;
    const list = h('div', { class: 'menu-list' },
      h('button', { class: 'primary', onclick: () => p.ui.close() }, 'Resume'),
      h('button', { onclick: () => { const ok = g.save(); p.ui.toast(ok ? 'Game saved.' : 'Save failed!', ok ? '#a0ffa0' : '#ff6060'); sfx('click'); } }, 'Save Game'),
      w.zoneId !== TOWN_ID ? h('button', { onclick: () => { p.ui.closeAll(); w.startRecall(); } }, 'Recall to Hearthvale (4s)') : null,
      h('button', { onclick: () => p.ui.open('map') }, 'Map'),
      h('button', { onclick: () => p.ui.open('settings') }, 'Settings'),
      h('button', { onclick: () => p.ui.open('help') }, 'How to Play'),
      h('button', { class: 'danger', onclick: () => g.quitToTitle() }, 'Save & Quit to Title'),
    );
    body.appendChild(list);
  },
};

export const settingsPanel: PanelDef = {
  title: () => 'Settings',
  render(body, p) {
    const g = p.game;
    const st = g.settings;
    const apply = () => {
      g.saveSettings();
      p.ui.hud.applyDevice();
      p.ui.refresh();
    };
    const toggle = (label: string, value: boolean, fn: () => void) =>
      h('div', { class: 'setting' }, h('span', null, label), h('button', { class: `small ${value ? 'sel' : ''}`, onclick: () => { fn(); apply(); } }, value ? 'On' : 'Off'));
    body.append(
      h('div', { class: 'setting' },
        h('span', null, 'Touch controls'),
        h('div', { class: 'row' }, ...(['auto', 'on', 'off'] as const).map((m) => h('button', { class: `small ${st.touchControls === m ? 'sel' : ''}`, onclick: () => { st.touchControls = m; apply(); } }, m[0].toUpperCase() + m.slice(1)))),
      ),
      toggle('Button labels', st.showLabels, () => (st.showLabels = !st.showLabels)),
      toggle('Sound effects', st.sound, () => (st.sound = !st.sound)),
      toggle('Screen shake', st.screenShake, () => (st.screenShake = !st.screenShake)),
      h('div', { class: 'setting' },
        h('span', null, 'Camera zoom'),
        h('div', { class: 'row' }, ...[0.8, 1, 1.25].map((z) => h('button', { class: `small ${g.renderer.userZoom === z ? 'sel' : ''}`, onclick: () => { g.renderer.userZoom = z; g.renderer.resize(); p.ui.refresh(); } }, z === 1 ? 'Normal' : z < 1 ? 'Far' : 'Near'))),
      ),
      h('div', { class: 'setting fullscreen-only' }, h('span', null, 'Fullscreen'), h('button', { class: 'small', onclick: () => { if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {}); else void document.exitFullscreen?.(); } }, 'Toggle')),
      h('p', { class: 'muted' }, `Input detected: ${g.input.device}. Plug in or press a button on a gamepad to switch to gamepad controls.`),
    );
  },
};

export const helpPanel: PanelDef = {
  title: () => 'How to Play',
  wide: true,
  render(body) {
    const tips = [
      ['The Guild', "Take contracts from Guildmaster Aldric. Completing a region's boss contract opens the road to the next, harder region."],
      ['Bounties', 'Wren posts fresh bounties every time you return to town: hunts, wanted elites, and supply requests for ore, logs, fish, herbs or meals.'],
      ['Respawning wilds', 'Returning to Hearthvale (on foot, by waystone, recall or death) brings every enemy back. Cleared regions give less experience; enemies far below your level give none.'],
      ['Death', 'When you fall, half your gold is left in a satchel where you died. Make it back alive to recover it - die again first and it is gone.'],
      ['Weight', 'Everything you carry has weight. Over your limit you are Overburdened and can only walk. Strength and some gear raise your limit.'],
      ['Life skills', 'Mine ore, chop trees, fish and forage. Light a campfire with logs (from your bag) to cook meals that heal and grant stat buffs. Life skills never give combat experience.'],
      ['Crafting', 'Brenna the blacksmith forges gear and upgrades tools from your ore and logs. Old Maren brews potions from herbs.'],
      ['Town', 'Donate gold to the Steward to grow Hearthvale: more storage, more guards against raids, better shops and forging.'],
      ['Guild Vault', 'The vault is shared by all your save slots. Found a staff on your fighter? Vault it for your mage.'],
      ['Gear', 'Common, Uncommon, Rare, Epic and Legendary gear grows stronger and more valuable. Each class can only use its own weapons and armour.'],
    ];
    for (const [t, d] of tips) body.appendChild(h('div', { class: 'tip' }, h('b', null, t), h('div', null, d)));
  },
};

export const deathPanel: PanelDef = {
  title: () => 'You Have Fallen',
  noClose: true,
  render(body, p) {
    const s = p.game.session!;
    const sat = s.data.world.satchel;
    body.append(
      h('p', { class: 'death-text' }, 'Darkness takes you... but the Guild does not let its own rest so easily.'),
      sat ? h('p', null, `You dropped a satchel with ${sat.gold} gold in ${zoneName(sat.zoneId)}. Return to recover it - if you die again first, it is lost.`) : h('p', null, 'You carried no gold.'),
      h('button', { class: 'big primary', onclick: () => { p.ui.closeAll(); p.game.respawn(); } }, 'Rise in Hearthvale'),
    );
  },
};
