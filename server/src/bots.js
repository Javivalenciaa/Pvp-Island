// Bots: usan el mismo canal que un jugador (input, yaw, ataques) y solo "ven" lo que vería un jugador:
// campo de visión, oído a corta distancia, tiempo de reacción y memoria. Recolectan recursos reales del mapa,
// fabrican herramientas, cazan, se curan y luchan con criterio (rodean, retroceden, huyen cuando conviene).
const NAMES = ['Ragnar', 'Freya', 'Bjorn', 'Astrid', 'Ulf', 'Sigrid', 'Leif', 'Ingrid', 'Thor', 'Helga', 'Erik', 'Gudrun', 'Olaf', 'Runa', 'Sven', 'Tyra', 'Harald', 'Liv', 'Knut', 'Yrsa'];
const DT = 1 / 20, TAU = Math.PI * 2;
const GEAR = { fists: { dmg: 4, reach: 2.2, chop: 6, mine: 5 }, stone_axe: { dmg: 13, reach: 2.6, chop: 28, mine: 12 }, stone_pick: { dmg: 13, reach: 2.6, chop: 10, mine: 30 }, hammer: { dmg: 10, reach: 2.5, chop: 8, mine: 10 },
  spear: { dmg: 26, reach: 3.5, chop: 14, mine: 12 }, iron_axe: { dmg: 22, reach: 2.8, chop: 46, mine: 20 }, iron_pick: { dmg: 22, reach: 2.8, chop: 16, mine: 46 }, iron_sword: { dmg: 48, reach: 3.0, chop: 18, mine: 16 } };
const STARTERS = [['fists', .35], ['stone_axe', .2], ['stone_pick', .12], ['hammer', .08], ['spear', .12], ['iron_axe', .06], ['iron_pick', .02], ['iron_sword', .05]];
const TIER1 = ['stone_axe', 'stone_pick', 'hammer'], IRON = ['iron_axe', 'iron_pick', 'iron_sword'];
const NODE_HP = { tree: 100, appletree: 140, rock: 120, ore: 160, sulfur: 140, bush: 24, berry: 15 }, NODE_RT = { tree: 150, appletree: 220, rock: 180, ore: 300, sulfur: 300, bush: 90, berry: 120 };
const YIELD = { tree: ['wood', 14], appletree: ['wood', 8], rock: ['stone', 12], ore: ['ore', 5], sulfur: ['sulfur', 5], bush: ['fiber', 5], berry: ['food', 1] };
const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[(Math.random() * a.length) | 0];
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const yawTo = (dx, dz) => Math.atan2(-dx, -dz); // misma convención que el cliente: adelante = (-sin yaw, -cos yaw)

function worldOf(room) {
  if (room._botWorld) return room._botWorld;
  const W = room.world, grid = new Map(), C = 24, key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  W.nodes.forEach((n, i) => { n.id = i; const k = key(Math.floor(n.x / C), Math.floor(n.z / C)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(n); });
  return (room._botWorld = { W, grid, C, key });
}
function nearestNode(room, p, types, R) {
  const { grid, C, key } = worldOf(room), c0 = Math.floor((p.x - R) / C), c1 = Math.floor((p.x + R) / C), d0 = Math.floor((p.z - R) / C), d1 = Math.floor((p.z + R) / C);
  let best = null, bd = R * R;
  for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) { const a = grid.get(key(cx, cz)); if (!a) continue; for (const n of a) { if (!types.includes(n.type) || room.nodes.has(n.id)) continue; const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2; if (d < bd && Math.abs(n.y - p.y) < 6) { bd = d; best = n; } } }
  return best;
}
function init(room, p) {
  let gear = 'fists'; if (!(p.deaths > 0 && Math.random() < .75)) { let r = Math.random(); for (const [g, w] of STARTERS) { r -= w; if (r <= 0) { gear = g; break; } } }
  return { gear, line: pick(TIER1), goal: pick(IRON), inv: { wood: gear === 'fists' ? 0 : rnd(0, 6) | 0, stone: gear === 'fists' ? 0 : rnd(0, 4) | 0, fiber: 0, ore: 0, sulfur: 0, food: rnd(0, 2) | 0, meat: 0 },
    bold: Math.random(), peaceful: Math.random() < .28, react: rnd(.45, 1.1), fov: rnd(1.9, 2.3), skill: rnd(.62, .88),
    mode: 'idle', until: room.t + rnd(1, 4), task: null, target: 0, seen: -99, lastX: p.x, lastZ: p.z, alert: new Map(), lastHp: p.hp, hurtT: -99,
    strafe: Math.random() < .5 ? 1 : -1, strafeT: 0, backT: 0, atkAt: 0, fleeT: 0, rest: 0, eatT: 0, stuckT: 0, px: p.x, pz: p.z, detour: 0, detourDir: 1, swingAt: 0, swings: 0, craftT: 0, wx: p.x, wz: p.z, lookT: 0, lookYaw: p.yaw };
}
// lo que deja un bot al morir: su arma y lo que ha recogido, más algo suelto
function botBag(b) {
  const out = []; if (b.gear !== 'fists') out.push({ id: b.gear, n: 1 });
  const m = [['wood', 'wood'], ['stone', 'stone'], ['fiber', 'fiber'], ['ore', 'ore'], ['sulfur', 'sulfur'], ['meat', 'raw_meat'], ['food', 'berries']];
  for (const [k, id] of m) if (b.inv[k] > 0) out.push({ id, n: Math.round(b.inv[k]) });
  if (Math.random() < .4) out.push({ id: 'arrow', n: (3 + Math.random() * 10) | 0 }); if (Math.random() < .3) out.push({ id: 'bandage', n: 1 + (Math.random() * 2 | 0) }); if (Math.random() < .12) out.push({ id: 'ingot', n: 1 + (Math.random() * 3 | 0) });
  return out;
}
function turn(p, want, rate) { const d = angDiff(p.yaw, want), s = Math.max(-rate * DT, Math.min(rate * DT, d)); p.yaw += s; return Math.abs(angDiff(p.yaw, want)); }
// camina hacia un punto con giro suave, rodeando agua, pendientes y obstáculos
function walk(room, p, b, gx, gz, o = {}) {
  const dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz), stop = o.stop ?? .6;
  if (d <= stop) { p.input.mz = 0; p.input.mx = 0; p.input.sprint = false; return true; }
  let want = yawTo(dx, dz);
  if (b.detour > 0) { b.detour -= DT; want += b.detourDir * 1.3; }
  // evitar agua profunda y desniveles bruscos justo delante
  const ax = p.x - Math.sin(p.yaw) * 2.2, az = p.z - Math.cos(p.yaw) * 2.2, ah = room.T.terrainH(ax, az);
  if (ah < room.sea - .4 || Math.abs(ah - p.y) > 1.6) { if (b.detour <= 0) { b.detour = rnd(.8, 1.6); b.detourDir = Math.random() < .5 ? 1 : -1; } want += b.detourDir * 1.1; }
  const err = turn(p, want, o.turn ?? 4.2);
  p.input.mz = err < 1.1 ? 1 : 0; p.input.mx = 0; p.input.sprint = !!o.sprint && err < .5;
  // atascado: apenas avanza aunque quiere avanzar -> rodea y salta
  if (p.input.mz) { const m = Math.hypot(p.x - b.px, p.z - b.pz); b.stuckT += DT; if (b.stuckT > 1) { if (m < .5) { b.detour = rnd(1, 2); b.detourDir = Math.random() < .5 ? 1 : -1; p.input.jump = true; } b.px = p.x; b.pz = p.z; b.stuckT = 0; } }
  return false;
}
function stand(p) { p.input.mz = 0; p.input.mx = 0; p.input.sprint = false; }
function setMode(room, b, m, secs) { b.mode = m; b.until = room.t + (secs || 0); b.swings = 0; }

function perceive(room, p, b) {
  const t = room.t, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), night = room.isNight, vis = night ? 16 : 32;
  let best = null, bs = 1e9;
  for (const q of room.players.values()) {
    if (q === p || q.dead > 0 || q.tid === p.tid || q.prot > t) continue;
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz); if (d > 40) { b.alert.delete(q.id); continue; }
    const infront = (dx * fx + dz * fz) / (d || 1) > Math.cos(b.fov / 2);
    const sees = d < vis && infront && Math.abs(q.y - p.y) < 12;
    const hears = d < 6 || (t - (q.atkT || -99) < 1.2 && d < 22) || (t - (q.lastByT || -99) < .5 && q.lastBy === p.id);
    let a = b.alert.get(q.id) || 0;
    if (sees) a += DT * (d < 12 ? 1.6 : 1) * 1; else if (hears) a += DT * .7; else a = Math.max(0, a - DT * .6);
    b.alert.set(q.id, a);
    if (a >= b.react && d < bs) { bs = d; best = q; }
  }
  return best;
}
function threat(room, p, b, q) { // 0..1: lo peligroso que parece q frente a mí
  const mine = GEAR[b.gear].dmg * (p.hp / 100), theirs = 14 * (q.hp / 100) + (q.kills || 0) * 2;
  return Math.max(0, Math.min(1, .5 + (theirs - mine) / 40));
}

export function brain(room, p) {
  const first = !p.ai, b = p.ai || (p.ai = init(room, p)), t = room.t, T = room.T;
  p.input.jump = false;
  if (p.dead > 0) { if (p.ai && !p.dropped) room.dropBag(p, botBag(p.ai)); p.ai = null; return; }
  if (first || p.held !== b.gear) room.setHeld(p, b.gear);
  // --- recibir daño: apunta al atacante y reacciona
  if (p.hp < b.lastHp - .5) { b.hurtT = t; if (p.lastBy) { const q = room.players.get(p.lastBy); if (q && q.dead <= 0) { b.target = q.id; b.seen = t; b.lastX = q.x; b.lastZ = q.z; b.alert.set(q.id, 9); b.peaceful = false; } } }
  b.lastHp = p.hp;
  // --- objetivo actual y percepción
  const seenNow = perceive(room, p, b); let foe = null;
  if (seenNow) { b.target = seenNow.id; b.seen = t; b.lastX = seenNow.x; b.lastZ = seenNow.z; foe = seenNow; }
  else if (b.target) { const q = room.players.get(b.target); if (q && q.dead <= 0 && t - b.seen < 6) { foe = null; } else b.target = 0; }
  const tq = b.target ? room.players.get(b.target) : null, dist = tq ? Math.hypot(tq.x - p.x, tq.z - p.z) : 1e9;
  // --- huir: solo cuando hay peligro real y el bot no es de los valientes que pelean hasta el final
  const panic = 16 + (1 - b.bold) * 24;
  if (foe && p.hp < panic && b.fleeT <= 0 && b.mode !== 'flee' && dist < 18 && (Math.random() < .5 || p.hp < 12)) { setMode(room, b, 'flee', rnd(3.5, 6)); }
  if (b.mode === 'flee') {
    if (t > b.until || (!foe && dist > 28)) { setMode(room, b, 'rest', rnd(6, 10)); }
    else { const q = tq || foe; const away = q ? yawTo(p.x - q.x, p.z - q.z) : p.yaw; const gx = p.x - Math.sin(away) * 20 + Math.sin(t * .7) * 6, gz = p.z - Math.cos(away) * 20; walk(room, p, b, gx, gz, { sprint: true, turn: 6, stop: 1 }); return; }
  }
  // --- combate (solo si lo ha percibido o lo recuerda y no es pacífico, o si le han golpeado)
  // al notar a alguien decide (una vez por encuentro) si lo ataca o lo evita; si le golpean, pelea
  if (tq && (!b.dec || b.dec.id !== tq.id || t > b.dec.until)) b.dec = { id: tq.id, until: t + rnd(25, 50), fight: !b.peaceful && Math.random() < .16 + .45 * b.bold };
  const provoked = t - b.hurtT < 8, wantFight = tq && (provoked || (b.dec && b.dec.fight)) && threat(room, p, b, tq) < .85 + (b.bold - .5) * .3;
  if (tq && wantFight && b.mode !== 'rest') {
    if (b.mode !== 'fight') setMode(room, b, 'fight', 0);
    const g = GEAR[b.gear], recent = t - b.seen < .6;
    if (!recent && dist > 3) { // lo perdió de vista: va a donde lo vio, sin saber dónde está ahora
      const arrived = walk(room, p, b, b.lastX, b.lastZ, { sprint: dist > 12, turn: 5, stop: 2 }); if (arrived && t - b.seen > 2.5) { b.target = 0; setMode(room, b, 'look', 3); } return;
    }
    // acercarse en arco, rodeando; retroceder tras golpear; cara al enemigo con giro limitado
    b.strafeT -= DT; if (b.strafeT <= 0) { b.strafe = -b.strafe; b.strafeT = rnd(.8, 2.2); }
    const want = yawTo(tq.x - p.x, tq.z - p.z), err = turn(p, want, 5.5 * (.7 + b.skill * .5));
    const ideal = g.reach * .75;
    if (b.backT > 0) { b.backT -= DT; p.input.mz = -1; p.input.mx = b.strafe * .5; p.input.sprint = false; }
    else if (dist > ideal + 1.2) { p.input.mz = err < 1.2 ? 1 : 0; p.input.mx = dist < 6 ? b.strafe * .55 : 0; p.input.sprint = dist > 8 && err < .5; }
    else { p.input.mz = dist < ideal - .3 ? -.4 : 0; p.input.mx = b.strafe; p.input.sprint = false; }
    if (Math.random() < .004) p.input.jump = true;
    if (dist <= g.reach + .3 && err < .45 && t >= b.atkAt && p.cd <= 0) {
      b.atkAt = t + rnd(.65, 1.15) / b.skill * .8; room.broadcast({ t: 'swing', id: p.id }); p.atkT = t;
      if (Math.random() < b.skill) room.meleeHit(p, tq.id, b.gear); else p.cd = .35;
      if (Math.random() < .35) b.backT = rnd(.25, .6);
    }
    return;
  }
  if (b.mode === 'fight') setMode(room, b, 'idle', rnd(.5, 2));
  // --- animales peligrosos (lobos, jabalíes): pelea si va bien armado y sano; si no, huye
  { let ba = null, bd = 1e9; for (const a of room.fauna.map.values()) { if (a.dead || a.owner) continue; const d = Math.hypot(a.x - p.x, a.z - p.z); const lim = a.type === 'wolf' ? 13 : a.type === 'boar' && (a.provoked > 0) ? 7 : 0; if (d < lim && d < bd) { bd = d; ba = a; } }
    if (ba) { const strong = GEAR[b.gear].dmg >= 13 && p.hp > 45 && (b.bold > .25 || b.gear !== 'stone_axe');
      if (!strong || p.hp < 28) { const away = yawTo(p.x - ba.x, p.z - ba.z); walk(room, p, b, p.x - Math.sin(away) * 20, p.z - Math.cos(away) * 20, { sprint: true, turn: 7, stop: 1 }); return; }
      const g = GEAR[b.gear], err = turn(p, yawTo(ba.x - p.x, ba.z - p.z), 6); stand(p); if (bd > g.reach - .2) { p.input.mz = err < 1.2 ? 1 : 0; } if (bd < 1.2) { p.input.mz = -.6; }
      if (bd <= g.reach + .4 && err < .5 && t >= b.atkAt) { b.atkAt = t + rnd(.55, .9); room.animalHit(p, ba.id, b.gear); }
      return; } }
  // --- evitar al desconocido más fuerte, o a quien no quiere pelear
  if (tq && !wantFight && dist < 24 && b.mode !== 'rest') { const away = yawTo(p.x - tq.x, p.z - tq.z); walk(room, p, b, p.x - Math.sin(away) * 12, p.z - Math.cos(away) * 12, { turn: 3.5, stop: 1, sprint: dist < 9 }); return; }
  // --- descanso y comida: se cura cuando no hay peligro
  if (b.mode === 'rest') { stand(p); p.hp = Math.min(100, p.hp + DT * 2.2); if (p.hp >= 85 || t > b.until) setMode(room, b, 'idle', rnd(.5, 2)); return; }
  if (p.hp < 70 && (b.inv.meat > 0 || b.inv.food > 0) && b.mode !== 'eat' && t - b.hurtT > 6) { setMode(room, b, 'eat', 2.2); b.eatT = t + 2.2; }
  if (b.mode === 'eat') { stand(p); if (t >= b.eatT) { if (b.inv.meat > 0) { b.inv.meat--; p.hp = Math.min(100, p.hp + 30); } else { b.inv.food--; p.hp = Math.min(100, p.hp + 12); } setMode(room, b, 'idle', .5); } return; }
  if (p.hp < 55 && t - b.hurtT > 8 && b.mode !== 'rest') { setMode(room, b, 'rest', rnd(6, 12)); return; }
  // --- fabricar herramientas cuando tiene materiales
  if (b.mode !== 'craft' && t > b.craftT) { const i = b.inv; let nx = null;
    if (b.gear === 'fists' && i.wood >= 10 && i.stone >= 6) nx = [b.line, { wood: 10, stone: 6 }];
    else if (TIER1.includes(b.gear) && i.wood >= 14 && i.fiber >= 5 && i.stone >= 4) nx = ['spear', { wood: 14, fiber: 5, stone: 4 }];
    else if (b.gear === 'spear' && i.ore >= 40 && i.wood >= 10 && i.stone >= 10) nx = [b.goal, { ore: 40, wood: 10, stone: 10 }];
    if (nx) { b.craftTo = nx; setMode(room, b, 'craft', 2.6); } else b.craftT = t + 4; }
  if (b.mode === 'craft') { stand(p); if (t > b.until && b.craftTo) { const [g, cost] = b.craftTo; for (const k in cost) b.inv[k] -= cost[k]; b.gear = g; b.craftTo = null; room.setHeld(p, g); room.broadcast({ t: 'swing', id: p.id }); setMode(room, b, 'idle', .8); } return; }
  // --- tareas: recolectar, cazar, explorar
  if (b.mode === 'idle' && t < b.until) { stand(p); if (t > b.lookT) { b.lookT = t + rnd(1.2, 3); b.lookYaw = p.yaw + rnd(-1.6, 1.6); } turn(p, b.lookYaw, 1.4); return; }
  if (b.mode === 'idle' || b.mode === 'look') {
    if (b.mode === 'look') { if (t < b.until) { stand(p); turn(p, p.yaw + Math.sin(t * 2) * .02 + .03, 2); return; } setMode(room, b, 'idle', 0); }
    chooseTask(room, p, b); }
  if (b.mode === 'gather') {
    const n = b.task; if (!n || room.nodes.has(n.id)) { setMode(room, b, 'idle', rnd(.5, 2)); return; }
    const d = Math.hypot(n.x - p.x, n.z - p.z), reach = n.type === 'tree' || n.type === 'appletree' ? 1.5 : n.type === 'bush' || n.type === 'berry' ? 1.2 : 1.9;
    if (d > reach) { walk(room, p, b, n.x, n.z, { stop: reach - .2, sprint: false }); if (t > b.until + 60) setMode(room, b, 'idle', 1); return; }
    stand(p); turn(p, yawTo(n.x - p.x, n.z - p.z), 6);
    if (t >= b.swingAt) { b.swingAt = t + rnd(.7, 1.0); b.swings++; room.broadcast({ t: 'swing', id: p.id }); b.work = (b.work || 0) + (n.type === 'tree' || n.type === 'appletree' || n.type === 'bush' || n.type === 'berry' ? GEAR[b.gear].chop : GEAR[b.gear].mine) * (n.type === 'ore' || n.type === 'sulfur' ? (b.gear === 'fists' ? 0 : 1) : 1);
      if (b.work >= NODE_HP[n.type]) { b.work = 0; room.nodeDepleted(p, { id: n.id, rt: NODE_RT[n.type] }); const [k, q] = YIELD[n.type]; b.inv[k] = (b.inv[k] || 0) + q; if (n.type === 'appletree') b.inv.food++; setMode(room, b, 'idle', rnd(.6, 2.2)); b.task = null; }
      else if (b.swings > 40) { setMode(room, b, 'idle', 1); b.task = null; } }
    return;
  }
  if (b.mode === 'hunt') {
    const a = room.fauna.map.get(b.huntId); if (!a) { if (b.butchered) { b.inv.meat += 3; b.butchered = false; } setMode(room, b, 'idle', rnd(1, 3)); return; }
    const d = Math.hypot(a.x - p.x, a.z - p.z); if (t > b.until) { setMode(room, b, 'idle', 1); return; }
    if (d > 2.2) { walk(room, p, b, a.x, a.z, { sprint: !a.dead && d > 7 && b.gear !== 'fists', turn: 5.5, stop: 1.6 }); return; }
    stand(p); turn(p, yawTo(a.x - p.x, a.z - p.z), 6);
    if (t >= b.swingAt) { b.swingAt = t + rnd(.55, .9); if (a.dead) { b.butchered = true; room.animalHit(p, a.id, b.gear, true); } else room.animalHit(p, a.id, b.gear); }
    return;
  }
  // explorar
  if (b.mode === 'wander') {
    if (t > b.until || walk(room, p, b, b.wx, b.wz, { stop: 2, turn: 3.2 })) setMode(room, b, 'idle', rnd(1.5, 4.5));
  } else setMode(room, b, 'idle', 1);
}
function chooseTask(room, p, b) {
  const t = room.t, i = b.inv;
  // cazar si hay presa cerca y tiene hambre o poca vida
  const hungry = i.meat < 1 && i.food < 1;
  if (hungry && Math.random() < .5) { let best = null, bd = 40 * 40; for (const a of room.fauna.map.values()) { if (a.owner || (a.type !== 'deer' && a.type !== 'boar')) continue; const d = (a.x - p.x) ** 2 + (a.z - p.z) ** 2; if (d < bd) { bd = d; best = a; } } if (best) { b.huntId = best.id; setMode(room, b, 'hunt', 25); return; } }
  // qué necesita para progresar
  let types;
  if (b.gear === 'fists') types = i.wood < 10 ? ['tree', 'appletree'] : ['rock'];
  else if (TIER1.includes(b.gear)) types = i.wood < 14 ? ['tree'] : i.fiber < 5 ? ['bush'] : ['rock'];
  else if (b.gear === 'spear') types = i.ore < 40 ? ['ore', 'sulfur'] : i.wood < 10 ? ['tree'] : ['rock'];
  else types = ['tree', 'rock', 'bush', 'berry'];
  if (Math.random() < .12) types = ['berry', 'appletree', 'bush'];
  const n = nearestNode(room, p, types, types.includes('ore') ? 140 : 90);
  if (n && Math.random() < .85) { b.task = n; b.work = 0; b.swingAt = t + .5; setMode(room, b, 'gather', 0); b.until = t; return; }
  // si no hay recurso a mano: pasea hacia un punto de interés o una zona cercana
  const pois = worldOf(room).W.POIS; let gx, gz;
  if (pois.length && Math.random() < .35) { const q = pick(pois); gx = q.x + rnd(-12, 12); gz = q.z + rnd(-12, 12); } else { const a = rnd(0, TAU), r = rnd(25, 80); gx = p.x + Math.cos(a) * r; gz = p.z + Math.sin(a) * r; }
  const lim = room.half * .85; b.wx = Math.max(-lim, Math.min(lim, gx)); b.wz = Math.max(-lim, Math.min(lim, gz)); setMode(room, b, 'wander', rnd(12, 30));
}
export const botName = (i) => NAMES[i % NAMES.length];
