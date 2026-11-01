// UI manager: screens, the panel stack, toasts and gamepad navigation.

import type { Game } from '../game';
import type { MenuAction, UiAction } from '../input/input';
import { sfx } from '../core/audio';
import { h, clear } from './dom';
import { focusFirst, navigate } from './focus';
import { Hud } from './hud';
import { TitleScreen } from './screens';
import { PANELS } from './panels';

export interface PanelInst {
  name: string;
  args: any;
  tab: number;
  el: HTMLElement;
  body: HTMLElement;
  tabsEl: HTMLElement;
  titleEl: HTMLElement;
  state: Record<string, any>;
  ui: UI;
  game: Game;
  sheet: HTMLElement | null;
}

export interface PanelDef {
  title: (p: PanelInst) => string;
  tabs?: (p: PanelInst) => string[];
  render: (body: HTMLElement, p: PanelInst) => void;
  wide?: boolean;
  noClose?: boolean;
}

export class UI {
  game: Game;
  root: HTMLElement;
  gameLayer: HTMLElement;
  panelLayer: HTMLElement;
  toastLayer: HTMLElement;
  bannerEl: HTMLElement;
  hud: Hud;
  title: TitleScreen;
  panels: PanelInst[] = [];
  private refreshPending = false;

  constructor(game: Game, root: HTMLElement) {
    this.game = game;
    this.root = root;
    this.gameLayer = h('div', { class: 'game-layer hidden' });
    this.panelLayer = h('div', { class: 'panel-layer' });
    this.toastLayer = h('div', { class: 'toasts' });
    this.bannerEl = h('div', { class: 'banner' });
    root.append(this.gameLayer, this.panelLayer, this.toastLayer, this.bannerEl);
    this.hud = new Hud(this, this.gameLayer);
    this.title = new TitleScreen(this, root);
    // Clicking the dimmed backdrop closes the top panel
    this.panelLayer.addEventListener('pointerdown', (e) => {
      if (e.target === this.panelLayer) this.close();
    });
  }

  get paused(): boolean {
    return this.panels.length > 0;
  }

  wantsUiInput(): boolean {
    return this.game.state !== 'playing' || this.panels.length > 0;
  }

  // ---------------------------------------------------------------- screens

  showTitle(): void {
    this.closeAll();
    this.gameLayer.classList.add('hidden');
    this.title.show();
  }

  showGame(): void {
    this.title.hide();
    this.gameLayer.classList.remove('hidden');
    this.hud.build();
    this.game.renderer.resize();
  }

  updateTitle(dt: number): void {
    this.title.update(dt);
  }

  updateHud(dt: number): void {
    this.hud.update(dt);
  }

  onDeviceChange(): void {
    this.hud.applyDevice();
    if (this.game.state !== 'playing' && this.game.input.device === 'gamepad') this.title.onGamepad();
    if (this.panels.length) {
      const top = this.panels[this.panels.length - 1];
      if (this.game.input.device === 'gamepad') focusFirst(top.sheet ?? top.el);
    }
  }

  // ---------------------------------------------------------------- panels

  open(name: string, args: any = {}): void {
    const def = PANELS[name];
    if (!def) {
      console.warn('No panel', name);
      return;
    }
    // re-opening the same panel just brings it to the front
    const existing = this.panels.findIndex((p) => p.name === name);
    if (existing >= 0) {
      const [p] = this.panels.splice(existing, 1);
      p.el.remove();
    }
    const titleEl = h('h2', null);
    const tabsEl = h('div', { class: 'tabs' });
    const body = h('div', { class: 'panel-body' });
    const el = h('div', { class: `panel ${def.wide ? 'wide' : ''} panel-${name}` });
    const inst: PanelInst = { name, args, tab: args.tab ?? 0, el, body, tabsEl, titleEl, state: {}, ui: this, game: this.game, sheet: null };
    const closeBtn = def.noClose ? null : h('button', { class: 'close', 'aria-label': 'Close', onclick: () => this.close() }, '✕');
    el.append(h('div', { class: 'panel-head' }, titleEl, closeBtn), tabsEl, body);
    this.panels.push(inst);
    this.panelLayer.appendChild(el);
    this.panelLayer.classList.add('open');
    this.game.input.clearGameplay();
    this.render(inst);
    if (this.game.input.device === 'gamepad') focusFirst(el);
    sfx('click');
  }

  render(p: PanelInst): void {
    const def = PANELS[p.name];
    p.titleEl.textContent = def.title(p);
    const tabs = def.tabs?.(p) ?? [];
    clear(p.tabsEl);
    p.tabsEl.style.display = tabs.length ? '' : 'none';
    if (p.tab >= tabs.length) p.tab = 0;
    tabs.forEach((t, i) =>
      p.tabsEl.appendChild(
        h('button', { class: `tab ${i === p.tab ? 'active' : ''}`, onclick: () => this.setTab(p, i) }, t),
      ),
    );
    const scroll = p.body.scrollTop;
    const focusedKey = (document.activeElement as HTMLElement | null)?.dataset?.key;
    clear(p.body);
    def.render(p.body, p);
    p.body.scrollTop = scroll;
    if (focusedKey) {
      const again = p.el.querySelector<HTMLElement>(`[data-key="${CSS.escape(focusedKey)}"]`);
      again?.focus({ preventScroll: true });
    }
  }

  setTab(p: PanelInst, i: number): void {
    p.tab = i;
    p.body.scrollTop = 0;
    this.closeSheet(p);
    this.render(p);
    if (this.game.input.device === 'gamepad') focusFirst(p.body);
    sfx('click');
  }

  refresh(): void {
    for (const p of this.panels) if (!p.sheet) this.render(p);
  }

  refreshSoon(): void {
    if (this.refreshPending) return;
    this.refreshPending = true;
    requestAnimationFrame(() => {
      this.refreshPending = false;
      this.refresh();
    });
  }

  close(): void {
    const p = this.panels.pop();
    if (!p) return;
    p.el.remove();
    if (!this.panels.length) this.panelLayer.classList.remove('open');
    else {
      const top = this.panels[this.panels.length - 1];
      this.render(top);
      if (this.game.input.device === 'gamepad') focusFirst(top.el);
    }
    this.game.input.clearGameplay();
  }

  closeAll(): void {
    while (this.panels.length) this.close();
  }

  top(): PanelInst | undefined {
    return this.panels[this.panels.length - 1];
  }

  /** An item detail / confirmation sheet layered over the current panel. */
  openSheet(p: PanelInst, content: HTMLElement): void {
    this.closeSheet(p);
    const sheet = h('div', { class: 'sheet' }, h('div', { class: 'sheet-inner' }, content));
    sheet.addEventListener('pointerdown', (e) => {
      if (e.target === sheet) this.closeSheet(p);
    });
    p.sheet = sheet;
    p.el.appendChild(sheet);
    if (this.game.input.device === 'gamepad') focusFirst(sheet);
  }

  closeSheet(p: PanelInst): void {
    if (p.sheet) {
      p.sheet.remove();
      p.sheet = null;
      if (this.game.input.device === 'gamepad') focusFirst(p.el);
    }
  }

  toggleMenu(m: MenuAction): void {
    const map: Record<MenuAction, string> = { menu: 'menu', inventory: 'inventory', character: 'character', skills: 'skills', journal: 'journal', map: 'map' };
    const name = map[m];
    const top = this.top();
    if (top?.name === name) {
      this.close();
      return;
    }
    if (top?.name === 'death') return;
    if (m === 'menu' && top) {
      this.close();
      return;
    }
    this.open(name);
  }

  /** Android Back button. Returns false when there is nothing to go back from (title screen). */
  handleBack(): boolean {
    if (this.game.state !== 'playing') return this.title.back();
    const top = this.top();
    if (!top) {
      this.open('menu');
      return true;
    }
    this.handleUiAction('back');
    return true;
  }

  handleUiAction(a: UiAction): void {
    if (this.game.state !== 'playing') {
      this.title.handleUiAction(a);
      return;
    }
    const top = this.top();
    if (!top) return;
    const root = top.sheet ?? top.el;
    if (a === 'back') {
      if (top.sheet) this.closeSheet(top);
      else if (!PANELS[top.name].noClose) this.close();
      return;
    }
    if (a === 'tabPrev' || a === 'tabNext') {
      const tabs = PANELS[top.name].tabs?.(top) ?? [];
      if (tabs.length > 1 && !top.sheet) this.setTab(top, (top.tab + (a === 'tabNext' ? 1 : tabs.length - 1)) % tabs.length);
      return;
    }
    navigate(root, a);
  }

  // ---------------------------------------------------------------- notices

  toast(text: string, color?: string): void {
    const el = h('div', { class: 'toast', style: color ? { borderColor: color, color } : undefined }, text);
    this.toastLayer.appendChild(el);
    while (this.toastLayer.children.length > 4) this.toastLayer.firstChild?.remove();
    setTimeout(() => el.classList.add('fade'), 2600);
    setTimeout(() => el.remove(), 3300);
  }

  banner(title: string, sub: string): void {
    clear(this.bannerEl);
    this.bannerEl.append(h('div', { class: 'banner-title' }, title), h('div', { class: 'banner-sub' }, sub));
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
  }
}
