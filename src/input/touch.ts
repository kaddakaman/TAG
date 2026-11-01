// Touch virtual gamepad: a floating joystick on the left half of the screen
// and action buttons (built by the HUD) on the right.

import type { Input } from './input';

export class TouchJoystick {
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private pointerId: number | null = null;
  private cx = 0;
  private cy = 0;
  private radius = 56;
  enabled = true;
  side: 'left' | 'right' = 'left';

  constructor(private zone: HTMLElement, private input: Input) {
    this.base = document.createElement('div');
    this.base.className = 'joy-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.base.appendChild(this.knob);
    zone.appendChild(this.base);
    zone.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    this.reset();
  }

  private down(e: PointerEvent): void {
    if (!this.enabled || this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && this.input.device !== 'touch') return;
    this.input.setDevice('touch');
    this.pointerId = e.pointerId;
    this.cx = e.clientX;
    this.cy = e.clientY;
    this.base.style.left = `${this.cx}px`;
    this.base.style.top = `${this.cy}px`;
    this.base.classList.add('active');
    this.knob.style.transform = 'translate(-50%, -50%)';
    e.preventDefault();
  }

  private move(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    let dx = e.clientX - this.cx;
    let dy = e.clientY - this.cy;
    const d = Math.hypot(dx, dy);
    if (d > this.radius) {
      // drag the base along so the stick never "bottoms out"
      const over = d - this.radius;
      this.cx += (dx / d) * over;
      this.cy += (dy / d) * over;
      this.base.style.left = `${this.cx}px`;
      this.base.style.top = `${this.cy}px`;
      dx = e.clientX - this.cx;
      dy = e.clientY - this.cy;
    }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const nx = dx / this.radius;
    const ny = dy / this.radius;
    const mag = Math.hypot(nx, ny);
    if (mag < 0.15) this.input.touchMove = { x: 0, y: 0 };
    else this.input.touchMove = { x: nx, y: ny };
  }

  private up(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.input.touchMove = { x: 0, y: 0 };
    this.reset();
  }

  reset(): void {
    this.base.classList.remove('active');
    const r = this.zone.getBoundingClientRect();
    this.base.style.left = `${r.left + (this.side === 'left' ? 110 : r.width - 110)}px`;
    this.base.style.top = `${r.bottom - 120}px`;
    this.knob.style.transform = 'translate(-50%, -50%)';
  }
}

/** Binds a DOM button to press/release callbacks with proper multi-touch handling. */
export function bindHold(el: HTMLElement, onDown: () => void, onUp: () => void, input: Input): void {
  let active: number | null = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') input.setDevice('touch');
    active = e.pointerId;
    el.setPointerCapture?.(e.pointerId);
    el.classList.add('pressed');
    onDown();
    e.preventDefault();
    e.stopPropagation();
  });
  const release = (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    active = null;
    el.classList.remove('pressed');
    onUp();
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', release);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
