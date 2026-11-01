// Tiny synthesized sound effects (no asset files needed).

let ctx: AudioContext | null = null;
let enabled = true;
const last = new Map<string, number>();

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export function unlockAudio(): void {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0): void {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, filter = 1200, delay = 0): void {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filter;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}

export function sfx(name: string): void {
  if (!enabled || !ctx) return;
  const now = performance.now();
  const minGap = name === 'hit' || name === 'mobhit' ? 45 : 30;
  if (now - (last.get(name) ?? 0) < minGap) return;
  last.set(name, now);
  switch (name) {
    case 'swing':
      noise(0.08, 0.08, 2500);
      break;
    case 'hit':
      noise(0.07, 0.18, 900);
      tone(140, 0.08, 'square', 0.05, -60);
      break;
    case 'mobhit':
      noise(0.06, 0.1, 700);
      break;
    case 'hurt':
      tone(180, 0.15, 'sawtooth', 0.06, -90);
      break;
    case 'bow':
      tone(500, 0.08, 'triangle', 0.05, -300);
      noise(0.05, 0.05, 3000);
      break;
    case 'zap':
      tone(900, 0.1, 'square', 0.03, -500);
      break;
    case 'fire':
      noise(0.25, 0.12, 600);
      break;
    case 'frost':
      tone(1200, 0.2, 'sine', 0.05, -600);
      break;
    case 'boom':
      noise(0.4, 0.25, 400);
      tone(80, 0.3, 'sine', 0.15, -40);
      break;
    case 'thunder':
      noise(0.5, 0.25, 300);
      break;
    case 'cast':
      tone(400, 0.25, 'sine', 0.05, 400);
      break;
    case 'buff':
      tone(400, 0.12, 'triangle', 0.06, 0);
      tone(600, 0.12, 'triangle', 0.06, 0, 0.1);
      break;
    case 'coin':
      tone(1200, 0.06, 'square', 0.03);
      tone(1600, 0.08, 'square', 0.03, 0, 0.05);
      break;
    case 'pickup':
      tone(600, 0.06, 'triangle', 0.05, 300);
      break;
    case 'potion':
      tone(300, 0.2, 'sine', 0.07, 300);
      break;
    case 'die':
      noise(0.15, 0.08, 500);
      break;
    case 'bossdie':
      noise(1, 0.25, 300);
      tone(60, 1, 'sawtooth', 0.08, -20);
      break;
    case 'death':
      tone(220, 1.2, 'sawtooth', 0.08, -170);
      break;
    case 'level':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.07, 0, i * 0.1));
      break;
    case 'quest':
      [392, 523, 659].forEach((f, i) => tone(f, 0.2, 'triangle', 0.07, 0, i * 0.09));
      break;
    case 'mine':
      tone(1400, 0.05, 'square', 0.04);
      noise(0.05, 0.08, 4000);
      break;
    case 'chop':
      noise(0.08, 0.15, 800);
      break;
    case 'alarm':
      [600, 450, 600, 450].forEach((f, i) => tone(f, 0.18, 'square', 0.04, 0, i * 0.2));
      break;
    case 'howl':
      tone(300, 0.8, 'sine', 0.06, 300);
      break;
    case 'click':
      tone(800, 0.03, 'square', 0.02);
      break;
    case 'craft':
      tone(900, 0.06, 'square', 0.04);
      tone(700, 0.08, 'square', 0.04, 0, 0.08);
      break;
  }
}
