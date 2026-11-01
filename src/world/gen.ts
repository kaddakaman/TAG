// Procedural generation for wilderness zones and the hand-laid town of Hearthvale.

import { Noise2D, Rng } from '../core/rng';
import { clamp, dist } from '../core/math';
import { ZONES, TOWN_BIOME, TOWN_ID, nextZone, prevZoneId, zoneName, type ZoneDef } from '../data/zones';
import { nodeForItem } from '../data/lifeskills';
import {
  T_DARK, T_DEEP, T_FLOOR, T_GRASS, T_PATH, T_PLAZA, T_SAND, T_WATER, floodReachable,
  type NodeSpawn, type Prop, type PropKind, type SpawnDef, type ZoneMap,
} from './map';

const TREE_FOR_LOG: Record<string, string> = { oak_log: 'oak', willow_log: 'willow', maple_log: 'maple', yew_log: 'yew', elder_log: 'elder' };
const SOLID_DECOR = new Set<PropKind>(['rock', 'grave', 'crystal', 'deadtree', 'pine', 'stump']);

function blank(id: string, w: number, h: number, biome: ZoneMap['biome'], level: [number, number]): ZoneMap {
  return {
    id, w, h, biome, level,
    tiles: new Uint8Array(w * h),
    shade: new Uint8Array(w * h),
    solid: new Uint8Array(w * h),
    opaque: new Uint8Array(w * h),
    props: [], spawns: [], nodes: [], exits: [], stations: [], campSpots: [],
    entry: { x: w / 2, y: h - 3 }, backEntry: { x: w / 2, y: 3 },
    waystone: null, isTown: false,
  };
}

function addProp(m: ZoneMap, kind: PropKind, tx: number, ty: number, r: Rng, extra: Partial<Prop> = {}): Prop {
  const p: Prop = { kind, x: tx + 0.5, y: ty + 0.5, variant: r.int(0, 3), seed: r.int(0, 1e6), depth: tx + ty + 1, ...extra };
  m.props.push(p);
  if (p.solid ?? SOLID_DECOR.has(kind) ?? false) {
    m.solid[ty * m.w + tx] = 1;
    if (kind !== 'stump' && kind !== 'rock') m.opaque[ty * m.w + tx] = 1;
  }
  return p;
}

export function generateZone(def: ZoneDef): ZoneMap {
  const W = def.size;
  const H = def.size;
  const r = new Rng('zone:' + def.id);
  const nA = new Noise2D(def.id + ':a');
  const nW = new Noise2D(def.id + ':w');
  const nF = new Noise2D(def.id + ':f');
  const m = blank(def.id, W, H, def.biome, def.level);
  const reserved = new Uint8Array(W * H);
  const I = (x: number, y: number) => y * W + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) m.shade[I(x, y)] = clamp(Math.floor(nA.fbm(x * 0.13, y * 0.13) * 4.6 - 0.3), 0, 3);

  const stamp = (cx: number, cy: number, rad: number, fn: (x: number, y: number) => void) => {
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++)
      for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++)
        if (inside(x, y) && dist(x + 0.5, y + 0.5, cx, cy) <= rad) fn(x, y);
  };
  const carve = (pts: { x: number; y: number }[], width: number, reserveW: number) => {
    const samples: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const d = dist(a.x, a.y, b.x, b.y);
      for (let t = 0; t <= d; t += 0.5) {
        const x = a.x + ((b.x - a.x) * t) / d;
        const y = a.y + ((b.y - a.y) * t) / d;
        samples.push({ x, y });
        const w = width + nA.sample(x * 0.3, y * 0.3) * 0.6;
        stamp(x, y, w, (tx, ty) => (m.tiles[I(tx, ty)] = T_PATH));
        stamp(x, y, reserveW, (tx, ty) => (reserved[I(tx, ty)] = 1));
      }
    }
    return samples;
  };

  const mid = Math.floor(W / 2);
  m.entry = { x: mid + 0.5, y: H - 3.5 };
  m.backEntry = { x: mid + 0.5, y: 3.5 };
  const boss = { x: clamp(mid + r.range(-9, 9), 12, W - 12), y: 12 };
  const pts = [{ x: mid + 0.5, y: H }, { x: mid + 0.5, y: H - 6 }];
  for (let k = 1; k <= 3; k++) pts.push({ x: clamp(mid + r.range(-W * 0.3, W * 0.3), 9, W - 9), y: H - 6 - (k * (H - 24)) / 4 });
  pts.push(boss, { x: mid + 0.5, y: 4 }, { x: mid + 0.5, y: -1 });
  const pathSamples = carve(pts, 1.25, 2.6);

  // waystone near the entrance
  const ws = { x: mid + 3.5, y: H - 7.5 };
  stamp(ws.x, ws.y, 2, (x, y) => {
    reserved[I(x, y)] = 1;
    m.tiles[I(x, y)] = T_PATH;
  });
  m.waystone = ws;

  // enemy camps
  const camps: { x: number; y: number }[] = [];
  for (let a = 0; a < 600 && camps.length < def.packs; a++) {
    const p = { x: r.range(7, W - 7), y: r.range(16, H - 12) };
    if (dist(p.x, p.y, m.entry.x, m.entry.y) < 13) continue;
    if (dist(p.x, p.y, boss.x, boss.y) < 11) continue;
    if (camps.some((c) => dist(c.x, c.y, p.x, p.y) < 9)) continue;
    camps.push(p);
  }
  for (const c of camps) {
    stamp(c.x, c.y, 3.4, (x, y) => (reserved[I(x, y)] = 1));
    let best = pathSamples[0];
    let bd = 1e9;
    for (const s of pathSamples) {
      const d = dist(s.x, s.y, c.x, c.y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    carve([c, best], 0.7, 1.6);
  }
  stamp(boss.x, boss.y, 6.5, (x, y) => (reserved[I(x, y)] = 1));
  stamp(boss.x, boss.y, 4.5, (x, y) => (m.tiles[I(x, y)] = T_DARK));

  // lakes
  let waterCount = 0;
  const setWater = (x: number, y: number, deep: boolean) => {
    if (reserved[I(x, y)] || x < 3 || y < 3 || x >= W - 3 || y >= H - 3) return;
    m.tiles[I(x, y)] = deep ? T_DEEP : T_WATER;
    m.solid[I(x, y)] = 1;
    waterCount++;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = nW.fbm(x * 0.06, y * 0.06, 3);
      if (v > 0.66) setWater(x, y, v > 0.73);
    }
  for (let tries = 0; waterCount < 40 && tries < 50; tries++) {
    const cx = r.range(8, W - 8);
    const cy = r.range(10, H - 10);
    if (reserved[I(Math.floor(cx), Math.floor(cy))]) continue;
    const rx = r.range(3, 5);
    for (let y = Math.floor(cy - 5); y <= cy + 5; y++)
      for (let x = Math.floor(cx - 6); x <= cx + 6; x++) {
        if (!inside(x, y)) continue;
        const e = ((x - cx) / rx) ** 2 + ((y - cy) / (rx * 0.75)) ** 2;
        if (e < 1) setWater(x, y, e < 0.4);
      }
  }
  // shores
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const t = m.tiles[I(x, y)];
      if (t === T_WATER || t === T_DEEP || t === T_PATH) continue;
      const nearWater = [I(x + 1, y), I(x - 1, y), I(x, y + 1), I(x, y - 1)].some((i) => m.tiles[i] === T_WATER || m.tiles[i] === T_DEEP);
      if (nearWater && r.chance(0.7)) m.tiles[I(x, y)] = T_SAND;
    }

  // impassable border, dense with trees
  const treeKinds = def.biome.treeKinds;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const border = x < 2 || y < 2 || x >= W - 2 || y >= H - 2;
      if (!border || m.tiles[I(x, y)] === T_PATH) continue;
      m.tiles[I(x, y)] = T_DARK;
      m.solid[I(x, y)] = 1;
      m.opaque[I(x, y)] = 1;
      const inner = x === 1 || y === 1 || x === W - 2 || y === H - 2;
      if (inner || r.chance(0.5)) addProp(m, 'tree', x, y, r, { label: r.pick(treeKinds), solid: true });
    }

  // forests and decor
  for (let y = 2; y < H - 2; y++)
    for (let x = 2; x < W - 2; x++) {
      const i = I(x, y);
      if (reserved[i] || m.solid[i] || m.tiles[i] === T_SAND) continue;
      const f = nF.fbm(x * 0.09, y * 0.09);
      if ((f > 0.6 && r.chance(0.5)) || r.chance(0.025)) {
        addProp(m, 'tree', x, y, r, { label: r.pick(treeKinds), solid: true });
        continue;
      }
      if (r.chance(0.05)) {
        const k = r.pick(def.biome.decor);
        addProp(m, k, x, y, r);
      }
    }
  // a little decor in camps
  for (const c of camps) {
    if (r.chance(0.6)) {
      const x = Math.floor(c.x + r.range(-2, 2));
      const y = Math.floor(c.y + r.range(-2, 2));
      if (!m.solid[I(x, y)]) addProp(m, r.chance(0.5) ? 'barrel' : 'crate', x, y, r, { solid: true });
    }
  }

  // resource nodes
  const nodeAt = new Set<number>();
  const placeNodes = (items: string[], count: number, kind: 'solid' | 'herb') => {
    let placed = 0;
    for (let a = 0; a < 3000 && placed < count; a++) {
      const x = r.int(3, W - 4);
      const y = r.int(6, H - 5);
      const i = I(x, y);
      if (m.solid[i] || nodeAt.has(i) || m.tiles[i] === T_WATER || m.tiles[i] === T_DEEP) continue;
      if (kind === 'solid' && reserved[i] && m.tiles[i] === T_PATH) continue;
      // must be close to a reserved (walkable) area so the player can reach it
      let near = false;
      for (let oy = -2; oy <= 2 && !near; oy++) for (let ox = -2; ox <= 2 && !near; ox++) if (inside(x + ox, y + oy) && reserved[I(x + ox, y + oy)]) near = true;
      if (!near) continue;
      if ([...nodeAt].some((j) => dist(j % W, (j / W) | 0, x, y) < 4)) continue;
      const weights = items.map((it, k) => [it, items.length - k + 1] as [string, number]);
      const item = r.weighted(weights);
      const nd = nodeForItem(item);
      if (!nd) continue;
      nodeAt.add(i);
      m.nodes.push({ id: `${def.id}:n${m.nodes.length}`, nodeId: nd.id, x: x + 0.5, y: y + 0.5, variant: TREE_FOR_LOG[item] ?? '' });
      if (kind === 'solid') {
        m.solid[i] = 1;
        m.opaque[i] = 1;
      }
      placed++;
    }
  };
  placeNodes(def.trees, 12, 'solid');
  placeNodes(def.ores, 10, 'solid');
  placeNodes(def.herbs, 9, 'herb');
  // fishing spots: shallow water beside walkable ground
  let fish = 0;
  for (let a = 0; a < 4000 && fish < 6; a++) {
    const x = r.int(3, W - 4);
    const y = r.int(3, H - 4);
    if (m.tiles[I(x, y)] !== T_WATER) continue;
    const land = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => !m.solid[I(x + ox, y + oy)]);
    if (!land) continue;
    if (m.nodes.some((n) => dist(n.x, n.y, x, y) < 6)) continue;
    const item = r.weighted(def.fish.map((it, k) => [it, def.fish.length - k + 1] as [string, number]));
    const nd = nodeForItem(item)!;
    m.nodes.push({ id: `${def.id}:n${m.nodes.length}`, nodeId: nd.id, x: x + 0.5, y: y + 0.5, variant: 'fish' });
    fish++;
  }

  // enemies
  const [lo, hi] = def.level;
  const lvlAt = (y: number) => Math.round(lo + (hi - lo) * clamp(1 - (y - 12) / (H - 24), 0, 1));
  const freeSpot = (cx: number, cy: number, rad: number): { x: number; y: number } | null => {
    for (let a = 0; a < 20; a++) {
      const x = cx + r.range(-rad, rad);
      const y = cy + r.range(-rad, rad);
      if (!m.solid[I(Math.floor(x), Math.floor(y))]) return { x, y };
    }
    return null;
  };
  camps.forEach((c, ci) => {
    const level = lvlAt(c.y);
    m.campSpots.push({ x: c.x, y: c.y, level });
    const n = r.int(3, 5);
    const eliteIdx = r.chance(0.2) ? 0 : -1;
    for (let j = 0; j < n; j++) {
      const p = freeSpot(c.x, c.y, 2.2);
      if (!p) continue;
      m.spawns.push({ id: `${def.id}:c${ci}:${j}`, enemyId: r.weighted(def.roster), x: p.x, y: p.y, level, elite: j === eliteIdx, pack: ci });
    }
  });
  let wanderers = 0;
  for (let a = 0; a < 200 && wanderers < 8; a++) {
    const s = r.pick(pathSamples);
    if (dist(s.x, s.y, m.entry.x, m.entry.y) < 12 || dist(s.x, s.y, boss.x, boss.y) < 9 || s.y < 6) continue;
    const p = freeSpot(s.x, s.y, 2);
    if (!p) continue;
    m.spawns.push({ id: `${def.id}:w${wanderers}`, enemyId: r.weighted(def.roster), x: p.x, y: p.y, level: lvlAt(p.y), pack: 100 + wanderers });
    wanderers++;
  }
  m.spawns.push({ id: `${def.id}:boss`, enemyId: def.boss, x: boss.x, y: boss.y, level: hi + 1, boss: true, pack: 999 });

  // drop anything unreachable
  const reach = floodReachable(m, m.entry.x, m.entry.y);
  m.spawns = m.spawns.filter((s) => reach[I(Math.floor(s.x), Math.floor(s.y))]);
  m.nodes = m.nodes.filter((n) => {
    const x = Math.floor(n.x);
    const y = Math.floor(n.y);
    return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([ox, oy]) => inside(x + ox, y + oy) && reach[I(x + ox, y + oy)]);
  });

  // exits
  const prev = prevZoneId(def.id);
  m.exits.push({ x0: mid - 2, y0: H - 1, x1: mid + 3, y1: H, to: prev, label: `To ${zoneName(prev)}` });
  const nz = nextZone(def.id);
  if (nz) m.exits.push({ x0: mid - 2, y0: 0, x1: mid + 3, y1: 1, to: nz.id, label: `To ${nz.name}` });
  else {
    // the final zone ends at the mountain: wall off the far path
    for (let y = 0; y < 3; y++) for (let x = mid - 3; x <= mid + 3; x++) {
      m.solid[I(x, y)] = 1;
      m.opaque[I(x, y)] = 1;
      m.tiles[I(x, y)] = T_DARK;
    }
  }
  return m;
}

// --------------------------------------------------------------------- town

export const TOWN_SIZE = 40;

export function generateTown(townLevel: number): ZoneMap {
  const W = TOWN_SIZE;
  const H = TOWN_SIZE;
  const r = new Rng('town');
  const nA = new Noise2D('town:a');
  const m = blank(TOWN_ID, W, H, TOWN_BIOME, [0, 0]);
  m.isTown = true;
  const I = (x: number, y: number) => y * W + x;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m.shade[I(x, y)] = clamp(Math.floor(nA.fbm(x * 0.15, y * 0.15) * 4.6 - 0.3), 0, 3);
  const fill = (x0: number, y0: number, x1: number, y1: number, t: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.tiles[I(x, y)] = t;
  };
  const block = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        m.solid[I(x, y)] = 1;
        m.opaque[I(x, y)] = 1;
      }
  };

  // roads and plaza
  fill(24, 0, 27, 18, T_PATH);
  fill(15, 17, 29, 28, T_PLAZA);
  fill(11, 20, 15, 23, T_PATH); // to merchant
  fill(13, 23, 15, 31, T_PATH); // to inn
  fill(29, 15, 33, 17, T_PATH); // to smithy
  fill(28, 22, 34, 25, T_PATH); // to warehouse
  fill(28, 27, 31, 33, T_PATH); // to town hall
  fill(19, 28, 21, 34, T_PATH); // to herbalist
  fill(15, 16, 20, 17, T_PATH); // to guild

  // pond
  for (let y = 29; y < 36; y++)
    for (let x = 21; x < 28; x++) {
      const e = ((x + 0.5 - 24.5) / 3.4) ** 2 + ((y + 0.5 - 32.5) / 2.6) ** 2;
      if (e < 1) {
        m.tiles[I(x, y)] = e < 0.35 ? T_DEEP : T_WATER;
        m.solid[I(x, y)] = 1;
      } else if (e < 1.5) m.tiles[I(x, y)] = T_SAND;
    }

  // walls with a gate on the upper-right edge
  const stone = townLevel >= 3;
  for (let i = 3; i <= 36; i++) {
    for (const [x, y] of [[i, 3], [i, 36], [3, i], [36, i]] as [number, number][]) {
      if (y === 3 && x >= 24 && x <= 26) continue;
      block(x, y, x + 1, y + 1);
      m.props.push({ kind: 'wall', x: x + 0.5, y: y + 0.5, variant: stone ? 1 : 0, seed: x * 31 + y, depth: x + y + 1 });
    }
  }
  for (const [x, y] of [[3, 3], [36, 3], [3, 36], [36, 36], [23, 3], [27, 3]] as [number, number][]) {
    m.props.push({ kind: 'tower', x: x + 0.5, y: y + 0.5, variant: stone ? 1 : 0, seed: x + y, depth: x + y + 1.05 });
  }
  // the outside beyond the walls is dark forest
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (x >= 3 && y >= 3 && x <= 36 && y <= 36) continue;
      if (m.tiles[I(x, y)] === T_PATH) continue;
      m.tiles[I(x, y)] = T_DARK;
      block(x, y, x + 1, y + 1);
      if ((x + y) % 2 === 0 || r.chance(0.4)) m.props.push({ kind: 'tree', x: x + 0.5, y: y + 0.5, variant: r.int(0, 3), seed: r.int(0, 1e6), depth: x + y + 1, label: r.chance(0.3) ? 'pine' : 'oak' });
    }
  // the gate road is open beyond the wall
  fill(24, 0, 27, 3, T_PATH);
  for (let y = 0; y < 3; y++) for (let x = 24; x < 27; x++) {
    m.solid[I(x, y)] = 0;
    m.opaque[I(x, y)] = 0;
  }
  m.props = m.props.filter((p) => !(p.kind === 'tree' && p.x > 24 && p.x < 27 && p.y < 3));

  // buildings (square footprints keep depth sorting correct)
  const building = (x0: number, y0: number, s: number, label: string, wall: string, roof: string, height: number, variant = 0) => {
    block(x0, y0, x0 + s, y0 + s);
    m.props.push({ kind: 'building', x: x0, y: y0, w: s, h: s, variant, seed: x0 * 7 + y0, depth: x0 + s + y0, label, wall, roof, height });
  };
  building(12, 8, 8, "Adventurer's Guild", '#c9b48a', '#2a4d8b', 120, 1);
  building(29, 10, 5, 'Smithy', '#8a7a6a', '#5a3a2a', 70, 2);
  building(6, 19, 5, 'General Store', '#d8c49a', '#7a3a2a', 70);
  building(6, 27, 6, 'The Wandering Boar', '#c8a878', '#6a4a2a', 85, 3);
  building(30, 18, 5, 'Warehouse', '#9a8460', '#4a5a3a', 70);
  building(29, 27, 5, 'Town Hall', '#e0d6c0', '#2e7d5a', 95, 4);
  building(15, 31, 4, "Maren's Hut", '#a89070', '#4a6a2a', 55);

  // features
  const prop = (kind: PropKind, x: number, y: number, extra: Partial<Prop> = {}) => {
    const p: Prop = { kind, x: x + 0.5, y: y + 0.5, variant: 0, seed: x * 13 + y, depth: x + y + 1, ...extra };
    m.props.push(p);
    if (extra.solid !== false && kind !== 'flowers' && kind !== 'banner' && kind !== 'lamp') block(x, y, x + 1, y + 1);
    return p;
  };
  // fountain (2x2)
  block(19, 21, 21, 23);
  m.props.push({ kind: 'fountain', x: 19, y: 21, w: 2, h: 2, variant: 0, seed: 1, depth: 21 + 21 });
  prop('board', 20, 14, { label: 'Bounty Board' });
  prop('anvil', 30, 16);
  prop('range', 13, 31);
  prop('chest', 31, 24, { label: 'Storage' });
  prop('stash', 33, 24, { label: 'Guild Vault' });
  prop('well', 16, 25);
  prop('stall', 11, 25);
  for (const [x, y] of [[23, 17], [28, 17], [15, 27], [23, 27], [24, 6], [27, 8], [11, 18]] as [number, number][]) prop('lamp', x, y, { solid: false });
  for (const [x, y] of [[21, 7], [28, 6], [14, 17]] as [number, number][]) prop('banner', x, y, { solid: false, color: '#2a4d8b' });
  for (const [x, y] of [[34, 15], [33, 16], [12, 19], [35, 23], [8, 25]] as [number, number][]) prop(r.chance(0.5) ? 'barrel' : 'crate', x, y);
  // gardens and trees
  for (let k = 0; k < 40; k++) {
    const x = r.int(4, 35);
    const y = r.int(4, 35);
    const i = I(x, y);
    if (m.solid[i] || m.tiles[i] !== T_GRASS) continue;
    if (Math.abs(x - 25) < 3 && y < 18) continue;
    prop(r.chance(0.6) ? 'flowers' : 'bush', x, y, { solid: false, variant: r.int(0, 3) });
  }
  for (const [x, y] of [[5, 5], [8, 5], [33, 34], [35, 30], [4, 34], [5, 16]] as [number, number][]) prop('tree', x, y, { label: 'oak', variant: r.int(0, 3) });

  // practice gathering nodes inside the walls
  const nodes: NodeSpawn[] = [
    { id: 'town:oak1', nodeId: 'oak_tree', x: 6.5, y: 13.5, variant: 'oak' },
    { id: 'town:oak2', nodeId: 'oak_tree', x: 8.5, y: 11.5, variant: 'oak' },
    { id: 'town:copper', nodeId: 'copper_vein', x: 34.5, y: 6.5, variant: '' },
    { id: 'town:herb', nodeId: 'meadowleaf_patch', x: 13.5, y: 34.5, variant: '' },
    { id: 'town:fish', nodeId: 'trout_pool', x: 24.5, y: 30.5, variant: 'fish' },
  ];
  for (const n of nodes) {
    const i = I(Math.floor(n.x), Math.floor(n.y));
    if (n.variant !== 'fish' && !n.nodeId.endsWith('patch')) {
      m.solid[i] = 1;
      m.opaque[i] = 1;
    }
    m.nodes.push(n);
  }

  m.stations = [
    { kind: 'board', x: 20.5, y: 14.5 },
    { kind: 'anvil', x: 30.5, y: 16.5 },
    { kind: 'range', x: 13.5, y: 31.5 },
    { kind: 'chest', x: 31.5, y: 24.5 },
    { kind: 'stash', x: 33.5, y: 24.5 },
    { kind: 'waystone', x: 25.5, y: 21.5 },
  ];
  m.waystone = { x: 25.5, y: 21.5 };
  block(25, 21, 26, 22);
  m.entry = { x: 25.5, y: 5.5 };
  m.backEntry = { x: 25.5, y: 5.5 };
  m.exits.push({ x0: 24, y0: 0, x1: 27, y1: 1, to: ZONES[0].id, label: `To ${ZONES[0].name}` });
  // guard posts used for patrols and raids
  m.campSpots = [{ x: 25.5, y: 9, level: 1 }];
  void T_FLOOR;
  return m;
}

export function guardPosts(): { x: number; y: number }[] {
  return [
    { x: 23.5, y: 4.8 }, { x: 27.5, y: 4.8 }, { x: 22, y: 19 }, { x: 28, y: 26 }, { x: 17, y: 26 }, { x: 25.5, y: 12 },
  ];
}

export function spawnsFor(map: ZoneMap): SpawnDef[] {
  return map.spawns;
}

const zoneCache = new Map<string, ZoneMap>();
export function getZoneMap(id: string, townLevel: number): ZoneMap {
  if (id === TOWN_ID) {
    const key = 'town:' + (townLevel >= 3 ? 1 : 0);
    let t = zoneCache.get(key);
    if (!t) zoneCache.set(key, (t = generateTown(townLevel)));
    return t;
  }
  let z = zoneCache.get(id);
  if (!z) {
    const def = ZONES.find((d) => d.id === id);
    if (!def) throw new Error('Unknown zone ' + id);
    zoneCache.set(id, (z = generateZone(def)));
  }
  return z;
}
