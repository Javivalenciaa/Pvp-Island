import { createTerrain } from '../../shared/terrain.js';
import { MAPS, DT } from '../../shared/maps.js';
import { Buildings, PIECE_DMG, TIER_MULT, TIER_RES, EXP_RES, pieceCenter } from './buildings.js';
import { Deps, DEF, DEP_DMG, EXPLOSIONS } from './deps.js';
import { Fauna, ANI } from './animals.js';
const WEAPONS = { fists: [4, 3.2], stone_axe: [13, 3.8], stone_pick: [13, 3.8], hammer: [10, 3.8], spear: [26, 4.8], iron_axe: [22, 4], iron_pick: [22, 4], iron_sword: [48, 4.2] }, RANGED = { bow: 40, crossbow: 80 };
const PROT = process.env.PROT_SECONDS !== undefined ? +process.env.PROT_SECONDS : 30;
const SPEED = 4.8, SPRINT = 7.8, RADIUS = 160, HP = 100, REACH = 2.6, DMG = 14, ATK_CD = .6;
export class Room {
  constructor(mapId, maxPlayers = 20) { this.mapId = mapId; this.map = MAPS[mapId]; this.T = createTerrain({ world: this.map.world, seed: this.map.seed }); this.half = this.map.world / 2; this.sea = 0; this.max = maxPlayers; this.players = new Map(); this.nextId = 1; this.t = 0; this.tribeInfo = new Map(); this.tribeOfToken = new Map(); this.invites = new Map(); this.nextTribe = 1; this.B = new Buildings(); this.D = new Deps(); this.fxT = 0; this.nodes = new Map(); this.fauna = new Fauna(this); this.fauna.spawnAll(); this.timer = setInterval(() => this.tick(), DT * 1000); }
  get humans() { let n = 0; for (const p of this.players.values()) if (!p.bot) n++; return n; }
  get count() { return this.players.size; }
  spawnPoint() { for (let i = 0; i < 300; i++) { const a = Math.random() * 6.283, r = this.half * (.2 + Math.random() * .62), x = Math.cos(a) * r, z = Math.sin(a) * r, h = this.T.terrainH(x, z); if (h > 1.6 && h < 12 && this.T.slopeAt(x, z) < .28 && !this.T.nearLake(x, z, 1.5)) return { x, z }; } return { x: 0, z: 0 }; }
  // Tribus: solo se forman por invitación (máx. 3). Quien no tiene tribu tiene una tribu "solitaria" propia (tid = 's:' + token).
  pub(p) { const t = this.tribeInfo.get(p.tid); return { id: p.id, name: p.name, tid: p.tid, tribe: t ? t.name : '', bot: p.bot }; }
  tribeSize(tid) { let n = 0; for (const q of this.players.values()) if (q.tid === tid && !q.bot) n++; return n; }
  members(tid) { return [...this.players.values()].filter((q) => q.tid === tid); }
  notice(p, text) { if (p && p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify({ t: 'notice', text })); }
  join(name, token, ws, bot = false, botTid = null) {
    if (this.count >= this.max) return null;
    const id = this.nextId++, sp = this.spawnPoint(), tok = bot ? 'bot' + id : String(token || 'anon' + id).slice(0, 40);
    let tid = botTid || this.tribeOfToken.get(tok) || 's:' + tok;
    const p = { id, token: tok, name: (name || 'Jugador').replace(/[<>]/g, '').slice(0, 16) || 'Jugador', tid, bot, ws, x: sp.x, z: sp.z, y: this.T.terrainH(sp.x, sp.z), vy: 0, yaw: 0, hp: HP, input: { mx: 0, mz: 0, sprint: false, jump: false }, cd: 0, kills: 0, deaths: 0, dead: 0, prot: this.t + PROT, chatT: 0 };
    this.players.set(id, p); this.broadcast(Object.assign({ t: 'join' }, this.pub(p)));
    return p;
  }
  leave(p) { if (p.mount) this.dismount(p); this.players.delete(p.id); this.invites.delete(p.id); this.broadcast({ t: 'leave', id: p.id }); }
  setTribe(p, tid) { const old = p.tid; if (old.startsWith('s:') && old !== tid) { this.B.changeOwner(old, tid); this.D.changeOwner(old, tid); this.broadcast({ t: 'powner', from: old, to: tid }); } p.tid = tid; this.tribeOfToken.set(p.token, tid); this.broadcast(Object.assign({ t: 'tribe' }, this.pub(p))); }
  invite(p, targetId) {
    const q = this.players.get(targetId); if (!q || q.bot || q === p || p.dead > 0) return;
    if (Math.hypot(q.x - p.x, q.z - p.z) > 12) return this.notice(p, 'Está demasiado lejos');
    if (q.tid === p.tid) return;
    if (this.tribeInfo.has(q.tid)) return this.notice(p, 'Ese jugador ya tiene tribu');
    if (this.tribeInfo.has(p.tid) && this.tribeSize(p.tid) >= 3) return this.notice(p, 'Tu tribu está completa (máximo 3)');
    const cur = this.invites.get(q.id); if (cur && cur.from === p.id && this.t - cur.t < 5) return;
    this.invites.set(q.id, { from: p.id, t: this.t }); this.notice(p, 'Invitación enviada a ' + q.name);
    if (q.ws && q.ws.readyState === 1) q.ws.send(JSON.stringify({ t: 'invite', from: p.id, name: p.name }));
  }
  reply(p, fromId, accept) {
    const inv = this.invites.get(p.id); if (!inv || inv.from !== fromId || this.t - inv.t > 30) return; this.invites.delete(p.id);
    const f = this.players.get(fromId); if (!f || !accept) return f && this.notice(f, p.name + ' ha rechazado la invitación');
    if (this.tribeInfo.has(p.tid)) return this.notice(p, 'Ya tienes tribu');
    let tid = f.tid;
    if (!this.tribeInfo.has(tid)) { tid = 't' + (this.nextTribe++); this.tribeInfo.set(tid, { name: 'Tribu de ' + f.name, owner: f.token }); this.setTribe(f, tid); }
    if (this.tribeSize(tid) >= 3) return this.notice(p, 'Esa tribu está completa (máximo 3)');
    this.setTribe(p, tid); this.broadcastTribe(tid, { t: 'notice', text: p.name + ' se ha unido a la tribu' });
  }
  leaveTribe(p) {
    if (!this.tribeInfo.has(p.tid)) return; const old = p.tid; this.setTribe(p, 's:' + p.token);
    const left = this.members(old).filter((q) => !q.bot);
    if (left.length === 1) { const q = left[0]; this.tribeOfToken.delete(q.token); this.setTribe(q, 's:' + q.token); this.B.changeOwner(old, 's:' + q.token); this.D.changeOwner(old, 's:' + q.token); this.broadcast({ t: 'powner', from: old, to: 's:' + q.token }); this.tribeInfo.delete(old); this.notice(q, 'Tu tribu se ha disuelto'); }
    this.broadcastTribe(old, { t: 'notice', text: p.name + ' ha abandonado la tribu' });
  }
  chat(p, text) {
    text = String(text || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 120); if (!text || this.t < p.chatT) return; p.chatT = this.t + 1;
    if (text.startsWith('/t ')) { const tx = text.slice(3).trim(); if (tx && this.tribeInfo.has(p.tid)) this.broadcastTribe(p.tid, { t: 'chat', from: p.name, tribe: true, text: tx }); else this.notice(p, 'No tienes tribu'); return; }
    this.broadcast({ t: 'chat', from: p.name, tribe: false, text });
  }
  onMessage(p, m) {
    const now = performance.now();
    if (m.t === 'input') { const i = p.input; i.mx = Math.max(-1, Math.min(1, +m.mx || 0)); i.mz = Math.max(-1, Math.min(1, +m.mz || 0)); i.sprint = !!m.sprint; i.jump = !!m.jump; if (Number.isFinite(m.yaw)) p.yaw = m.yaw; }
    else if (m.t === 'pos') this.setPos(p, m, now);
    else if (m.t === 'attack') { if (m.target != null) this.meleeHit(p, +m.target, String(m.weapon || 'fists')); else this.attack(p); }
    else if (m.t === 'shot') this.shotHit(p, +m.target, String(m.weapon || 'bow'), +m.charge || 1);
    else if (m.t === 'selfdmg') { if (p.dead <= 0) this.hurt(p, Math.max(0, Math.min(35, +m.amt || 0)), null, m.cause); }
    else if (m.t === 'respawn') { if (p.dead > 0) { p.wantRespawn = true; p.dead = Math.min(p.dead, 1.2); } }
    else if (m.t === 'swing') this.broadcast({ t: 'swing', id: p.id });
    else if (m.t === 'chat') this.chat(p, m.text);
    else if (m.t === 'invite') this.invite(p, +m.target);
    else if (m.t === 'invreply') this.reply(p, +m.from, !!m.accept);
    else if (m.t === 'tleave') this.leaveTribe(p);
    else if (m.t === 'build') this.build(p, m.piece || {});
    else if (m.t === 'upgrade') this.upgrade(p, String(m.key));
    else if (m.t === 'door') this.door(p, String(m.key));
    else if (m.t === 'demolish') this.demolish(p, String(m.key));
    else if (m.t === 'repair') this.repair(p, String(m.key));
    else if (m.t === 'phit') this.pieceHit(p, String(m.key), String(m.weapon || 'fists'));
    else if (m.t === 'place') this.placeDep(p, m.dep || {});
    else if (m.t === 'dremove') this.removeDep(p, +m.id);
    else if (m.t === 'dhit') this.depHit(p, +m.id, String(m.weapon || 'fists'));
    else if (m.t === 'drepair') { const d = this.ownDep(p, +m.id); if (d && this.depNear(p, d, 8)) { d.hp = Math.min(d.maxHp, d.hp + d.maxHp * .3); this.broadcast({ t: 'dh', id: d.id, hp: Math.round(d.hp) }); } }
    else if (m.t === 'load') this.loadTurret(p, +m.id, +m.n || 0);
    else if (m.t === 'arm') this.armTrap(p, +m.id);
    else if (m.t === 'copen') this.chestOpen(p, +m.id);
    else if (m.t === 'cset') this.chestSet(p, +m.id, m.slots);
    else if (m.t === 'explode') this.clientExplode(p, String(m.kind), +m.x, +m.y, +m.z);
    else if (m.t === 'drop') this.dropBag(p, m.slots);
    else if (m.t === 'lpick') this.pickBag(p, +m.id);
    else if (m.t === 'bed') this.setBed(p, +m.id);
    else if (m.t === 'gard') this.garden(p, +m.id, String(m.act));
    else if (m.t === 'ndep') this.nodeDepleted(p, m);
    else if (m.t === 'ahit') this.animalHit(p, +m.id, String(m.weapon || 'fists'), false);
    else if (m.t === 'abutcher') this.animalHit(p, +m.id, String(m.weapon || 'fists'), true);
    else if (m.t === 'tame') this.tame(p, +m.id, String(m.item));
    else if (m.t === 'mount') this.mount(p, +m.id);
    else if (m.t === 'dismount') this.dismount(p);
  }
  // ---- construcción (autoritativa)
  near(p, c, R) { return Math.hypot(c.x - p.x, c.z - p.z) <= R && Math.abs(c.y - p.y) < 14; }
  deny(p, key, why) { if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify({ t: 'pdeny', key, why })); }
  build(p, d) {
    if (p.dead > 0) return; const probe = Object.assign({}, d, { tier: 0 });
    const res = this.B.place(probe, p.tid, this.B.countOf(p.tid)); if (!res.ok) return this.deny(p, d.key, res.why);
    if (!this.near(p, pieceCenter(res.p), 16)) { this.B.map.delete(res.p.key); return this.deny(p, d.key, 'Está demasiado lejos'); }
    this.broadcast({ t: 'pb', p: this.B.pub(res.p) });
  }
  own(p, key) { const q = this.B.get(key); return q && q.owner === p.tid ? q : null; }
  upgrade(p, key) {
    const q = this.own(p, key); if (!q || q.tier >= 3 || !this.near(p, pieceCenter(q), 8)) return; q.tier++; q.hp = this.B.maxHp(q);
    this.broadcast({ t: 'pu', key, tier: q.tier, hp: Math.round(q.hp) });
  }
  door(p, key) { const q = this.own(p, key); if (!q || q.kind !== 'door' || !this.near(p, pieceCenter(q), 8)) return; q.open = !q.open; this.broadcast({ t: 'po', key, open: q.open }); }
  repair(p, key) { const q = this.own(p, key); if (!q || !this.near(p, pieceCenter(q), 8)) return; q.hp = Math.min(this.B.maxHp(q), q.hp + this.B.maxHp(q) * .25); this.broadcast({ t: 'ph', key, hp: Math.round(q.hp) }); }
  demolish(p, key) { const q = this.own(p, key); if (!q || !this.near(p, pieceCenter(q), 8)) return; this.removePieces(q, p.id, true); }
  removePieces(q, by, refund) { const out = this.B.remove(q); this.broadcast({ t: 'pd', keys: out.map((x) => x.key), items: refund ? out.map((x) => ({ kind: x.kind, tier: x.tier })) : [], by }); return out; }
  damagePiece(q, dmg, by) {
    q.hp -= dmg; if (q.hp > 0) { this.broadcast({ t: 'ph', key: q.key, hp: Math.round(q.hp) }); return false; }
    this.removePieces(q, by ? by.id : 0, false); return true;
  }
  pieceHit(p, key, weapon) {
    if (p.dead > 0 || p.cd > 0) return; const q = this.B.get(key); if (!q || q.owner === p.tid) return; const base = PIECE_DMG[weapon] ?? 1;
    if (!this.near(p, pieceCenter(q), 5.2)) return; p.cd = .4; this.broadcast({ t: 'swing', id: p.id }); this.damagePiece(q, base * (1 - TIER_RES[q.tier]), p);
  }
  // ---- objetos colocables
  depNear(p, d, R) { return Math.hypot(d.x - p.x, d.z - p.z) <= R && Math.abs(d.y - p.y) < 8; }
  send(p, m) { if (p && p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(m)); }
  placeDep(p, d) {
    if (p.dead > 0) return; const t = String(d.t), x = +d.x, y = +d.y, z = +d.z;
    const fail = (why) => this.send(p, { t: 'ddeny', key: t, why });
    if (!DEF[t] || !Number.isFinite(x + y + z)) return fail('Objeto no válido');
    if (Math.hypot(x - p.x, z - p.z) > 14) return fail('Está demasiado lejos');
    if (this.D.countOf(p.tid) >= 150) return fail('Tu tribu ha alcanzado el límite de objetos');
    const o = this.D.add(t, x, y, z, d.r, p.tid); this.broadcast({ t: 'db', d: this.D.pub(o) });
  }
  ownDep(p, id) { const d = this.D.map.get(id); return d && d.owner === p.tid ? d : null; }
  removeDep(p, id) { const d = this.ownDep(p, id); if (!d || !this.depNear(p, d, 8)) return; this.D.map.delete(id); this.broadcast({ t: 'dd', id, by: p.id, refund: d.t }); if (d.slots) this.spill(d); }
  spill(d) { const bag = this.D.addBag(d.x, d.y + .3, d.z, d.slots); if (bag) { bag.expire = this.t + 300; this.broadcast({ t: 'lb', b: { id: bag.id, x: bag.x, y: bag.y, z: bag.z } }); } }
  destroyDep(d, by) {
    this.D.map.delete(d.id); this.broadcast({ t: 'dd', id: d.id, by: 0, refund: null });
    if (d.slots) this.spill(d);
    if (d.t === 'barrel') this.explode('barrel', d.x, d.y + .6, d.z, by);
  }
  damageDep(d, dmg, by) { d.hp -= dmg; if (d.hp > 0) { this.broadcast({ t: 'dh', id: d.id, hp: Math.round(d.hp) }); return; } this.destroyDep(d, by); }
  depHit(p, id, weapon) {
    const d = this.D.map.get(id); if (!d || p.dead > 0 || p.cd > 0 || d.owner === p.tid || !this.depNear(p, d, 5.2)) return; p.cd = .4; this.broadcast({ t: 'swing', id: p.id }); this.damageDep(d, DEP_DMG[weapon] ?? 1, p);
  }
  loadTurret(p, id, n) {
    const d = this.ownDep(p, id); if (!d || !DEF[d.t].turret || !this.depNear(p, d, 6)) return this.send(p, { t: 'dammo', id, refund: n });
    const cap = DEF[d.t].turret.cap, ok = Math.max(0, Math.min(n, cap - d.ammo)); d.ammo += ok; this.send(p, { t: 'dammo', id, ammo: d.ammo, refund: n - ok }); this.broadcast({ t: 'da', id, ammo: d.ammo });
  }
  armTrap(p, id) { const d = this.ownDep(p, id); if (!d || d.t !== 'beartrap' || d.armed || !this.depNear(p, d, 4)) return; d.armed = true; this.broadcast({ t: 'da', id, armed: true }); }
  chestOpen(p, id) { const d = this.D.map.get(id); if (!d || d.t !== 'chest' || d.owner !== p.tid || !this.depNear(p, d, 6)) return this.notice(p, 'No puedes abrir este cofre'); this.send(p, { t: 'chest', id, slots: d.slots }); }
  chestSet(p, id, slots) {
    const d = this.D.map.get(id); if (!d || d.t !== 'chest' || d.owner !== p.tid || !this.depNear(p, d, 8) || !Array.isArray(slots) || slots.length !== 24) return;
    d.slots = slots.map((s) => (s && typeof s.id === 'string' && s.n > 0 ? { id: s.id.slice(0, 24), n: Math.min(999, s.n | 0), dur: s.dur } : null));
  }
  setBed(p, id) { const d = this.ownDep(p, id); if (d && d.t === 'bed') { p.bed = id; this.notice(p, 'Reaparecerás en esta cama'); } }
  garden(p, id, act) {
    const d = this.ownDep(p, id); if (!d || d.t !== 'garden' || !this.depNear(p, d, 5)) return;
    if (act === 'plant' && !d.planted) { d.planted = true; d.grow = 0; this.broadcast({ t: 'da', id, planted: true, grow: 0 }); }
    else if (act === 'harvest' && d.planted && d.grow >= 1) { d.planted = false; d.grow = 0; this.broadcast({ t: 'da', id, planted: false, grow: 0 }); this.send(p, { t: 'give', items: [['berries', 6], ['apple', 3], ['seeds', 2]] }); }
  }
  // ---- explosiones: daño en área a jugadores, construcciones y objetos
  clientExplode(p, kind, x, y, z) {
    if (p.dead > 0 || !EXPLOSIONS[kind] || kind === 'barrel' || kind === 'shell' || kind === 'mine' || !Number.isFinite(x + y + z)) return;
    if (this.t < (p.exT || 0)) return; p.exT = this.t + 1.2; if (Math.hypot(x - p.x, z - p.z) > 30) return; this.explode(kind, x, y, z, p);
  }
  explode(kind, x, y, z, by) {
    const E = EXPLOSIONS[kind]; if (!E) return; this.broadcast({ t: 'boom', x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), R: E.R, dmg: E.dmg });
    for (const q of [...this.players.values()]) { if (q.dead > 0 || (by && q.tid === by.tid && q !== by && false)) continue; const d = Math.hypot(q.x - x, q.y + 1 - y, q.z - z); if (d < E.R) { if (by && q.tid === by.tid) continue; this.hurt(q, E.dmg * .4 * (1 - d / E.R * .6), by || null, 'explosion'); } }
    for (const pc of [...this.B.map.values()]) { if (by && pc.owner === by.tid) continue; const c = pieceCenter(pc), dd = Math.max(0, Math.hypot(c.x - x, c.y - y, c.z - z) - 1.5); if (dd < E.R && this.B.map.has(pc.key)) this.damagePiece(pc, E.dmg * E.pm * (1 - EXP_RES[pc.tier]) * (1 - dd / E.R * .5), by || null); }
    for (const d of [...this.D.map.values()]) { if (by && d.owner === by.tid) continue; const dd = Math.hypot(d.x - x, d.y - y, d.z - z); if (dd < E.R && d.t !== 'mine' && this.D.map.has(d.id)) this.damageDep(d, E.dmg * .6 * (1 - dd / E.R * .5), by || null); }
  }
  // ---- botín: al morir se suelta lo que llevabas; los cofres destruidos sueltan su contenido
  dropBag(p, slots) {
    if (!Array.isArray(slots) || p.dead <= 0 || p.dropped) return; p.dropped = true; const clean = slots.slice(0, 40).map((s) => (s && typeof s.id === 'string' && s.n > 0 ? { id: s.id.slice(0, 24), n: Math.min(999, s.n | 0), dur: s.dur } : null));
    const bag = this.D.addBag(p.x, p.y + .3, p.z, clean); if (bag) { bag.expire = this.t + 300; this.broadcast({ t: 'lb', b: { id: bag.id, x: bag.x, y: bag.y, z: bag.z } }); }
  }
  pickBag(p, id) { const b = this.D.bags.get(id); if (!b || p.dead > 0 || Math.hypot(b.x - p.x, b.z - p.z) > 4) return; this.D.bags.delete(id); this.broadcast({ t: 'lx', id }); this.send(p, { t: 'give', items: b.slots.map((s) => [s.id, s.n]) }); }
  // ---- trampas y torretas (se evalúan en cada tick)
  enemiesNear(d, R, minR = 0) { const out = []; for (const q of this.players.values()) { if (q.dead > 0 || q.tid === d.owner || q.prot > this.t) continue; const dist = Math.hypot(q.x - d.x, q.z - d.z); if (dist <= R && dist >= minR && Math.abs(q.y - d.y) < 10) out.push([q, dist]); } return out; }
  tickDeps(dt) {
    for (const d of [...this.D.map.values()]) {
      if (d.cd > 0) d.cd -= dt; const T = DEF[d.t].turret;
      if (d.t === 'garden' && d.planted && d.grow < 1) d.grow = Math.min(1, d.grow + dt / 300);
      else if (T && d.ammo > 0) {
        const es = this.enemiesNear(d, T.range, T.min || 0); if (!es.length) continue;
        if (d.cd > 0) continue; d.cd = T.cd; const tgt = d.t === 'mortar' ? es.sort((a, b) => b[1] - a[1])[0][0] : es.sort((a, b) => a[1] - b[1])[0][0];
        if (d.t === 'ballista') { d.ammo--; this.broadcast({ t: 'fx', k: 'bolt', id: d.id, x: d.x, y: d.y + 1.15, z: d.z, tx: tgt.x, ty: tgt.y + 1.1, tz: tgt.z }); this.hurt(tgt, T.dmg, null, 'trap'); }
        else if (d.t === 'flamer') { d.fuel = (d.fuel || 0) + T.cd; if (d.fuel >= 3) { d.fuel = 0; d.ammo--; } this.broadcast({ t: 'fx', k: 'flame', id: d.id, x: d.x, y: d.y + 1.1, z: d.z, tx: tgt.x, ty: tgt.y, tz: tgt.z }); for (const [q] of es) { const a = Math.atan2(q.x - d.x, q.z - d.z), b = Math.atan2(tgt.x - d.x, tgt.z - d.z); let da = Math.abs(a - b); if (da > Math.PI) da = 2 * Math.PI - da; if (da < .5) this.hurt(q, T.dmg, null, 'fire'); } }
        else { d.ammo--; this.broadcast({ t: 'fx', k: 'shell', id: d.id, x: d.x, y: d.y + .9, z: d.z, tx: tgt.x, ty: tgt.y, tz: tgt.z }); const tx = tgt.x, ty = tgt.y, tz = tgt.z; setTimeout(() => this.explode('shell', tx, ty + .3, tz, null), 2400); }
        this.broadcast({ t: 'da', id: d.id, ammo: d.ammo });
      } else if (d.t === 'spikes') {
        for (const [q] of this.enemiesNear(d, 1.2)) { if (this.t < (q.spikeT || 0)) continue; q.spikeT = this.t + .5; this.send(q, { t: 'slow', s: .4, dur: .8 }); this.hurt(q, 10, null, 'trap'); this.damageDep(d, 6, null); if (!this.D.map.has(d.id)) break; }
      } else if (d.t === 'beartrap' && d.armed) {
        const es = this.enemiesNear(d, .9); if (es.length) { const q = es[0][0]; d.armed = false; this.broadcast({ t: 'da', id: d.id, armed: false }); this.send(q, { t: 'stun', dur: 4 }); this.hurt(q, 35, null, 'trap'); }
      } else if (d.t === 'mine') {
        if (this.enemiesNear(d, 1.3).length) { this.D.map.delete(d.id); this.broadcast({ t: 'dd', id: d.id, by: 0, refund: null }); this.explode('mine', d.x, d.y + .3, d.z, null); }
      } else if (d.t === 'bell') {
        if ((this.t - (d.ring || -99) > 15) && this.enemiesNear(d, 30).length) { d.ring = this.t; this.broadcastTribe(d.owner, { t: 'alarm', x: d.x, z: d.z }); }
      }
    }
    for (const b of [...this.D.bags.values()]) if (this.t > b.expire) { this.D.bags.delete(b.id); this.broadcast({ t: 'lx', id: b.id }); }
  }
  // ciclo de día y noche compartido: 600 s por día, empieza por la mañana (igual que el cliente)
  phase() { return ((this.t + 42) / 600) % 1; }
  sunElev() { const p = this.phase(); return p < .72 ? Math.sin(Math.PI * p / .72) : -Math.sin(Math.PI * (p - .72) / .28) * .7; }
  // ---- recursos compartidos (árboles, rocas…): quien los agota los agota para todos, y reaparecen con el tiempo
  nodeDepleted(p, m) {
    const id = m.id | 0; if (id < 0 || id > 200000 || this.nodes.has(id) || this.t < (p.ndT || 0)) return; p.ndT = this.t + .15;
    const rt = Math.max(60, Math.min(900, +m.rt || 300)); this.nodes.set(id, this.t + rt); this.broadcast({ t: 'nd', id, by: p.id });
  }
  tickNodes() { for (const [id, at] of [...this.nodes]) if (this.t >= at) { this.nodes.delete(id); this.broadcast({ t: 'nr', id }); } }
  // ---- fauna
  animalHit(p, id, weapon, butcher) {
    const a = this.fauna.map.get(id); if (!a || p.dead > 0 || p.cd > 0) return; const w = WEAPONS[weapon] || WEAPONS.fists;
    if (Math.hypot(a.x - p.x, a.z - p.z) > w[1] + 1.4) return; p.cd = .35; this.broadcast({ t: 'swing', id: p.id });
    if (butcher || a.dead) { if (a.dead) this.fauna.butcher(a, p, Math.max(w[0] * .8, 6)); return; }
    if (a.owner === p.tid) return; this.fauna.hurt(a, w[0], p);
    this.broadcast({ t: 'ahit', id: a.id });
  }
  tame(p, id, item) {
    const a = this.fauna.map.get(id); if (!a || a.dead || a.owner || p.dead > 0) return this.send(p, { t: 'give', items: [[item, 1]] }); const D = ANI[a.type];
    if (!D.tameFood || !D.tameFood.includes(item) || Math.hypot(a.x - p.x, a.z - p.z) > 4) return this.send(p, { t: 'give', items: [[item, 1]] });
    a.tame = Math.min(100, a.tame + (a.type === 'horse' ? 34 : 26)); a.provoked = 0; this.send(p, { t: 'tameprog', id, v: Math.round(a.tame) });
    if (a.tame >= 100) { a.owner = p.tid; a.tame = 100; this.broadcast({ t: 'tamed', id, name: p.name }); }
  }
  mount(p, id) {
    const a = this.fauna.map.get(id); if (!a || a.dead || a.owner !== p.tid || !ANI[a.type].mount || a.rider || p.mount || p.dead > 0 || Math.hypot(a.x - p.x, a.z - p.z) > 4.5) return;
    a.rider = p.id; p.mount = id; this.send(p, { t: 'mounted', id });
  }
  dismount(p) { const a = p.mount && this.fauna.map.get(p.mount); if (a) a.rider = 0; p.mount = 0; this.send(p, { t: 'mounted', id: 0 }); }
  // posición enviada por el cliente (predicción); el servidor la valida para frenar teletransportes y velocidades imposibles
  setPos(p, m, now) {
    if (p.dead > 0) return;
    const x = +m.x, y = +m.y, z = +m.z; if (!Number.isFinite(x + y + z)) return;
    const dt = Math.min(1, Math.max(.02, (now - (p.lastPos || now - 50)) / 1000)); p.lastPos = now; p.cs = true;
    const d = Math.hypot(x - p.x, z - p.z), lim = this.half * .99;
    if (d > (p.mount ? 22 : 16) * dt + 2.5 || Math.abs(x) > lim || Math.abs(z) > lim) { p.strikes = (p.strikes || 0) + 1; if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify({ t: 'correct', x: p.x, y: p.y, z: p.z })); return; }
    p.x = x; p.y = y; p.z = z; if (Number.isFinite(+m.yaw)) p.yaw = +m.yaw; if (Number.isFinite(+m.pitch)) p.pitch = +m.pitch;
  }
  find(id) { const q = this.players.get(id); return q && q.dead <= 0 ? q : null; }
  meleeHit(p, id, weapon) {
    if (p.cd > 0 || p.dead > 0) return; this.broadcast({ t: 'swing', id: p.id }); const w = WEAPONS[weapon] || WEAPONS.fists, q = this.find(id); p.cd = .35; if (!q || q === p || q.tid === p.tid) return;
    if (Math.hypot(q.x - p.x, q.z - p.z) > w[1] + 1.2 || Math.abs(q.y - p.y) > 3) return; this.hurt(q, w[0], p);
  }
  shotHit(p, id, weapon, charge) {
    if (p.dead > 0 || !RANGED[weapon]) return; if (p.shotCd > this.t) return; p.shotCd = this.t + .25; const q = this.find(id); if (!q || q === p || q.tid === p.tid) return;
    if (Math.hypot(q.x - p.x, q.z - p.z) > 140) return; const c = Math.max(.3, Math.min(1, charge)); this.hurt(q, RANGED[weapon] * (weapon === 'bow' ? .3 + .7 * c : 1), p);
  }
  attack(p) {
    if (p.cd > 0 || p.dead > 0) return; p.cd = ATK_CD; let best = null, bd = REACH;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    for (const q of this.players.values()) { if (q === p || q.dead > 0 || q.tid === p.tid) continue; const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz); if (d < bd && (dx * fx + dz * fz) / (d || 1) > .3) { bd = d; best = q; } }
    if (best) this.hurt(best, DMG, p);
  }
  hurt(q, dmg, by, cause) { if (!(dmg > 0)) return; if ((by || cause === 'trap' || cause === 'fire' || cause === 'explosion' || cause === 'animal') && by !== q && cause !== 'selfdmg' && q.prot > this.t) return; if (by && by.prot > this.t) by.prot = 0; q.hp -= dmg; q.regenT = this.t + 10; this.broadcast({ t: 'hit', id: q.id, hp: Math.max(0, Math.round(q.hp)), by: by ? by.id : 0 }); if (q.hp <= 0 && !(q.dead > 0)) { q.dead = 4; q.deaths++; if (by) by.kills++; this.broadcast({ t: 'kill', victim: q.id, killer: by ? by.id : 0, cause: cause || '' }); } }
  tick() {
    this.t += DT;
    for (const p of this.players.values()) {
      if (p.bot && p.brain) p.brain(this, p);
      if (p.cd > 0) p.cd -= DT;
      if (p.hp < HP && p.dead <= 0 && this.t > (p.regenT || 0)) p.hp = Math.min(HP, p.hp + DT * 1.2);
      if (p.dead > 0) { if (p.bot || p.wantRespawn) p.dead -= DT; if (p.dead <= 0) { p.wantRespawn = false; const bd = p.bed && this.D.map.get(p.bed), sp = bd && bd.owner === p.tid ? { x: bd.x, z: bd.z } : this.spawnPoint(); p.x = sp.x; p.z = sp.z; p.y = bd && bd.owner === p.tid ? bd.y + .7 : this.T.terrainH(p.x, p.z); p.dropped = false; p.hp = HP; p.prot = this.t + Math.min(20, PROT); if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify({ t: 'respawn', x: p.x, y: p.y, z: p.z })); } continue; }
      if (p.cs) continue;
      const i = p.input, len = Math.hypot(i.mx, i.mz) || 1, sp = i.sprint ? SPRINT : SPEED;
      // mz>0 = adelante; yaw igual que el cliente (-sin, -cos)
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = -fz, rz = fx;
      const nx = p.x + (fx * i.mz + rx * i.mx) / len * sp * DT * (len > 0 && (i.mx || i.mz) ? 1 : 0), nz = p.z + (fz * i.mz + rz * i.mx) / len * sp * DT * ((i.mx || i.mz) ? 1 : 0);
      const lim = this.half * .97, rr = Math.hypot(nx, nz), k = rr > lim ? lim / rr : 1, ny = this.T.terrainH(nx * k, nz * k);
      if (ny > this.sea - 1.1 && Math.abs(ny - p.y) < 1.3 + Math.abs(p.vy) * DT) { p.x = nx * k; p.z = nz * k; }
      const g = this.T.terrainH(p.x, p.z); if (i.jump && p.y <= g + .05) p.vy = 7; p.vy -= 22 * DT; p.y += p.vy * DT; if (p.y <= g) { p.y = g; p.vy = 0; }
    }
    this.tickDeps(DT); this.tickNodes(); this.fauna.update(DT); this.isNight = this.sunElev() < -.02; if (this.t >= (this.timeT || 0)) { this.timeT = this.t + 10; this.broadcast({ t: 'time', phase: +this.phase().toFixed(4), day: Math.floor((this.t + 42) / 600) + 1 }); }
    this.snapshot();
  }
  snapshot() {
    const list = [...this.players.values()];
    for (const me of list) {
      if (!me.ws || me.ws.readyState !== 1) continue;
      const near = []; for (const q of list) { if (Math.hypot(q.x - me.x, q.z - me.z) > RADIUS && q !== me) continue; near.push([q.id, +q.x.toFixed(2), +q.y.toFixed(2), +q.z.toFixed(2), +q.yaw.toFixed(3), Math.max(0, Math.round(q.hp)), q.dead > 0 ? 1 : 0, q.mount ? 1 : 0]); }
      const an = []; for (const a of this.fauna.map.values()) if (Math.hypot(a.x - me.x, a.z - me.z) <= RADIUS) an.push(this.fauna.pub(a));
      me.ws.send(JSON.stringify({ t: 'snap', n: Math.round(this.t * 20), me: me.id, p: near, a: an }));
    }
  }
  broadcast(m) { const s = JSON.stringify(m); for (const p of this.players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(s); }
  broadcastTribe(tid, m) { const s = JSON.stringify(m); for (const p of this.players.values()) if (p.tid === tid && p.ws && p.ws.readyState === 1) p.ws.send(s); }
  info() { return { map: this.mapId, name: this.map.name, players: this.humans, bots: this.count - this.humans, max: this.max }; }
  close() { clearInterval(this.timer); }
}
