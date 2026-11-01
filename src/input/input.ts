// Unified input: keyboard, touch virtual gamepad and physical gamepads all
// feed the same action state.

export type Device = 'keyboard' | 'touch' | 'gamepad';

export type UiAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'tabPrev' | 'tabNext';
export type MenuAction = 'menu' | 'inventory' | 'character' | 'skills' | 'journal' | 'map';

export class Input {
  /** screen-space movement, -1..1 */
  moveX = 0;
  moveY = 0;
  attackHeld = false;
  abilityQueue: number[] = [];
  interact = false;
  potion = false;
  menuQueue: MenuAction[] = [];
  uiQueue: UiAction[] = [];
  device: Device = 'keyboard';
  onDeviceChange: ((d: Device) => void) | null = null;

  // separate sources so they don't clobber each other
  private keys = new Set<string>();
  touchMove = { x: 0, y: 0 };
  touchAttack = false;
  padMove = { x: 0, y: 0 };
  padAttack = false;
  private prevPad: boolean[] = [];
  private padAxesPrev = { x: 0, y: 0 };
  private navRepeat = 0;
  uiMode = false;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('gamepadconnected', () => this.setDevice('gamepad'));
  }

  setDevice(d: Device): void {
    if (this.device !== d) {
      this.device = d;
      this.onDeviceChange?.(d);
    }
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (down) this.setDevice('keyboard');
    if (down) {
      if (!this.keys.has(k)) this.onPress(k, e);
      this.keys.add(k);
    } else this.keys.delete(k);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k) && !this.uiMode) e.preventDefault();
  }

  private onPress(k: string, e: KeyboardEvent): void {
    if (this.uiMode) {
      if (k === 'escape') this.uiQueue.push('back');
      if (k === 'tab') {
        e.preventDefault();
        this.uiQueue.push(e.shiftKey ? 'tabPrev' : 'tabNext');
      }
      if (k === 'i' || k === 'b') this.menuQueue.push('inventory');
      if (k === 'c') this.menuQueue.push('character');
      if (k === 'k') this.menuQueue.push('skills');
      if (k === 'l' || k === 'j') this.menuQueue.push('journal');
      if (k === 'm') this.menuQueue.push('map');
      return;
    }
    if (k >= '1' && k <= '4') this.abilityQueue.push(Number(k) - 1);
    if (k === 'e' || k === 'f' || k === 'enter') this.interact = true;
    if (k === 'q') this.potion = true;
    if (k === 'escape') this.menuQueue.push('menu');
    if (k === 'i' || k === 'b') this.menuQueue.push('inventory');
    if (k === 'c') this.menuQueue.push('character');
    if (k === 'k') this.menuQueue.push('skills');
    if (k === 'l' || k === 'j') this.menuQueue.push('journal');
    if (k === 'm') this.menuQueue.push('map');
  }

  /** Called once per frame. */
  poll(dt: number): void {
    this.pollGamepad(dt);
    let kx = 0;
    let ky = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) kx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) kx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) ky -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) ky += 1;
    const kl = Math.hypot(kx, ky);
    if (kl > 0) {
      kx /= kl;
      ky /= kl;
    }
    const sources = [
      { x: kx, y: ky },
      this.touchMove,
      this.padMove,
    ];
    let best = { x: 0, y: 0 };
    for (const s of sources) if (Math.hypot(s.x, s.y) > Math.hypot(best.x, best.y)) best = s;
    this.moveX = best.x;
    this.moveY = best.y;
    this.attackHeld = this.keys.has(' ') || this.keys.has('j') || this.touchAttack || this.padAttack;
  }

  private pollGamepad(dt: number): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) {
      pad = p;
      break;
    }
    if (!pad) {
      this.padMove = { x: 0, y: 0 };
      this.padAttack = false;
      return;
    }
    const pressed = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    const edge = (i: number) => pressed[i] && !this.prevPad[i];
    const dz = (v: number) => (Math.abs(v) < 0.22 ? 0 : v);
    const ax = dz(pad.axes[0] ?? 0);
    const ay = dz(pad.axes[1] ?? 0);
    if (pressed.some((p) => p) || ax || ay) this.setDevice('gamepad');

    if (this.uiMode) {
      this.padMove = { x: 0, y: 0 };
      this.padAttack = false;
      // navigation with d-pad or stick, with key-repeat
      let dir: UiAction | null = null;
      if (edge(12)) dir = 'up';
      else if (edge(13)) dir = 'down';
      else if (edge(14)) dir = 'left';
      else if (edge(15)) dir = 'right';
      const sx = Math.abs(ax) > 0.5 ? Math.sign(ax) : 0;
      const sy = Math.abs(ay) > 0.5 ? Math.sign(ay) : 0;
      const stickActive = sx || sy;
      const wasActive = this.padAxesPrev.x || this.padAxesPrev.y;
      this.navRepeat -= dt;
      if (stickActive && (!wasActive || this.navRepeat <= 0)) {
        dir = Math.abs(ay) > Math.abs(ax) ? (sy < 0 ? 'up' : 'down') : sx < 0 ? 'left' : 'right';
        this.navRepeat = wasActive ? 0.12 : 0.35;
      }
      const held = [12, 13, 14, 15].some((i) => pressed[i] && this.prevPad[i]);
      if (held && this.navRepeat <= 0 && !stickActive) {
        if (pressed[12]) dir = 'up';
        else if (pressed[13]) dir = 'down';
        else if (pressed[14]) dir = 'left';
        else if (pressed[15]) dir = 'right';
        this.navRepeat = 0.12;
      } else if ([12, 13, 14, 15].some((i) => edge(i))) this.navRepeat = 0.35;
      this.padAxesPrev = { x: sx, y: sy };
      if (dir) this.uiQueue.push(dir);
      if (edge(0)) this.uiQueue.push('confirm');
      if (edge(1)) this.uiQueue.push('back');
      if (edge(4)) this.uiQueue.push('tabPrev');
      if (edge(5)) this.uiQueue.push('tabNext');
      if (edge(9)) this.uiQueue.push('back');
      if (edge(8)) this.menuQueue.push('inventory');
    } else {
      this.padMove = { x: ax, y: ay };
      this.padAttack = pressed[0];
      if (edge(2)) this.abilityQueue.push(0); // X
      if (edge(1)) this.abilityQueue.push(1); // B
      if (edge(5)) this.abilityQueue.push(2); // RB
      if (edge(7)) this.abilityQueue.push(3); // RT
      if (edge(3)) this.interact = true; // Y
      if (edge(4)) this.potion = true; // LB
      if (edge(9)) this.menuQueue.push('menu'); // Start
      if (edge(8)) this.menuQueue.push('inventory'); // Back/Select
      if (edge(12)) this.menuQueue.push('journal');
      if (edge(13)) this.menuQueue.push('skills');
      if (edge(14)) this.menuQueue.push('character');
      if (edge(15)) this.menuQueue.push('map');
    }
    this.prevPad = pressed;
  }

  clearGameplay(): void {
    this.abilityQueue = [];
    this.interact = false;
    this.potion = false;
    this.touchAttack = false;
  }

  vibrate(ms: number, strength = 0.5): void {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        const act = (p as any)?.vibrationActuator;
        if (act?.playEffect) act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength });
      }
      if (this.device === 'touch' && navigator.vibrate) navigator.vibrate(Math.min(ms, 40));
    } catch {
      /* ignore */
    }
  }
}

export const GAMEPAD_GLYPHS = {
  attack: 'A',
  ability: ['X', 'B', 'RB', 'RT'],
  interact: 'Y',
  potion: 'LB',
  menu: '☰',
};

export const KEY_GLYPHS = {
  attack: 'Space',
  ability: ['1', '2', '3', '4'],
  interact: 'E',
  potion: 'Q',
  menu: 'Esc',
};
