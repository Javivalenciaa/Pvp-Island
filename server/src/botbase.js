// Bases de bots: las tribus de bots eligen un terreno llano, levantan una base real (cimientos, paredes, puerta, techo),
// guardan lo que recolectan en un arcón, la mejoran, fabrican bombas, buscan otras bases y las raidean (o las defienden).
// Todo pasa por las mismas piezas autoritativas que usa un jugador (Buildings / Deps), así que un humano puede visitarlas, raidearlas y robarlas.
import { GRID, LEVEL_H, PIECE_HP, TIER_MULT, pieceCenter } from './buildings.js';
import { walk, turn, stand, setMode, rnd, pick, yawTo } from './bots.js';

export const TRIBE_NAMES = ['Fenrir', 'Ravn', 'Skadi', 'Ymir', 'Mjolnir', 'Valkyr', 'Odal', 'Hugin'];
export const isBotTid = (tid) => typeof tid === 'string' && tid.startsWith('tb');
export const BASE_MODES = new Set(['build', 'deposit', 'raid']);
const fKey = (i, j) => `F${i},${j}`, wKey = (d, i, j, L) => `W${d}${i},${j},${L}`, cKey = (i, j, L) => `C${i},${j},${L}`;
const UNITS = { foundation: 1.5, wall: 1, door: 1, ceiling: 1 };
const TIER_COST = [['wood', 8], ['wood', 40], ['stone', 60], ['ingot', 6]];
const cost = (kind, tier) => { const [r, n] = TIER_COST[tier]; return { [r]: Math.ceil(n * UNITS[kind]) }; };
const POOL_ITEM = { wood: 'wood', stone: 'stone', fiber: 'fiber', ore: 'ore', sulfur: 'sulfur', ingot: 'ingot', meat: 'raw_meat', food: 'berries', bomb: 'bomb', arrow: 'arrow', bandage: 'bandage' };
const ITEM_POOL = Object.fromEntries(Object.entries(POOL_ITEM).map(([k, v]) => [v, k]));
const POOL_CAP = { wood: 900, stone: 700, fiber: 200, ore: 300, sulfur: 200, ingot: 60, meat: 40, food: 60, bomb: 12, arrow: 60, bandage: 20 };
const NOW = (room) => room.t;

// ---------------------------------------------------------------- estado por sala y por tribu
function S(room) {
  if (room._bb) return room._bb;
  const W = room.world, grid = new Map(), C = 12, key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  W.nodes.forEach((n, i) => { n.id = i; const k = key(Math.floor(n.x / C), Math.floor(n.z / C)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(n); });
  return (room._bb = { grid, C, key, bt: new Map(), bases: new Map(), baseT: -99, slow: 0, doorT: 0 });
}
export function botTribe(room, tid, idx) {
  const s = S(room); let bt = s.bt.get(tid);
  const info = room.tribeInfo.get(tid) || {};
  if (!bt) { bt = { tid, idx: idx ?? (+tid.slice(2) || 0), base: null, plan: null, pool: {}, known: new Set(), raid: null, lastRaid: room.t - rnd(0, 120), scoutT: 0, siteT: 0, chestId: 0, bedId: 0, made: 0, built: false }; s.bt.set(tid, bt); }
  if (idx != null) bt.idx = idx;
  if (!info.base && bt.base) info.base = bt.base; else if (info.base && !bt.base) { bt.base = info.base; bt.plan = genPlan(bt.base); adopt(room, bt); }
  if (info.pool && !Object.keys(bt.pool).length) bt.pool = { ...info.pool };
  info.name = 'Clan ' + TRIBE_NAMES[bt.idx % TRIBE_NAMES.length]; info.owner = null; info.bot = true; info.base = bt.base; info.pool = bt.pool;
  room.tribeInfo.set(tid, info); return bt;
}
// recupera una base guardada en disco: reconoce arcón, cama, banco y fogata, y si estaba completa
function adopt(room, bt) {
  bt.built = planDone(room, bt);
  for (const d of room.D.map.values()) if (d.owner === bt.tid) { if (d.t === 'chest') bt.chestId = d.id; else if (d.t === 'bed') bt.bedId = d.id; else if (d.t === 'workbench') bt.bench = d.id; else if (d.t === 'campfire') bt.camp = d.id; else if (d.t === 'spikes') (bt.spikes = bt.spikes || []).push(d.id); }
}
const tribeOf = (room, p) => (isBotTid(p.tid) ? S(room).bt.get(p.tid) || botTribe(room, p.tid) : null);
const members = (room, tid) => [...room.players.values()].filter((q) => q.tid === tid && q.bot && q.dead <= 0);

// ---------------------------------------------------------------- pool (lo que guarda la tribu) y espejo en el arcón
const poolTotal = (bt, k) => bt.pool[k] || 0;
function addPool(room, bt, k, n) { if (!POOL_CAP[k] || !(n > 0)) return 0; const cur = bt.pool[k] || 0, add = Math.min(n, POOL_CAP[k] - cur); if (add > 0) { bt.pool[k] = cur + add; bt.dirty = true; } return add; }
function chestOf(room, bt) { const d = bt.chestId && room.D.map.get(bt.chestId); return d && d.t === 'chest' ? d : null; }
function syncChest(room, bt) {
  bt.dirty = false; const d = chestOf(room, bt); if (!d) return;
  const slots = []; for (const k in bt.pool) { let n = Math.floor(bt.pool[k] || 0); const id = POOL_ITEM[k]; if (!id) continue; while (n > 0 && slots.length < 24) { const q = Math.min(n, id === 'bomb' ? 5 : 100); slots.push({ id, n: q }); n -= q; } }
  while (slots.length < 24) slots.push(null); d.slots = slots;
}
// paga `c` con la reserva de la tribu y, si no basta, con lo que lleva el bot
function afford(bt, b, c) { for (const k in c) if ((bt.pool[k] || 0) + (b ? b.inv[k] || 0 : 0) < c[k]) return false; return true; }
function pay(room, bt, b, c) { for (const k in c) { let n = c[k]; const fromPool = Math.min(n, bt.pool[k] || 0); bt.pool[k] = (bt.pool[k] || 0) - fromPool; n -= fromPool; if (n > 0 && b) b.inv[k] -= n; } bt.dirty = true; }

// ---------------------------------------------------------------- bases existentes en el mundo
export function bases(room, force) {
  const s = S(room); if (!force && room.t - s.baseT < 3) return s.bases; s.baseT = room.t; const m = new Map();
  for (const q of room.B.map.values()) {
    let o = m.get(q.owner); if (!o) m.set(q.owner, o = { tid: q.owner, x: 0, y: 0, z: 0, f: 0, n: 0, hp: 0, max: 0, minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9 });
    o.n++; o.hp += q.hp; o.max += room.B.maxHp(q);
    if (q.kind === 'foundation') { const c = pieceCenter(q); o.x += c.x; o.y += q.top; o.z += c.z; o.f++; o.minX = Math.min(o.minX, c.x); o.maxX = Math.max(o.maxX, c.x); o.minZ = Math.min(o.minZ, c.z); o.maxZ = Math.max(o.maxZ, c.z); }
  }
  for (const o of m.values()) { o.x /= o.f; o.y /= o.f; o.z /= o.f; }
  for (const d of room.D.map.values()) if (d.t === 'chest') { let o = m.get(d.owner); if (!o) m.set(d.owner, o = { tid: d.owner, x: d.x, y: d.y, z: d.z, f: 0, n: 0, hp: 0, max: 0, ruin: true }); (o.chests = o.chests || []).push(d); }
  for (const o of m.values()) { o.bot = isBotTid(o.tid); o.chests = o.chests || []; const ti = room.tribeInfo.get(o.tid); o.name = ti ? ti.name : null; }
  for (const o of m.values()) {
    o.online = false; o.owners = []; for (const q of room.players.values()) if (q.tid === o.tid && !q.bot) { o.owners.push(q); if (q.ws && q.ws.readyState === 1 && q.dead <= 0) o.online = true; }
    if (!o.name) { const h = o.owners[0]; o.name = h ? h.name : (room.names && room.names.get(o.tid)) || '???'; }
  }
  return (s.bases = m);
}

// ---------------------------------------------------------------- elegir terreno y plano de la base
function nodeNear(room, x0, x1, z0, z1, pad) {
  const s = S(room), c0 = Math.floor((x0 - pad) / s.C), c1 = Math.floor((x1 + pad) / s.C), d0 = Math.floor((z0 - pad) / s.C), d1 = Math.floor((z1 + pad) / s.C);
  for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) { const a = s.grid.get(s.key(cx, cz)); if (!a) continue; for (const n of a) { if (room.nodes.has(n.id)) continue; if (n.x > x0 - pad && n.x < x1 + pad && n.z > z0 - pad && n.z < z1 + pad) return true; } }
  return false;
}
function siteInfo(room, i0, j0, w, h, mine, gap = 60, bs = null) {
  const T = room.T, W = room.world; let tMax = -1e9, tMin = 1e9;
  for (let a = 0; a <= w; a++) for (let b = 0; b <= h; b++) { const y = T.terrainH((i0 + a) * GRID, (j0 + b) * GRID); tMax = Math.max(tMax, y); tMin = Math.min(tMin, y); }
  const cx = (i0 + w / 2) * GRID, cz = (j0 + h / 2) * GRID, x0 = i0 * GRID, x1 = (i0 + w) * GRID, z0 = j0 * GRID, z1 = (j0 + h) * GRID;
  if (tMax < 1.8 || tMax > 22 || tMax - tMin > 1.8 || T.slopeAt(cx, cz) > .36) return null;
  if (T.nearLake(cx, cz, 1.12 + Math.max(w, h) * .6) || T.nearLake(x0, z0, 1.2) || T.nearLake(x1, z1, 1.2) || T.nearLake(x0, z1, 1.2) || T.nearLake(x1, z0, 1.2)) return null;
  if (nodeNear(room, x0, x1, z0, z1, 3)) return null;
  for (const q of W.POIS) if (Math.hypot(q.x - cx, q.z - cz) < q.r + 16) return null;
  if (Math.hypot(W.SPAWN.x - cx, W.SPAWN.z - cz) < 22) return null;
  for (const c of T.CAVES) if (Math.hypot(cx - (c.x + c.dx * 12), cz - (c.z + c.dz * 12)) < 36) return null;
  for (const o of (bs || bases(room, true).values())) if (Math.hypot(o.x - cx, o.z - cz) < (o.tid === mine ? 5 : gap)) return null;
  for (let a = -1; a <= w; a++) for (let b = -1; b <= h; b++) if (room.B.map.has(fKey(i0 + a, j0 + b))) return null;
  return { top: tMax + .2, tMin, cx, cz };
}
export function pickSite(room, near, rMin, rMax, tries = 160, gap = 60) {
  const half = room.half * .8, bs = [...bases(room, true).values()];
  for (let t = 0; t < tries; t++) {
    const w = Math.random() < .55 ? 2 : 3, h = 2; let x, z;
    if (near) { const a = Math.random() * 6.283, r = rMin + Math.random() * (rMax - rMin); x = near.x + Math.cos(a) * r; z = near.z + Math.sin(a) * r; } else { const a = Math.random() * 6.283, r = room.half * (.18 + Math.random() * .5); x = Math.cos(a) * r; z = Math.sin(a) * r; }
    if (Math.hypot(x, z) > half) continue;
    const i0 = Math.floor(x / GRID), j0 = Math.floor(z / GRID), info = siteInfo(room, i0, j0, w, h, null, gap, bs);
    if (info) return { i0, j0, w, h, top: info.top, face: pick(['n', 's', 'e', 'w']) };
  }
  return null;
}
function genPlan(base) {
  const { i0, j0, w, h, top, face } = base, steps = [];
  for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) steps.push({ kind: 'foundation', i: i0 + a, j: j0 + b });
  // puerta en el centro del lado `face` (n = z mínimo, s = z máximo, w = x mínimo, e = x máximo)
  const edges = [];
  for (let a = 0; a < w; a++) { edges.push({ d: 'h', i: i0 + a, j: j0, side: 'n' }, { d: 'h', i: i0 + a, j: j0 + h, side: 's' }); }
  for (let b = 0; b < h; b++) { edges.push({ d: 'v', i: i0, j: j0 + b, side: 'w' }, { d: 'v', i: i0 + w, j: j0 + b, side: 'e' }); }
  const side = edges.filter((e) => e.side === face), door = side[Math.floor(side.length / 2)] || edges[0];
  for (const e of edges) if (e !== door) steps.push({ kind: 'wall', d: e.d, i: e.i, j: e.j });
  steps.push({ kind: 'door', d: door.d, i: door.i, j: door.j });
  for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) steps.push({ kind: 'ceiling', i: i0 + a, j: j0 + b });
  base.door = { d: door.d, i: door.i, j: door.j, side: door.side };
  return steps;
}
const stepKey = (s) => (s.kind === 'foundation' ? fKey(s.i, s.j) : s.kind === 'ceiling' ? cKey(s.i, s.j, 0) : wKey(s.d, s.i, s.j, 0));
const NORMAL = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
function doorPos(base) { const dd = base.door, c = dd.d === 'h' ? { x: dd.i * GRID + 1.5, z: dd.j * GRID } : { x: dd.i * GRID, z: dd.j * GRID + 1.5 }; return { ...c, n: NORMAL[dd.side] }; }
function cellsOf(base) { const out = []; for (let a = 0; a < base.w; a++) for (let b = 0; b < base.h; b++) out.push({ x: (base.i0 + a) * GRID + 1.5, z: (base.j0 + b) * GRID + 1.5 }); return out; }
function layout(base) {
  const dp = doorPos(base), cells = cellsOf(base).sort((a, b) => Math.hypot(b.x - dp.x, b.z - dp.z) - Math.hypot(a.x - dp.x, a.z - dp.z));
  return { door: dp, chest: { x: cells[0].x - (dp.n[0] || 0) * -0.0 + (dp.n[1] ? 0.8 : 0), z: cells[0].z + (dp.n[0] ? 0.8 : 0) }, bed: cells[1] || cells[0], bench: cells[2] || cells[0] };
}

// ---------------------------------------------------------------- colocar piezas (misma validación que un jugador)
function placeStep(room, bt, st, tier = 0) {
  const base = bt.base, d = { kind: st.kind, i: st.i, j: st.j, L: 0, dir: st.d, top: base.top };
  if (st.kind === 'foundation') { let tMin = 1e9; for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) tMin = Math.min(tMin, room.T.terrainH((st.i + a) * GRID, (st.j + b) * GRID)); d.bottom = tMin - .6; }
  const res = room.B.place(d, bt.tid, room.B.countOf(bt.tid)); if (!res.ok) return false;
  const q = res.p; q.tier = tier; q.hp = room.B.maxHp(q);
  room.broadcast({ t: 'pb', p: room.B.pub(q) }); if (tier) room.broadcast({ t: 'pu', key: q.key, tier, hp: Math.round(q.hp) });
  return true;
}
function upgradePiece(room, q, tier) { q.tier = tier; q.hp = room.B.maxHp(q); room.broadcast({ t: 'pu', key: q.key, tier, hp: Math.round(q.hp) }); }
function addDep(room, bt, t, x, z, y, r = 0) { const d = room.D.add(t, x, y, z, r, bt.tid); if (d) room.broadcast({ t: 'db', d: room.D.pub(d) }); return d; }
function furnish(room, bt) {
  const L = layout(bt.base), top = bt.base.top, dp = L.door;
  if (!chestOf(room, bt)) { const c = addDep(room, bt, 'chest', L.chest.x, L.chest.z, top); if (c) { bt.chestId = c.id; bt.dirty = true; } }
  if (!(bt.bedId && room.D.map.has(bt.bedId))) { const b = addDep(room, bt, 'bed', L.bed.x, L.bed.z, top, Math.random() * 6); if (b) bt.bedId = b.id; }
  if (!bt.bench || !room.D.map.has(bt.bench)) { const b = addDep(room, bt, 'workbench', L.bench.x + 0.9, L.bench.z - .6, top); if (b) bt.bench = b.id; }
  if (!bt.camp || !room.D.map.has(bt.camp)) { const o = 3.4, px = dp.x + dp.n[0] * o + (dp.n[1] ? 2.4 : 0), pz = dp.z + dp.n[1] * o + (dp.n[0] ? 2.4 : 0), b = addDep(room, bt, 'campfire', px, pz, room.T.terrainH(px, pz)); if (b) bt.camp = b.id; }
  if (!bt.spikes || bt.spikes.some((id) => !room.D.map.has(id))) { bt.spikes = []; for (const sgn of [-1, 1]) { const o = 2.6, px = dp.x + dp.n[0] * o + (dp.n[1] ? 1.6 * sgn : 0), pz = dp.z + dp.n[1] * o + (dp.n[0] ? 1.6 * sgn : 0), b = addDep(room, bt, 'spikes', px, pz, room.T.terrainH(px, pz), Math.atan2(dp.n[0], dp.n[1])); if (b) bt.spikes.push(b.id); } }
  syncChest(room, bt);
}
const planDone = (room, bt) => bt.plan.every((s) => room.B.map.has(stepKey(s)));
const nextStep = (room, bt) => bt.plan.find((s) => !room.B.map.has(stepKey(s)));
// qué mejora toca: paredes y puerta a madera, luego techo; después piedra
function nextUpgrade(room, bt) {
  let best = null;
  for (const s of bt.plan) { const q = room.B.map.get(stepKey(s)); if (!q || q.kind === 'foundation') continue; const goal = q.kind === 'ceiling' ? 1 : (bt.upgradeGoal || 1); if (q.tier < goal && (!best || q.tier < best.tier || (q.kind === 'door' && q.tier <= best.tier))) best = q; }
  return best;
}

// ---------------------------------------------------------------- bases iniciales (arranque en frío) y reconstrucción
export function seedBase(room, tid, idx, near) {
  const bt = botTribe(room, tid, idx); if (bt.base && planDone(room, bt)) return bt;
  if (!bt.base) { const site = pickSite(room, near || null, 60, 220, 900, 120) || pickSite(room, near || null, 60, 220, 600, 70); if (!site) return null; bt.base = site; bt.plan = genPlan(site); }
  if (!bt.plan) bt.plan = genPlan(bt.base);
  for (const st of bt.plan) if (!room.B.map.has(stepKey(st))) placeStep(room, bt, st, 0);
  const tier = Math.random() < .5 ? 1 : 0;
  for (const st of bt.plan) { const q = room.B.map.get(stepKey(st)); if (q && q.kind !== 'foundation' && q.kind !== 'ceiling' && q.tier < tier) upgradePiece(room, q, tier); }
  bt.built = true; furnish(room, bt);
  const loot = { wood: 40 + Math.random() * 80, stone: 20 + Math.random() * 50, fiber: 6 + Math.random() * 14, food: 3 + Math.random() * 8, arrow: Math.random() < .5 ? 6 + Math.random() * 14 : 0, bandage: Math.random() < .5 ? 1 + Math.random() * 3 : 0, ingot: Math.random() < .35 ? 1 + Math.random() * 3 : 0, bomb: Math.random() < .25 ? 1 : 0 };
  for (const k in loot) addPool(room, bt, k, Math.floor(loot[k])); syncChest(room, bt);
  room.tribeInfo.get(tid).base = bt.base; room.tribeInfo.get(tid).pool = bt.pool; return bt;
}
export function seedBases(room, tribes) { let n = 0; for (let i = 0; i < tribes; i++) if (seedBase(room, 'tb' + i, i)) n++; return n; }

// ---------------------------------------------------------------- movimiento de bots: alturas de cimientos y colisión con paredes
export function groundAt(room, x, z) {
  const f = room.B.map.size ? room.B.map.get(fKey(Math.floor(x / GRID), Math.floor(z / GRID))) : null;
  const h = room.T.terrainH(x, z); return f && f.top > h - .2 ? f.top : h;
}
export const onFloor = (room, x, z) => room.B.map.size > 0 && room.B.map.has(fKey(Math.floor(x / GRID), Math.floor(z / GRID)));
export function blocked(room, x, z, y) {
  const B = room.B; if (!B.map.size) return false; const i = Math.floor(x / GRID), j = Math.floor(z / GRID), R = .45;
  const hit = (d, ei, ej) => {
    const w = B.map.get(wKey(d, ei, ej, 0)); if (!w || (w.kind === 'door' && w.open) || Math.abs(y - w.top) > 2.5) return false;
    return d === 'h' ? Math.abs(z - ej * GRID) < R && x > ei * GRID - R && x < ei * GRID + GRID + R : Math.abs(x - ei * GRID) < R && z > ej * GRID - R && z < ej * GRID + GRID + R;
  };
  return hit('h', i, j) || hit('h', i, j + 1) || hit('v', i, j) || hit('v', i + 1, j) || hit('h', i - 1, j) || hit('v', i, j - 1) || hit('h', i - 1, j + 1) || hit('v', i + 1, j - 1);
}

// ---------------------------------------------------------------- reparto de tareas para cada bot
const carrying = (b) => (b.inv.wood || 0) + (b.inv.stone || 0) + (b.inv.fiber || 0) + (b.inv.ore || 0) + (b.inv.sulfur || 0);
const wantMore = (bt, k, n) => (bt.pool[k] || 0) < n;
export function want(room, p, b) { // qué recursos necesita la tribu (solo cuando el bot ya tiene herramientas)
  const bt = tribeOf(room, p); if (!bt || b.gear === 'fists') return null;
  if (!bt.base || !bt.built) return (b.inv.wood + (bt.pool.wood || 0) < 160) ? ['tree'] : ['rock', 'tree'];
  const bombsAll = members(room, bt.tid).reduce((s, q) => s + ((q.ai && q.ai.bombs) || 0), 0) + (bt.pool.bomb || 0);
  if (bombsAll < 4 && b.gear !== 'stone_axe' && b.gear !== 'stone_pick' && b.gear !== 'hammer' && Math.random() < .45) return (b.inv.sulfur || 0) < 8 ? ['sulfur'] : (b.inv.fiber || 0) < 3 ? ['bush'] : ['tree'];
  const up = nextUpgrade(room, bt); if (up) { const need = cost(up.kind, up.tier + 1); const k = Object.keys(need)[0]; if (k === 'wood') return ['tree']; if (k === 'stone') return ['rock']; }
  return null;
}
export function choose(room, p, b) {
  const bt = tribeOf(room, p); if (!bt) return false; const t = room.t;
  // 1) raid en marcha de la tribu
  if (bt.raid && bt.raid.phase !== 'over' && (b.bombs > 0 || bt.raid.members.has(p.id)) && b.gear !== 'fists' && p.hp > 55) { bt.raid.members.add(p.id); b.rp = null; setMode(room, b, 'raid', 0); return true; }
  // 2) base: sitio, construcción, mejoras, reparación
  if (!bt.base) {
    if (t >= bt.siteT && b.gear !== 'fists' && (b.inv.wood + (bt.pool.wood || 0)) >= 70) { bt.siteT = t + 25; const leader = members(room, bt.tid)[0] || p; const site = pickSite(room, leader, 25, 90, 120); if (site) { bt.base = site; bt.plan = genPlan(site); room.tribeInfo.get(bt.tid).base = site; } }
    if (!bt.base) { if (carrying(b) >= 70 && false) return false; return false; }
  }
  const st = nextStep(room, bt), upg = !st && bt.built !== false ? nextUpgrade(room, bt) : null;
  const dmg = !st && !upg ? [...room.B.map.values()].find((q) => q.owner === bt.tid && q.hp < room.B.maxHp(q) * .7) : null;
  if (st || upg || dmg) {
    const c = st ? cost(st.kind, 0) : upg ? cost(upg.kind, upg.tier + 1) : { wood: 6 };
    if (afford(bt, b, c) && t >= (b.buildT || 0)) { b.job = { k: 'build' }; setMode(room, b, 'build', 0); b.until = t + 70; return true; }
  }
  if (carrying(b) >= 36 || (b.inv.sulfur >= 4 && b.bombs >= 2)) { setMode(room, b, 'deposit', 0); b.until = t + 120; b.dp = null; return true; }
  // 3) buscar otras bases cuando ya hay bombas y no se conoce ningún objetivo
  if (bt.built && b.bombs > 0 && t > bt.scoutT && !bt.raid && t - bt.lastRaid > 150 && !pickTarget(room, bt)) { bt.scoutT = t + 20; const a = Math.random() * 6.283, r = 90 + Math.random() * 160, lim = room.half * .8; b.wx = Math.max(-lim, Math.min(lim, p.x + Math.cos(a) * r)); b.wz = Math.max(-lim, Math.min(lim, p.z + Math.sin(a) * r)); setMode(room, b, 'wander', rnd(25, 45)); return true; }
  return false;
}
function pickTarget(room, bt) {
  const base = bt.base; let best = null, bs = -1e9; const bs0 = bases(room);
  for (const o of bs0.values()) {
    if (o.tid === bt.tid || (!bt.known.has(o.tid) && !nearKnown(room, bt, o))) continue;
    if (!o.bot && !o.online) continue; // las bases de jugadores solo se atacan con alguien conectado: ve pasar el asalto y puede defenderse
    if (!o.n && !o.chests.length) continue; const d = base ? Math.hypot(o.x - base.i0 * GRID, o.z - base.j0 * GRID) : 100;
    const s = -d * .6 + (o.chests.length ? 60 : 0) - (o.hp / Math.max(1, o.max)) * -20 + Math.random() * 40 - (bt.lastTarget === o.tid ? 80 : 0);
    if (s > bs) { bs = s; best = o; }
  }
  return best;
}
function nearKnown(room, bt, o) { for (const q of members(room, bt.tid)) if (Math.hypot(q.x - o.x, q.z - o.z) < 90) { bt.known.add(o.tid); return true; } return false; }

// ---------------------------------------------------------------- modos de comportamiento
const wp = (room, p, b, x, z, o) => walk(room, p, b, x, z, o);
export function run(room, p, b) {
  const bt = tribeOf(room, p); if (!bt) { setMode(room, b, 'idle', 1); return true; }
  if (b.mode === 'build') return runBuild(room, p, b, bt);
  if (b.mode === 'deposit') return runDeposit(room, p, b, bt);
  if (b.mode === 'raid') return runRaid(room, p, b, bt);
  return false;
}
function runBuild(room, p, b, bt) {
  const t = room.t; if (!bt.base || t > b.until) { setMode(room, b, 'idle', 1); return true; }
  if (t < (b.buildT || 0)) { stand(p); return true; }
  let st = nextStep(room, bt), target = null, upg = null, rep = null;
  if (st) target = st; else if (bt.built === false || !bt.built) { bt.built = true; furnish(room, bt); room.feed('base', bt.name || room.tribeInfo.get(bt.tid).name, null, bt.base ? doorPos(bt.base) : null); }
  if (!st) { upg = nextUpgrade(room, bt); if (upg) target = { x: pieceCenter(upg).x, z: pieceCenter(upg).z }; else { rep = [...room.B.map.values()].find((q) => q.owner === bt.tid && q.hp < room.B.maxHp(q) * .7); if (rep) target = { x: pieceCenter(rep).x, z: pieceCenter(rep).z }; } }
  if (!target) { setMode(room, b, 'idle', rnd(1, 3)); return true; }
  const tx = st ? (st.i * GRID + 1.5 + (st.d === 'h' ? 0 : -1)) : target.x, tz = st ? (st.j * GRID + 1.5 + (st.d === 'v' ? 0 : -1)) : target.z;
  const out = st && st.kind !== 'foundation' ? doorLike(bt.base, st) : null, gx = out ? out.x : tx, gz = out ? out.z : tz;
  const d = Math.hypot(gx - p.x, gz - p.z);
  if (d > 4.2) { walk(room, p, b, gx, gz, { stop: 3.5, sprint: d > 18 }); return true; }
  stand(p); turn(p, yawTo(gx - p.x, gz - p.z), 6);
  const c = st ? cost(st.kind, 0) : upg ? cost(upg.kind, upg.tier + 1) : { wood: 6 };
  if (!afford(bt, b, c)) { setMode(room, b, 'idle', 1); b.buildT = t + 3; return true; }
  room.broadcast({ t: 'swing', id: p.id }); p.atkT = t; b.buildT = t + rnd(.8, 1.3);
  if (st) { if (placeStep(room, bt, st, 0)) { pay(room, bt, b, c); if (st.kind === 'foundation' && !bt.first) { bt.first = true; } } else { b.buildT = t + 4; bt.fail = (bt.fail || 0) + 1; if (bt.fail > 12 && st.kind === 'foundation') { resetBase(room, bt); } } }
  else if (upg) { pay(room, bt, b, c); upgradePiece(room, upg, upg.tier + 1); }
  else if (rep) { pay(room, bt, b, c); rep.hp = Math.min(room.B.maxHp(rep), rep.hp + room.B.maxHp(rep) * .35); room.broadcast({ t: 'ph', key: rep.key, hp: Math.round(rep.hp) }); }
  return true;
}
// punto del lado de fuera desde el que se coloca una pared/techo (así el bot no se queda atrapado dentro)
function doorLike(base, st) {
  if (st.kind === 'ceiling') return { x: st.i * GRID + 1.5, z: st.j * GRID + 1.5 };
  const dp = doorPos(base); const cx = (base.i0 + base.w / 2) * GRID, cz = (base.j0 + base.h / 2) * GRID;
  const ex = st.d === 'h' ? st.i * GRID + 1.5 : st.i * GRID, ez = st.d === 'h' ? st.j * GRID : st.j * GRID + 1.5, dx = ex - cx, dz = ez - cz, l = Math.hypot(dx, dz) || 1;
  return { x: ex + dx / l * 2.4, z: ez + dz / l * 2.4 };
}
function resetBase(room, bt) { bt.base = null; bt.plan = null; bt.fail = 0; bt.siteT = room.t + 30; const info = room.tribeInfo.get(bt.tid); if (info) info.base = null; }
function runDeposit(room, p, b, bt) {
  const t = room.t; if (t > b.until) { setMode(room, b, 'idle', 1); return true; }
  if (!bt.base) { setMode(room, b, 'idle', 1); return true; }
  const L = layout(bt.base), ch = chestOf(room, bt), tgt = ch ? { x: ch.x, z: ch.z } : { x: L.door.x + L.door.n[0] * 2.2, z: L.door.z + L.door.n[1] * 2.2 };
  // ruta: delante de la puerta -> dentro -> junto al arcón
  const path = ch ? [{ x: L.door.x + L.door.n[0] * 2.4, z: L.door.z + L.door.n[1] * 2.4 }, { x: L.door.x - L.door.n[0] * 1.3, z: L.door.z - L.door.n[1] * 1.3 }, tgt] : [tgt];
  if (!b.dp) b.dp = { i: 0 };
  const w = path[Math.min(b.dp.i, path.length - 1)], done = walk(room, p, b, w.x, w.z, { stop: b.dp.i === path.length - 1 ? 1.4 : .9, sprint: Math.hypot(w.x - p.x, w.z - p.z) > 20 });
  if (done) { b.dp.i++; if (b.dp.i >= path.length) {
    for (const k of ['wood', 'stone', 'fiber', 'ore', 'sulfur', 'ingot', 'arrow', 'bandage']) { const keep = k === 'wood' ? 14 : k === 'sulfur' ? (b.gear === 'spear' ? 0 : 6) : k === 'fiber' ? 3 : 0; const n = Math.floor((b.inv[k] || 0) - keep); if (n > 0) b.inv[k] -= addPool(room, bt, k, n); }
    if (b.inv.meat > 2) b.inv.meat -= addPool(room, bt, 'meat', b.inv.meat - 2);
    if (b.loot) { for (const id in b.loot) { const k = ITEM_POOL[id]; if (k) addPool(room, bt, k, b.loot[id]); } b.loot = null; if (b.raided) { room.feed('haul', room.tribeInfo.get(bt.tid).name, b.raided); b.raided = null; } }
    syncChest(room, bt); b.dp = null; setMode(room, b, 'idle', rnd(.8, 2)); room.broadcast({ t: 'swing', id: p.id }); } }
  return true;
}

// ---- raid: tribu entera, por fases
export function startRaid(room, bt, target) {
  bt.raid = { phase: 'go', target: target.tid, x: target.x, z: target.z, started: room.t, ends: room.t + 420, members: new Set(), ready: new Set(), assault: false, breached: false, looted: false };
  bt.lastRaid = room.t; bt.lastTarget = target.tid; bt.known.add(target.tid);
  const ti = room.tribeInfo.get(bt.tid);
  room.feed('raid', ti.name, target.name, { x: Math.round(target.x), z: Math.round(target.z) });
  for (const o of target.owners) if (o.ws) room.send(o, { t: 'alert', k: 'incoming', by: ti.name });
  for (const m of members(room, bt.tid)) if (m.ai && !['fight', 'flee', 'rest', 'eat', 'craft'].includes(m.ai.mode) && m.ai.gear !== 'fists') { m.ai.mode = 'idle'; m.ai.until = 0; }
}
function raidPieces(room, tid) { const out = []; for (const q of room.B.map.values()) if (q.owner === tid) out.push(q); return out; }
function runRaid(room, p, b, bt) {
  const t = room.t, r = bt.raid;
  if (!r || r.phase === 'over' || t > r.ends) { if (b.loot && bt.base) { setMode(room, b, 'deposit', 0); b.until = t + 100; b.dp = null; return true; } setMode(room, b, 'idle', 1); return true; }
  const tg = bases(room).get(r.target), pieces = raidPieces(room, r.target);
  if (!tg || (!pieces.length && !tg.chests.length && !room.D.bags.size)) { r.phase = 'over'; return true; }
  // 0) con el botín en la mochila: volver a casa
  if (b.loot) { setMode(room, b, 'deposit', 0); b.until = t + 150; b.dp = null; return true; }
  // 1) botín suelto cerca del objetivo
  let bag = null, bd = 1e9; for (const g of room.D.bags.values()) { const d = Math.hypot(g.x - tg.x, g.z - tg.z); if (d < 20 && d < bd && t - (g.born || 0) >= 0) { bd = d; bag = g; } }
  if (bag && (r.looted || r.assault)) { const d = Math.hypot(bag.x - p.x, bag.z - p.z); if (d > 1.6) { walk(room, p, b, bag.x, bag.z, { stop: 1.2, sprint: true }); return true; } takeBag(room, p, b, bag, tg); return true; }
  // 1b) reunirse a unos 30 m de la base y atacar juntos
  if (!r.assault) {
    if (!r.stage) { const bx = bt.base ? bt.base.i0 * GRID : tg.x + 30, bz = bt.base ? bt.base.j0 * GRID : tg.z, dx = bx - tg.x, dz = bz - tg.z, l = Math.hypot(dx, dz) || 1; r.stage = { x: tg.x + dx / l * 30, z: tg.z + dz / l * 30 }; }
    const ds = Math.hypot(r.stage.x - p.x, r.stage.z - p.z);
    if (ds > 7) { walk(room, p, b, r.stage.x, r.stage.z, { stop: 5, sprint: ds > 25 }); b.rp = (b.rp || 0) + DT_; if (b.rp > 170) { r.members.delete(p.id); setMode(room, b, 'idle', 2); } return true; }
    stand(p); r.ready.add(p.id); const live = [...r.members].filter((id) => room.players.get(id) && room.players.get(id).dead <= 0).length;
    if (!r.firstReady) r.firstReady = t;
    if (r.ready.size >= Math.min(2, live) || t - r.firstReady > 25) { r.assault = true; r.assaultAt = t; } return true;
  }
  // 2) elegir pieza a romper: primero la puerta, luego lo más débil cerca
  const door = pieces.find((q) => q.kind === 'door'), chest = tg.chests[0];
  let tgtPiece = r.piece && room.B.map.get(r.piece) ? room.B.map.get(r.piece) : null;
  if (!tgtPiece && !r.breached) { tgtPiece = door || pieces.filter((q) => q.kind === 'wall').sort((a, c) => a.hp - c.hp)[0] || pieces[0]; r.piece = tgtPiece ? tgtPiece.key : null; }
  const useBomb = b.bombs > 0 && tgtPiece && !r.breached;
  const c = tgtPiece ? pieceCenter(tgtPiece) : chest ? { x: chest.x, y: chest.y, z: chest.z } : { x: tg.x, y: tg.y, z: tg.z };
  const stand0 = useBomb ? 7 : tgtPiece ? 2.6 : 4.2, d = Math.hypot(c.x - p.x, c.z - p.z);
  if (d > stand0) { walk(room, p, b, c.x, c.z, { stop: stand0 - .6, sprint: d > 24 }); b.rq = (b.rq || 0) + DT_; if (b.rq > 150) { b.rq = 0; r.members.delete(p.id); setMode(room, b, 'idle', 2); } return true; }
  stand(p); turn(p, yawTo(c.x - p.x, c.z - p.z), 7);
  if (t < (b.atkAt || 0)) return true;
  if (useBomb) { // lanzar bomba: se ve volar y explota al llegar
    b.atkAt = t + 1.6; b.bombs--; room.broadcast({ t: 'swing', id: p.id }); p.atkT = t;
    room.broadcast({ t: 'fx', k: 'toss', x: p.x, y: p.y + 1.5, z: p.z, tx: c.x, ty: c.y, tz: c.z, T: .9, id: 0 });
    const ex = c.x, ey = c.y, ez = c.z; room.later(.9, () => { if (room.players.get(p.id)) room.explode('bomb', ex, ey, ez, p); }); return true;
  }
  // golpes con el arma: a la pieza o al arcón
  b.atkAt = t + rnd(.55, .8) / (b.skill || .7);
  if (tgtPiece && room.B.map.has(tgtPiece.key)) { p.cd = 0; room.pieceHit(p, tgtPiece.key, b.gear); if (!room.B.map.has(tgtPiece.key)) { r.piece = null; r.breached = true; } return true; }
  r.breached = true; r.piece = null;
  const ch = tg.chests.find((q) => room.D.map.has(q.id)); if (ch) { p.cd = 0; if (Math.hypot(ch.x - p.x, ch.z - p.z) > 4.6) { walk(room, p, b, ch.x, ch.z, { stop: 3.6 }); b.atkAt = t; return true; } room.depHit(p, ch.id, b.gear); if (!room.D.map.has(ch.id)) { r.looted = true; r.lootAt = t; } return true; }
  // no queda nada que robar: atacar objetos sueltos o terminar
  const dep = [...room.D.map.values()].find((q) => q.owner === r.target && Math.hypot(q.x - p.x, q.z - p.z) < 25);
  if (dep) { if (Math.hypot(dep.x - p.x, dep.z - p.z) > 2.6) { walk(room, p, b, dep.x, dep.z, { stop: 1.8 }); return true; } p.cd = 0; room.depHit(p, dep.id, b.gear); return true; }
  r.phase = 'over'; return true;
}
const DT_ = 1 / 20;
function takeBag(room, p, b, bag, tg) {
  room.D.bags.delete(bag.id); room.broadcast({ t: 'lx', id: bag.id }); b.loot = b.loot || {}; let n = 0;
  for (const s of bag.slots) { if (!s) continue; b.loot[s.id] = (b.loot[s.id] || 0) + s.n; n += s.n; if (ITEM_POOL[s.id] === 'bomb') { b.bombs = (b.bombs || 0) + s.n; delete b.loot[s.id]; } }
  b.raided = tg.name; room.broadcast({ t: 'swing', id: p.id });
  room.feed('loot', room.tribeInfo.get(p.tid) ? room.tribeInfo.get(p.tid).name : p.name, tg.name);
}

// ---------------------------------------------------------------- mantenimiento por tick (tribus, puertas, arcones, raids)
export function tick(room) {
  const s = S(room), t = room.t; if (t < s.slow) return; s.slow = t + 1;
  const bs = bases(room, true);
  if (t >= (s.listT || 0)) { s.listT = t + 8; const l = baseList(room), h = JSON.stringify(l); if (h !== s.listH) { s.listH = h; room.broadcast({ t: 'bases', list: l }); } }
  for (const bt of s.bt.values()) {
    const mem = members(room, bt.tid); const info = room.tribeInfo.get(bt.tid);
    if (info) { info.base = bt.base; info.pool = bt.pool; }
    if (bt.dirty) syncChest(room, bt);
    if (bt.base && bt.built && bt.plan && !nextUpgrade(room, bt) && (bt.upgradeGoal || 1) < 2) bt.upgradeGoal = 2;
    if (bt.base && bt.built && !chestOf(room, bt) && bt.chestId) { bt.pool = { bomb: bt.pool.bomb || 0 }; bt.pool.bomb = 0; bt.chestId = 0; if (info) info.pool = bt.pool; }
    if (bt.base && !bt.plan) bt.plan = genPlan(bt.base);
    if (bt.base && bt.plan && !bt.built && planDone(room, bt)) { bt.built = true; furnish(room, bt); room.feed('base', info.name, null, doorPos(bt.base)); }
    if (bt.base && bt.built && !chestOf(room, bt) && (bt.pool.wood || 0) + 0 >= 0 && mem.length && (t - (bt.furnT || 0) > 30)) { bt.furnT = t; furnish(room, bt); } // arcón nuevo tras un saqueo
    if (bt.base && bt.plan && planDone(room, bt) === false && bt.built) bt.built = true; // al faltar piezas se reparan aunque la base ya estuviera completa
    // puertas: se abren para quien es de la tribu
    if (bt.base && bt.built) { const dd = bt.base.door, key = wKey(dd.d, dd.i, dd.j, 0), q = room.B.map.get(key), pos = doorPos(bt.base); if (q && q.kind === 'door') { const near = mem.some((m) => Math.hypot(m.x - pos.x, m.z - pos.z) < 3.6), far = !mem.some((m) => Math.hypot(m.x - pos.x, m.z - pos.z) < 5.5); if (!q.open && near) { q.open = true; room.broadcast({ t: 'po', key, open: true }); } else if (q.open && far) { q.open = false; room.broadcast({ t: 'po', key, open: false }); } } }
    // camas: los bots reaparecen en su base
    for (const m of mem) if (bt.bedId && room.D.map.has(bt.bedId)) m.bed = bt.bedId;
    // raid en marcha: terminar si no queda nadie
    if (bt.raid) { const r = bt.raid; const alive = [...r.members].filter((id) => room.players.get(id) && room.players.get(id).dead <= 0).length; if (r.phase === 'over' || t > r.ends + 60 || (t - r.started > 20 && !alive && !mem.some((m) => m.ai && m.ai.mode === 'raid'))) { bt.raid = null; bt.lastRaid = t; } }
    // lanzar un raid nuevo
    if (!bt.raid && bt.base && bt.built && mem.length) {
      const bombs = mem.reduce((n, m) => n + ((m.ai && m.ai.bombs) || 0), 0) + (bt.pool.bomb || 0) * 0;
      const armed = mem.filter((m) => m.ai && (m.ai.gear === 'spear' || m.ai.gear.startsWith('iron'))).length;
      if ((bombs >= 1 || armed >= 2) && t - bt.lastRaid > 360 && Math.random() < .06 && mem.filter((m) => m.ai && m.ai.gear !== 'fists').length) { const tg = pickTarget(room, bt); if (tg) startRaid(room, bt, tg); }
    }
  }
}
// alerta de ataque a una base (llamada desde Room cuando alguien daña una pieza o un objeto ajeno)
// lista de bases para los clientes (mapa, brújula, objetivos): solo cambia de vez en cuando
export function baseList(room) { return [...bases(room, true).values()].map((o) => ({ tid: o.tid, name: o.name, x: Math.round(o.x), z: Math.round(o.z), n: o.n, bot: !!o.bot, chest: o.chests.length > 0 })); }
export function sendBases(room, p) { room.send(p, { t: 'bases', list: baseList(room) }); }
export function baseAttacked(room, tid, by) {
  if (!by || by.tid === tid) return; const s = room._bb; if (!s) return; const bt = s.bt.get(tid); if (!bt) return;
  for (const q of members(room, tid)) { if (!q.ai) continue; if (Math.hypot(q.x - by.x, q.z - by.z) < 90) { q.ai.target = by.id; q.ai.seen = room.t; q.ai.lastX = by.x; q.ai.lastZ = by.z; q.ai.hurtT = room.t; q.ai.peaceful = false; q.ai.dec = { id: by.id, until: room.t + 40, fight: true }; q.ai.alert.set(by.id, 9); } }
}
