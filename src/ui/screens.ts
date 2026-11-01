// Title screen, save slot selection and character creation.

import type { Appearance, ClassId, Gender } from '../types';
import { STAT_IDS } from '../types';
import { CLASSES, CLOTH_COLORS, HAIR_COLORS, HAIR_STYLES, SKIN_TONES, STAT_INFO } from '../data/classes';
import { zoneName } from '../data/zones';
import { deleteSlot, listSlots, SLOT_COUNT } from '../systems/save';
import { drawCharacterPreview } from '../render/renderer';
import type { UiAction } from '../input/input';
import { sfx } from '../core/audio';
import { h, clear, fmtTime } from './dom';
import { focusFirst, navigate } from './focus';
import type { UI } from './ui';

const NAMES = ['Aric', 'Brynn', 'Cael', 'Dara', 'Edric', 'Fenna', 'Garran', 'Hilde', 'Ivo', 'Jessa', 'Kael', 'Lyra', 'Marek', 'Nyx', 'Orrin', 'Petra', 'Quill', 'Rowan', 'Sable', 'Tamsin', 'Ulric', 'Vesna', 'Wren', 'Yorick', 'Zara'];

export class TitleScreen {
  private el: HTMLElement;
  private view: 'main' | 'slots' | 'create' = 'main';
  private previews: { canvas: HTMLCanvasElement; app: Appearance; cls: string }[] = [];
  private time = 0;
  private createState: { slot: number; name: string; classId: ClassId; app: Appearance; facing: number } | null = null;
  private createPreview: HTMLCanvasElement | null = null;

  constructor(private ui: UI, root: HTMLElement) {
    this.el = h('div', { class: 'title-screen hidden' });
    root.appendChild(this.el);
  }

  show(): void {
    this.el.classList.remove('hidden');
    this.renderMain();
  }

  hide(): void {
    this.el.classList.add('hidden');
  }

  update(dt: number): void {
    this.time += dt;
    for (const p of this.previews) drawCharacterPreview(p.canvas, p.app, p.cls, Math.PI / 4, this.time);
    if (this.createPreview && this.createState) {
      drawCharacterPreview(this.createPreview, this.createState.app, this.createState.classId, this.createState.facing, this.time);
    }
  }

  handleUiAction(a: UiAction): void {
    if (a === 'back') {
      if (this.view === 'create') this.renderSlots();
      else if (this.view === 'slots') this.renderMain();
      return;
    }
    const sheet = this.el.querySelector<HTMLElement>('.confirm');
    navigate(sheet ?? this.el, a);
  }

  private preferred(): string {
    if (this.view === 'slots') return '.slot-card button.primary, .slot-card.empty';
    if (this.view === 'create') return '[data-key="begin"]';
    return '.title-menu button';
  }

  private focus(): void {
    if (this.ui.game.input.device === 'gamepad') focusFirst(this.el, this.preferred());
  }

  /** Called when a gamepad is first used: make sure something is focused. */
  onGamepad(): void {
    if (this.el.classList.contains('hidden')) return;
    if (!this.el.contains(document.activeElement)) focusFirst(this.el.querySelector<HTMLElement>('.confirm') ?? this.el, this.preferred());
  }

  private renderMain(): void {
    this.view = 'main';
    this.previews = [];
    this.createPreview = null;
    clear(this.el);
    const hasSaves = listSlots().some(Boolean);
    this.el.append(
      h('div', { class: 'title-logo' },
        h('div', { class: 'logo-tag' }, 'TAG'),
        h('div', { class: 'logo-sub' }, "The Adventurer's Guild"),
      ),
      h('div', { class: 'title-menu' },
        h('button', { class: 'big', onclick: () => { sfx('click'); this.renderSlots(); } }, hasSaves ? 'Play' : 'Begin Your Legend'),
        h('button', { onclick: () => this.showControls() }, 'Controls'),
        h('button', { onclick: () => this.toggleFullscreen() }, 'Fullscreen'),
      ),
      h('div', { class: 'title-foot' }, 'Touch, keyboard and gamepad supported. Best played in landscape.'),
    );
    this.focus();
  }

  private toggleFullscreen(): void {
    const d = document as any;
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().then(() => (screen.orientation as any)?.lock?.('landscape').catch(() => {})).catch(() => {});
    } else void d.exitFullscreen?.();
  }

  private showControls(): void {
    const box = h('div', { class: 'confirm' },
      h('h3', null, 'Controls'),
      h('table', { class: 'controls' },
        h('tr', null, h('th', null, 'Action'), h('th', null, 'Touch'), h('th', null, 'Keyboard'), h('th', null, 'Gamepad')),
        ...[
          ['Move', 'Left stick (drag anywhere on the left)', 'WASD / Arrows', 'Left stick'],
          ['Attack', 'Sword button (hold)', 'Space / J (hold)', 'A (hold)'],
          ['Abilities 1-4', 'Ability buttons', '1 2 3 4', 'X  B  RB  RT'],
          ['Interact / Talk / Gather', 'Context button', 'E', 'Y'],
          ['Potion', 'Potion button', 'Q', 'LB'],
          ['Inventory', 'Bag', 'I', 'Back / Select'],
          ['Journal / Skills / Hero / Map', 'Top buttons', 'L / K / C / M', 'D-pad'],
          ['Menu', '☰', 'Esc', 'Start'],
          ['Menus', 'Tap', 'Mouse', 'D-pad + A, B to go back, LB/RB tabs'],
        ].map((r) => h('tr', null, ...r.map((c) => h('td', null, c)))),
      ),
      h('button', { onclick: () => box.remove() }, 'Close'),
    );
    this.el.appendChild(box);
    if (this.ui.game.input.device === 'gamepad') focusFirst(box);
  }

  // ------------------------------------------------------------------ slots

  private renderSlots(): void {
    this.view = 'slots';
    this.createPreview = null;
    clear(this.el);
    this.previews = [];
    const slots = listSlots();
    const grid = h('div', { class: 'slot-grid' });
    for (let i = 0; i < SLOT_COUNT; i++) {
      const s = slots[i];
      if (s) {
        const cv = h('canvas', { class: 'slot-preview' });
        this.previews.push({ canvas: cv, app: s.appearance, cls: s.classId });
        grid.appendChild(
          h('div', { class: 'slot-card' },
            cv,
            h('div', { class: 'slot-info' },
              h('div', { class: 'slot-name' }, s.name),
              h('div', null, `Level ${s.level} ${CLASSES[s.classId].name}`),
              h('div', { class: 'muted' }, `${zoneName(s.zoneId)} - ${fmtTime(s.playTime)}`),
            ),
            h('div', { class: 'slot-actions' },
              h('button', { class: 'primary', 'data-key': `slot${i}`, onclick: () => { sfx('click'); this.ui.game.continueSlot(i); } }, 'Continue'),
              h('button', { class: 'danger small', onclick: () => this.confirmDelete(i, s.name) }, 'Delete'),
            ),
          ),
        );
      } else {
        grid.appendChild(
          h('button', { class: 'slot-card empty', onclick: () => { sfx('click'); this.renderCreate(i); } }, h('div', { class: 'plus' }, '+'), h('div', null, 'New Adventurer'), h('div', { class: 'muted' }, `Slot ${i + 1}`)),
        );
      }
    }
    this.el.append(
      h('div', { class: 'screen-head' },
        h('button', { class: 'back', onclick: () => this.renderMain() }, '‹ Back'),
        h('h2', null, 'Choose Your Adventurer'),
      ),
      grid,
      h('div', { class: 'title-foot' }, 'Each slot is a separate adventurer. The Guild Vault in Hearthvale is shared by all of them - pass loot between your characters.'),
    );
    this.focus();
  }

  private confirmDelete(slot: number, name: string): void {
    const box = h('div', { class: 'confirm' },
      h('h3', null, `Delete ${name}?`),
      h('p', null, 'This adventurer will be lost forever. Items in the shared Guild Vault are kept.'),
      h('div', { class: 'row' },
        h('button', { onclick: () => box.remove() }, 'Keep'),
        h('button', { class: 'danger', onclick: () => { deleteSlot(slot); this.renderSlots(); } }, 'Delete'),
      ),
    );
    this.el.appendChild(box);
    if (this.ui.game.input.device === 'gamepad') focusFirst(box);
  }

  // ------------------------------------------------------------------ creation

  private renderCreate(slot: number): void {
    this.view = 'create';
    this.previews = [];
    if (!this.createState || this.createState.slot !== slot) {
      this.createState = {
        slot,
        name: NAMES[Math.floor(Math.random() * NAMES.length)],
        classId: 'fighter',
        facing: Math.PI / 4,
        app: { gender: 'male', skin: SKIN_TONES[1], hair: HAIR_COLORS[1], hairStyle: 0, primary: CLOTH_COLORS[0], secondary: CLOTH_COLORS[9], tertiary: CLOTH_COLORS[2] },
      };
    }
    this.drawCreate();
  }

  private drawCreate(): void {
    const st = this.createState!;
    const focused = (document.activeElement as HTMLElement | null)?.dataset?.key;
    clear(this.el);
    const swatches = (label: string, colors: string[], key: keyof Appearance) =>
      h('div', { class: 'opt-row' },
        h('div', { class: 'opt-label' }, label),
        h('div', { class: 'swatches' },
          ...colors.map((c) =>
            h('button', {
              class: `swatch ${st.app[key] === c ? 'sel' : ''}`, style: { background: c }, 'aria-label': `${label} ${c}`, 'data-key': `${key}-${c}`,
              onclick: () => { (st.app as any)[key] = c; sfx('click'); this.drawCreate(); },
            }),
          ),
        ),
      );
    const nameInput = h('input', { class: 'name-input', maxlength: 16, value: st.name, 'aria-label': 'Character name' }) as HTMLInputElement;
    nameInput.addEventListener('input', () => (st.name = nameInput.value));
    const cls = CLASSES[st.classId];
    const preview = h('canvas', { class: 'create-preview' });
    this.createPreview = preview;
    this.el.append(
      h('div', { class: 'screen-head' },
        h('button', { class: 'back', onclick: () => this.renderSlots() }, '‹ Back'),
        h('h2', null, 'Create Your Adventurer'),
      ),
      h('div', { class: 'create' },
        h('div', { class: 'create-left' },
          preview,
          h('div', { class: 'row center' },
            h('button', { class: 'small', 'data-key': 'rotl', onclick: () => (st.facing += Math.PI / 4) }, '⟲'),
            h('button', { class: 'small', 'data-key': 'rotr', onclick: () => (st.facing -= Math.PI / 4) }, '⟳'),
          ),
          h('div', { class: 'class-desc' },
            h('h3', { style: { color: cls.color } }, cls.name),
            h('div', { class: 'tagline' }, cls.tagline),
            h('p', null, cls.description),
            h('div', { class: 'statline' }, ...STAT_IDS.map((s) => h('span', { class: cls.primaryStats.includes(s) ? 'hi' : '' }, `${STAT_INFO[s].short} ${cls.baseStats[s]}`))),
          ),
        ),
        h('div', { class: 'create-right' },
          h('div', { class: 'opt-row' },
            h('div', { class: 'opt-label' }, 'Name'),
            h('div', { class: 'row' }, nameInput, h('button', { class: 'small', 'data-key': 'rand', onclick: () => { st.name = NAMES[Math.floor(Math.random() * NAMES.length)]; this.drawCreate(); } }, '🎲')),
          ),
          h('div', { class: 'opt-row' },
            h('div', { class: 'opt-label' }, 'Class'),
            h('div', { class: 'class-pick' },
              ...(Object.keys(CLASSES) as ClassId[]).map((id) =>
                h('button', {
                  class: `class-btn ${st.classId === id ? 'sel' : ''}`, style: { borderColor: CLASSES[id].color }, 'data-key': `cls-${id}`,
                  onclick: () => { st.classId = id; sfx('click'); this.drawCreate(); },
                }, CLASSES[id].name),
              ),
            ),
          ),
          h('div', { class: 'opt-row' },
            h('div', { class: 'opt-label' }, 'Gender'),
            h('div', { class: 'row' },
              ...(['male', 'female'] as Gender[]).map((g) =>
                h('button', {
                  class: `small ${st.app.gender === g ? 'sel' : ''}`, 'data-key': `g-${g}`,
                  onclick: () => { st.app.gender = g; st.app.hairStyle = Math.min(st.app.hairStyle, HAIR_STYLES[g].length - 1); this.drawCreate(); },
                }, g === 'male' ? 'Male' : 'Female'),
              ),
            ),
          ),
          h('div', { class: 'opt-row' },
            h('div', { class: 'opt-label' }, 'Hair Style'),
            h('div', { class: 'row wrap' },
              ...HAIR_STYLES[st.app.gender].map((n, i) =>
                h('button', { class: `small ${st.app.hairStyle === i ? 'sel' : ''}`, 'data-key': `hs-${i}`, onclick: () => { st.app.hairStyle = i; this.drawCreate(); } }, n),
              ),
            ),
          ),
          swatches('Skin', SKIN_TONES, 'skin'),
          swatches('Hair Colour', HAIR_COLORS, 'hair'),
          swatches('Clothing (Primary)', CLOTH_COLORS, 'primary'),
          swatches('Clothing (Secondary)', CLOTH_COLORS, 'secondary'),
          swatches('Trim & Cape (Tertiary)', CLOTH_COLORS, 'tertiary'),
          h('button', { class: 'big primary', 'data-key': 'begin', onclick: () => this.begin() }, 'Begin Adventure'),
        ),
      ),
    );
    if (focused) this.el.querySelector<HTMLElement>(`[data-key="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
    else this.focus();
  }

  private begin(): void {
    const st = this.createState!;
    const name = st.name.trim().slice(0, 16) || 'Adventurer';
    sfx('quest');
    this.createState = null;
    this.createPreview = null;
    this.ui.game.newGame(st.slot, name, st.classId, { ...st.app });
  }
}
