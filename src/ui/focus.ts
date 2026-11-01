// Spatial focus navigation so every menu can be driven with a gamepad.

import type { UiAction } from '../input/input';

const SELECTOR = 'button:not([disabled]), [data-nav], input, select';

function visible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(SELECTOR)].filter(visible);
}

export function focusFirst(root: HTMLElement, preferSelector?: string): void {
  const list = focusables(root);
  const pref = preferSelector ? (root.querySelector<HTMLElement>(preferSelector) ?? null) : null;
  const el = pref && visible(pref) ? pref : list.find((e) => !e.classList.contains('close')) ?? list[0];
  if (el) {
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  }
}

export function navigate(root: HTMLElement, action: UiAction): boolean {
  const list = focusables(root);
  if (!list.length) return false;
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || !root.contains(cur) || !list.includes(cur)) {
    focusFirst(root);
    return true;
  }
  if (action === 'confirm') {
    cur.click();
    return true;
  }
  const r = cur.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const e = el.getBoundingClientRect();
    const ex = e.left + e.width / 2;
    const ey = e.top + e.height / 2;
    const dx = ex - cx;
    const dy = ey - cy;
    let primary = 0;
    let secondary = 0;
    switch (action) {
      case 'up':
        if (dy >= -2) continue;
        primary = -dy;
        secondary = Math.abs(dx);
        break;
      case 'down':
        if (dy <= 2) continue;
        primary = dy;
        secondary = Math.abs(dx);
        break;
      case 'left':
        if (dx >= -2) continue;
        primary = -dx;
        secondary = Math.abs(dy);
        break;
      case 'right':
        if (dx <= 2) continue;
        primary = dx;
        secondary = Math.abs(dy);
        break;
      default:
        return false;
    }
    const score = primary + secondary * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) {
    best.focus({ preventScroll: true });
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }
  return false;
}
