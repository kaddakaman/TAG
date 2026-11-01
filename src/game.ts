// Top-level game controller: owns the loop, the loaded session and the world.

import type { Appearance, ClassId, Item, SaveData } from './types';
import { bus } from './core/events';
import { rng } from './core/rng';
import { screenDirToWorld } from './core/math';
import { sfx, setSoundEnabled, unlockAudio } from './core/audio';
import { Input } from './input/input';
import { Renderer } from './render/renderer';
import { Session } from './systems/session';
import { loadSettings, loadShared, loadSlot, newSave, writeSettings, writeSlot, type Settings } from './systems/save';
import { generateStock, type ShopId } from './systems/vendors';
import { World, type WorldHooks } from './world/world';
import { TOWN_ID, ZONES, ZONE_MAP, zoneName } from './data/zones';
import type { UI } from './ui/ui';

export class Game {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input = new Input();
  ui!: UI;
  settings: Settings = loadSettings();
  session: Session | null = null;
  world: World | null = null;
  state: 'title' | 'playing' = 'title';
  vendorStock: Partial<Record<ShopId, Item[]>> = {};
  private last = 0;
  private saveTimer = 0;
  deathTimer = -1;
  private unsub: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    setSoundEnabled(this.settings.sound);
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.renderer.resize(), 200));
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
    });
    window.addEventListener('pagehide', () => this.save());
  }

  attachUI(ui: UI): void {
    this.ui = ui;
    this.input.onDeviceChange = () => ui.onDeviceChange();
  }

  start(): void {
    this.ui.showTitle();
    requestAnimationFrame((t) => this.loop(t));
  }

  saveSettings(): void {
    writeSettings(this.settings);
    setSoundEnabled(this.settings.sound);
  }

  // ------------------------------------------------------------ sessions

  newGame(slot: number, name: string, classId: ClassId, appearance: Appearance): void {
    const data = newSave(slot, name, classId, appearance);
    writeSlot(data);
    this.play(data);
  }

  continueSlot(slot: number): void {
    const data = loadSlot(slot);
    if (data) this.play(data);
  }

  private play(data: SaveData): void {
    this.unsub.forEach((u) => u());
    this.unsub = [];
    const session = new Session(data, loadShared());
    this.session = session;
    if (!session.bountyOffers().length) session.refreshBounties();
    const hooks: WorldHooks = {
      openNpc: (id) => this.ui.open('npc', { npcId: id }),
      openStation: (kind) => {
        const map: Record<string, string> = { board: 'bounties', anvil: 'forge', range: 'cook', chest: 'storage', stash: 'stash', waystone: 'travel' };
        this.ui.open(map[kind]);
      },
      openCampfire: () => this.ui.open('cook', { campfire: true }),
      exitZone: (e) => this.changeZone(e.to),
      playerDied: () => {
        this.deathTimer = 1.8;
        this.input.vibrate(400, 1);
      },
      recallComplete: () => this.changeZone(TOWN_ID, 'waystone'),
      sfx: (n) => sfx(n),
    };
    this.world = new World(session, hooks);
    this.world.load(data.world.zoneId, 'saved');
    this.renderer.snapCamera(this.world.player.x, this.world.player.y);
    this.refreshVendors();
    this.state = 'playing';
    this.deathTimer = -1;
    this.unsub.push(
      bus.on('levelUp', ({ level }) => {
        sfx('level');
        this.ui.toast(`Level ${level}! +5 stat points, +1 skill point.`, '#ffd060');
        this.input.vibrate(200, 0.6);
      }),
      bus.on('lifeLevelUp', ({ skill, level }) => {
        sfx('quest');
        this.ui.toast(`${skill[0].toUpperCase() + skill.slice(1)} level ${level}!`, '#80d0ff');
      }),
      bus.on('toast', ({ text, color }) => this.ui.toast(text, color)),
      bus.on('ui', () => this.ui.refreshSoon()),
      bus.on('questUpdate', () => this.ui.refreshSoon()),
    );
    this.ui.showGame();
    this.ui.banner(zoneName(data.world.zoneId), this.zoneSubtitle(data.world.zoneId));
  }

  zoneSubtitle(id: string): string {
    if (id === TOWN_ID) return `${this.session?.townLevel().name ?? 'Hamlet'} - home of the Adventurer's Guild`;
    const z = ZONE_MAP[id];
    return `${z.subtitle} - Level ${z.level[0]}-${z.level[1]}`;
  }

  refreshVendors(): void {
    if (!this.session) return;
    for (const id of ['general', 'smith', 'inn'] as ShopId[]) this.vendorStock[id] = generateStock(id, this.session);
  }

  changeZone(to: string, arriveOverride?: 'entry' | 'back' | 'waystone'): void {
    const w = this.world;
    const s = this.session;
    if (!w || !s) return;
    const from = w.zoneId;
    const idx = (id: string) => (id === TOWN_ID ? 0 : ZONE_MAP[id]?.index ?? 0);
    const arrive = arriveOverride ?? (idx(to) > idx(from) ? 'entry' : 'back');
    const returning = to === TOWN_ID && from !== TOWN_ID;
    if (returning) {
      s.resetZonesOnTownReturn();
      s.refreshBounties();
      this.refreshVendors();
    }
    w.load(to, arrive);
    this.renderer.snapCamera(w.player.x, w.player.y);
    this.ui.banner(zoneName(to), this.zoneSubtitle(to));
    if (returning) {
      this.ui.toast('The wilds stir... enemies have returned to the areas you cleared.', '#c0b0ff');
      if (s.char.level >= 3) {
        s.data.town.raidCooldown--;
        if (s.data.town.raidCooldown <= 0 && rng.chance(0.4)) {
          s.data.town.raidCooldown = 3;
          setTimeout(() => this.world?.zoneId === TOWN_ID && this.world.startRaid(), 2500);
        }
      }
    }
    this.save();
  }

  travel(zoneId: string): void {
    this.ui.closeAll();
    this.changeZone(zoneId, 'waystone');
  }

  respawn(): void {
    const s = this.session;
    const w = this.world;
    if (!s || !w) return;
    s.invalidate();
    s.char.hp = s.derived.maxHp;
    s.char.resource = s.derived.maxRes;
    s.buffs.clear();
    w.player.dead = false;
    this.deathTimer = -1;
    if (w.zoneId === TOWN_ID) {
      w.load(TOWN_ID, 'waystone');
      this.renderer.snapCamera(w.player.x, w.player.y);
      this.save();
    } else this.changeZone(TOWN_ID, 'waystone');
  }

  save(): boolean {
    const s = this.session;
    const w = this.world;
    if (!s || !w || this.state !== 'playing') return false;
    if (!w.player.dead) {
      s.data.world.x = w.player.x;
      s.data.world.y = w.player.y;
    } else {
      s.data.world.zoneId = TOWN_ID;
      s.data.world.x = 25.5;
      s.data.world.y = 22.5;
    }
    return s.save();
  }

  quitToTitle(): void {
    this.save();
    this.state = 'title';
    this.world = null;
    this.session = null;
    this.unsub.forEach((u) => u());
    this.unsub = [];
    this.ui.showTitle();
  }

  // ------------------------------------------------------------ loop

  private loop(t: number): void {
    const dt = Math.min(0.05, Math.max(0, (t - (this.last || t)) / 1000));
    this.last = t;
    try {
      this.frame(dt);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((tt) => this.loop(tt));
  }

  private frame(dt: number): void {
    const ui = this.ui;
    this.input.uiMode = ui.wantsUiInput();
    this.input.poll(dt);
    while (this.input.uiQueue.length) ui.handleUiAction(this.input.uiQueue.shift()!);
    while (this.input.menuQueue.length) {
      const m = this.input.menuQueue.shift()!;
      if (this.state === 'playing') ui.toggleMenu(m);
    }
    const w = this.world;
    if (this.state !== 'playing' || !w) {
      this.input.clearGameplay();
      ui.updateTitle(dt);
      return;
    }
    if (!ui.paused) {
      const dir = screenDirToWorld(this.input.moveX, this.input.moveY);
      const it = w.intent;
      it.moveX = dir.x;
      it.moveY = dir.y;
      it.attack = this.input.attackHeld;
      if (this.input.abilityQueue.length) it.ability = this.input.abilityQueue.shift()!;
      if (this.input.interact) it.interact = true;
      if (this.input.potion) it.potion = true;
      this.input.interact = false;
      this.input.potion = false;
      if (w.player.dead) {
        it.moveX = it.moveY = 0;
        it.attack = false;
        it.ability = -1;
      }
      w.update(dt);
      if (this.deathTimer > 0) {
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) ui.open('death');
      }
      this.saveTimer += dt;
      if (this.saveTimer > 45) {
        this.saveTimer = 0;
        this.save();
      }
    } else {
      this.input.clearGameplay();
      w.intent.attack = false;
      w.intent.moveX = w.intent.moveY = 0;
    }
    this.renderer.render(w, ui.paused ? 0 : dt, this.settings.screenShake);
    ui.updateHud(dt);
  }

  /** zone list for UI */
  zones() {
    return ZONES;
  }
}
