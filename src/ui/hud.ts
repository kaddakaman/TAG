// In-game HUD: unit frame, minimap, menu buttons and the touch action cluster.

import { ABILITY_MAP } from '../data/abilities';
import { STACKABLES } from '../data/items';
import { TOWN_ID, ZONE_MAP, zoneName } from '../data/zones';
import { GAMEPAD_GLYPHS, KEY_GLYPHS } from '../input/input';
import { bindHold, TouchJoystick } from '../input/touch';
import { T_DARK, T_DEEP, T_PATH, T_PLAZA, T_SAND, T_WATER, type ZoneMap } from '../world/map';
import { abilityReady } from '../world/abilities';
import { fmt } from '../core/math';
import { h, clear } from './dom';
import type { UI } from './ui';

function setText(el: HTMLElement, v: string): void {
  if (el.textContent !== v) el.textContent = v;
}

export class Hud {
  private built = false;
  private el!: HTMLElement;
  private hpFill!: HTMLElement;
  private hpText!: HTMLElement;
  private resFill!: HTMLElement;
  private resText!: HTMLElement;
  private xpFill!: HTMLElement;
  private nameEl!: HTMLElement;
  private lvlEl!: HTMLElement;
  private goldEl!: HTMLElement;
  private zoneEl!: HTMLElement;
  private buffsEl!: HTMLElement;
  private burdenEl!: HTMLElement;
  private bossEl!: HTMLElement;
  private bossFill!: HTMLElement;
  private bossName!: HTMLElement;
  private raidEl!: HTMLElement;
  private interactBtn!: HTMLButtonElement;
  private interactLabel!: HTMLElement;
  private abilityBtns: HTMLButtonElement[] = [];
  private potionBtn!: HTMLButtonElement;
  private attackBtn!: HTMLButtonElement;
  private skillDot!: HTMLElement;
  private charDot!: HTMLElement;
  private minimap!: HTMLCanvasElement;
  private miniCache: { id: string; canvas: HTMLCanvasElement } | null = null;
  private touchZone!: HTMLElement;
  private joystick: TouchJoystick | null = null;
  private cluster!: HTMLElement;
  private buffKey = '';
  private miniTimer = 0;

  constructor(private ui: UI, private layer: HTMLElement) {}

  build(): void {
    if (this.built) {
      this.applyDevice();
      return;
    }
    this.built = true;
    const ui = this.ui;
    const game = ui.game;
    this.hpFill = h('div', { class: 'bar-fill hp' });
    this.hpText = h('span', { class: 'bar-label' });
    this.resFill = h('div', { class: 'bar-fill' });
    this.resText = h('span', { class: 'bar-label' });
    this.xpFill = h('div', { class: 'bar-fill xp' });
    this.nameEl = h('span', { class: 'uf-name' });
    this.lvlEl = h('span', { class: 'uf-lvl' });
    this.buffsEl = h('div', { class: 'buffs' });
    this.burdenEl = h('div', { class: 'burden hidden' }, 'Overburdened - walking');
    const unit = h(
      'div', { class: 'unit-frame' },
      h('div', { class: 'uf-head' }, this.nameEl, this.lvlEl),
      h('div', { class: 'bar big' }, this.hpFill, this.hpText),
      h('div', { class: 'bar' }, this.resFill, this.resText),
      h('div', { class: 'bar thin' }, this.xpFill),
      this.buffsEl,
      this.burdenEl,
    );
    this.goldEl = h('span', { class: 'gold' });
    this.zoneEl = h('div', { class: 'zone-name' });
    this.minimap = h('canvas', { class: 'minimap', width: 120, height: 120, onclick: () => ui.open('map') });
    this.skillDot = h('span', { class: 'dot hidden' });
    this.charDot = h('span', { class: 'dot hidden' });
    const mb = (label: string, icon: string, panel: string, dot?: HTMLElement) =>
      h('button', { class: 'hud-btn', title: label, 'aria-label': label, onclick: () => ui.toggleMenu(panel as any) }, h('span', { class: 'ico' }, icon), h('span', { class: 'lbl' }, label), dot ?? null);
    const right = h(
      'div', { class: 'hud-right' },
      h('div', { class: 'hud-info' }, this.zoneEl, this.goldEl),
      this.minimap,
      h('div', { class: 'hud-menu' },
        mb('Bag', '🎒', 'inventory'),
        mb('Hero', '🛡', 'character', this.charDot),
        mb('Skills', '✦', 'skills', this.skillDot),
        mb('Journal', '📜', 'journal'),
        mb('Menu', '☰', 'menu'),
      ),
    );
    this.bossName = h('div', { class: 'boss-name' });
    this.bossFill = h('div', { class: 'bar-fill boss' });
    this.bossEl = h('div', { class: 'boss-bar hidden' }, this.bossName, h('div', { class: 'bar' }, this.bossFill));
    this.raidEl = h('div', { class: 'raid hidden' });

    // touch / action cluster
    this.touchZone = h('div', { class: 'touch-zone' });
    this.joystick = new TouchJoystick(this.touchZone, game.input);
    this.attackBtn = h('button', { class: 'act attack', 'aria-label': 'Attack' }, h('span', { class: 'ico' }, '⚔'), h('span', { class: 'key' }));
    bindHold(this.attackBtn, () => (game.input.touchAttack = true), () => (game.input.touchAttack = false), game.input);
    this.abilityBtns = [0, 1, 2, 3].map((i) => {
      const b = h('button', { class: `act abil a${i}`, 'aria-label': `Ability ${i + 1}` }, h('span', { class: 'ico' }), h('span', { class: 'cd' }), h('span', { class: 'key' }));
      bindHold(
        b,
        () => {
          const id = game.session?.char.actionBar[i];
          if (!id) ui.open('skills');
          else game.input.abilityQueue.push(i);
        },
        () => {},
        game.input,
      );
      return b;
    });
    this.potionBtn = h('button', { class: 'act potion', 'aria-label': 'Drink potion' }, h('span', { class: 'ico' }, '⚗'), h('span', { class: 'count' }), h('span', { class: 'cd' }), h('span', { class: 'key' }));
    bindHold(this.potionBtn, () => (game.input.potion = true), () => {}, game.input);
    this.interactLabel = h('span', { class: 'ilabel' });
    this.interactBtn = h('button', { class: 'act interact hidden', 'aria-label': 'Interact' }, h('span', { class: 'key' }), this.interactLabel);
    bindHold(this.interactBtn, () => (game.input.interact = true), () => {}, game.input);
    this.cluster = h('div', { class: 'action-cluster' }, this.attackBtn, ...this.abilityBtns, this.potionBtn);

    this.el = h('div', { class: 'hud' }, this.touchZone, unit, right, this.bossEl, this.raidEl, this.interactBtn, this.cluster);
    this.layer.appendChild(this.el);
    this.applyDevice();
  }

  applyDevice(): void {
    if (!this.built) return;
    const game = this.ui.game;
    const mode = game.settings.touchControls;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const touch = mode === 'on' || (mode === 'auto' && (game.input.device === 'touch' || (coarse && game.input.device !== 'gamepad')));
    this.el.classList.toggle('touch', touch);
    this.el.classList.toggle('pad', game.input.device === 'gamepad');
    this.el.classList.toggle('labels', game.settings.showLabels);
    if (this.joystick) {
      this.joystick.enabled = touch;
      this.joystick.reset();
    }
    const glyph = game.input.device === 'gamepad' ? GAMEPAD_GLYPHS : KEY_GLYPHS;
    const setKey = (b: HTMLElement, k: string) => setText(b.querySelector('.key') as HTMLElement, touch ? '' : k);
    setKey(this.attackBtn, glyph.attack);
    this.abilityBtns.forEach((b, i) => setKey(b, glyph.ability[i]));
    setKey(this.potionBtn, glyph.potion);
    setKey(this.interactBtn, glyph.interact);
  }

  update(dt: number): void {
    const game = this.ui.game;
    const s = game.session;
    const w = game.world;
    if (!s || !w || !this.built) return;
    const c = s.char;
    const d = s.derived;
    this.hpFill.style.width = `${Math.max(0, (c.hp / d.maxHp) * 100)}%`;
    setText(this.hpText, `${Math.ceil(Math.max(0, c.hp))} / ${d.maxHp}`);
    this.resFill.style.width = `${(c.resource / d.maxRes) * 100}%`;
    this.resFill.style.background = s.cls.resourceColor;
    setText(this.resText, `${Math.floor(c.resource)} / ${d.maxRes} ${s.cls.resourceName}`);
    this.xpFill.style.width = `${(c.xp / s.xpNeeded()) * 100}%`;
    setText(this.nameEl, c.name);
    setText(this.lvlEl, `Lv ${c.level} ${s.cls.name}`);
    setText(this.goldEl, `${fmt(c.gold)} g`);
    const zname = w.zoneId === TOWN_ID ? zoneName(TOWN_ID) : `${zoneName(w.zoneId)} (${ZONE_MAP[w.zoneId].level[0]}-${ZONE_MAP[w.zoneId].level[1]})`;
    setText(this.zoneEl, zname);
    this.skillDot.classList.toggle('hidden', c.skillPoints <= 0);
    this.charDot.classList.toggle('hidden', c.statPoints <= 0);
    this.burdenEl.classList.toggle('hidden', !s.isOverburdened());

    // buffs
    const buffs: string[] = [];
    if (c.foodBuff) buffs.push(`🍖 ${c.foodBuff.name} ${Math.ceil(c.foodBuff.remaining / 60)}m`);
    for (const b of s.buffs.values()) buffs.push(`✦ ${b.name} ${Math.ceil(b.remaining)}s`);
    if (w.player.manaShield) buffs.push(`🔷 Shield ${Math.ceil(w.player.manaShield.remaining)}s`);
    const key = buffs.join('|');
    if (key !== this.buffKey) {
      this.buffKey = key;
      clear(this.buffsEl);
      for (const b of buffs) this.buffsEl.appendChild(h('span', { class: 'buff' }, b));
    }

    // boss
    const boss = w.boss;
    this.bossEl.classList.toggle('hidden', !boss);
    if (boss) {
      setText(this.bossName, boss.name + (boss.enraged ? ' (Enraged)' : ''));
      this.bossFill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    }
    this.raidEl.classList.toggle('hidden', !w.raid);
    if (w.raid) setText(this.raidEl, `Town under attack! Raiders remaining: ${w.raid.remaining}/${w.raid.total}`);

    // abilities
    this.abilityBtns.forEach((b, i) => {
      const id = c.actionBar[i];
      const ico = b.querySelector('.ico') as HTMLElement;
      const cd = b.querySelector('.cd') as HTMLElement;
      if (!id) {
        setText(ico, '+');
        b.classList.add('empty');
        cd.style.background = '';
        b.classList.remove('unusable');
        return;
      }
      b.classList.remove('empty');
      const def = ABILITY_MAP[id];
      setText(ico, def.icon);
      const rem = w.player.cooldowns[id] ?? 0;
      const tot = w.player.cdTotals[id] ?? 1;
      cd.style.background = rem > 0 ? `conic-gradient(rgba(0,0,0,0.65) ${(rem / tot) * 360}deg, transparent 0deg)` : '';
      const ready = abilityReady(w, id);
      b.classList.toggle('unusable', !ready.ok && ready.reason !== 'Not ready');
    });
    const pots = ['minor_potion', 'healing_potion', 'greater_potion'].reduce((n, id) => n + s.count(id), 0);
    setText(this.potionBtn.querySelector('.count') as HTMLElement, String(pots));
    const pcd = this.potionBtn.querySelector('.cd') as HTMLElement;
    pcd.style.background = c.potionCooldown > 0 ? `conic-gradient(rgba(0,0,0,0.65) ${(c.potionCooldown / 8) * 360}deg, transparent 0deg)` : '';
    this.potionBtn.classList.toggle('unusable', pots === 0);

    // interact
    const it = w.player.dead ? null : w.interaction;
    this.interactBtn.classList.toggle('hidden', !it);
    if (it) setText(this.interactLabel, it.label);

    this.miniTimer -= dt;
    if (this.miniTimer <= 0) {
      this.miniTimer = 0.1;
      this.drawMinimap();
    }
    void STACKABLES;
  }

  private miniBase(m: ZoneMap): HTMLCanvasElement {
    if (this.miniCache?.id === m.id + m.w) return this.miniCache.canvas;
    const cv = document.createElement('canvas');
    cv.width = m.w;
    cv.height = m.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(m.w, m.h);
    const hex = (c: string): [number, number, number] => {
      const n = parseInt(c.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const g = hex(m.biome.ground[1]);
    const path = hex(m.biome.path);
    const water = hex(m.biome.water);
    const edge = hex(m.biome.edge);
    const sand = hex(m.biome.sand);
    for (let i = 0; i < m.w * m.h; i++) {
      const t = m.tiles[i];
      let c = g;
      if (t === T_PATH || t === T_PLAZA) c = path;
      else if (t === T_WATER || t === T_DEEP) c = water;
      else if (t === T_DARK) c = edge;
      else if (t === T_SAND) c = sand;
      if (m.solid[i] && t !== T_WATER && t !== T_DEEP && t !== T_DARK) c = [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6];
      img.data[i * 4] = c[0];
      img.data[i * 4 + 1] = c[1];
      img.data[i * 4 + 2] = c[2];
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.miniCache = { id: m.id + m.w, canvas: cv };
    return cv;
  }

  private drawMinimap(): void {
    const w = this.ui.game.world;
    if (!w) return;
    const cv = this.minimap;
    const ctx = cv.getContext('2d')!;
    const W = cv.width;
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, W);
    const scale = 2.6;
    const p = w.player;
    // iso orientation: rotate 45deg and squash
    ctx.translate(W / 2, W / 2);
    ctx.scale(1, 0.6);
    ctx.rotate(Math.PI / 4);
    ctx.scale(scale, scale);
    ctx.translate(-p.x, -p.y);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.miniBase(w.map), 0, 0);
    const dot = (x: number, y: number, col: string, r = 1.2) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const e of w.map.exits) dot((e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2, '#ffe080', 1.8);
    if (w.map.waystone) dot(w.map.waystone.x, w.map.waystone.y, '#7ad8ff', 1.5);
    for (const n of w.npcs) dot(n.x, n.y, '#ffd040', 1);
    for (const m of w.mobs) if (!m.dead) dot(m.x, m.y, m.team === 0 ? '#6ab0ff' : m.boss ? '#ff3030' : m.elite ? '#ffa020' : '#d04040', m.boss ? 1.8 : 0.8);
    const sat = w.session.data.world.satchel;
    if (sat && sat.zoneId === w.zoneId) dot(sat.x, sat.y, '#ffe080', 1.6);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,150,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
