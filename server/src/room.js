import { createTerrain } from '../../shared/terrain.js';
import { MAPS, DT } from '../../shared/maps.js';
const WEAPONS = { fists: [4, 3.2], stone_axe: [13, 3.8], stone_pick: [13, 3.8], hammer: [10, 3.8], spear: [26, 4.8], iron_axe: [22, 4], iron_pick: [22, 4], iron_sword: [48, 4.2] }, RANGED = { bow: 40, crossbow: 80 };
const PROT = process.env.PROT_SECONDS !== undefined ? +process.env.PROT_SECONDS : 30;
const SPEED = 4.8, SPRINT = 7.8, RADIUS = 160, HP = 100, REACH = 2.6, DMG = 14, ATK_CD = .6;
export class Room {
  constructor(mapId, maxPlayers = 20) { this.mapId = mapId; this.map = MAPS[mapId]; this.T = createTerrain({ world: this.map.world, seed: this.map.seed }); this.half = this.map.world / 2; this.sea = 0; this.max = maxPlayers; this.players = new Map(); this.nextId = 1; this.t = 0; this.tribeInfo = new Map(); this.tribeOfToken = new Map(); this.invites = new Map(); this.nextTribe = 1; this.timer = setInterval(() => this.tick(), DT * 1000); }
  get humans() { let n = 0; for (const p of this.players.values()) if (!p.bot) n++; return n; }
  get count() { return this.players.size; }
  spawnPoint() { for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, r = this.half * (.2 + Math.random() * .5), x = Math.cos(a) * r, z = Math.sin(a) * r; if (this.T.terrainH(x, z) > 1.5) return { x, z }; } return { x: 0, z: 0 }; }
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
  leave(p) { this.players.delete(p.id); this.invites.delete(p.id); this.broadcast({ t: 'leave', id: p.id }); }
  setTribe(p, tid) { p.tid = tid; this.tribeOfToken.set(p.token, tid); this.broadcast(Object.assign({ t: 'tribe' }, this.pub(p))); }
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
    if (left.length === 1) { const q = left[0]; this.tribeOfToken.delete(q.token); this.setTribe(q, 's:' + q.token); this.tribeInfo.delete(old); this.notice(q, 'Tu tribu se ha disuelto'); }
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
  }
  // posición enviada por el cliente (predicción); el servidor la valida para frenar teletransportes y velocidades imposibles
  setPos(p, m, now) {
    if (p.dead > 0) return;
    const x = +m.x, y = +m.y, z = +m.z; if (!Number.isFinite(x + y + z)) return;
    const dt = Math.min(1, Math.max(.02, (now - (p.lastPos || now - 50)) / 1000)); p.lastPos = now; p.cs = true;
    const d = Math.hypot(x - p.x, z - p.z), lim = this.half * .99;
    if (d > 16 * dt + 2.5 || Math.abs(x) > lim || Math.abs(z) > lim) { p.strikes = (p.strikes || 0) + 1; if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify({ t: 'correct', x: p.x, y: p.y, z: p.z })); return; }
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
  hurt(q, dmg, by, cause) { if (!(dmg > 0)) return; if (by && by !== q && q.prot > this.t) return; if (by && by.prot > this.t) by.prot = 0; q.hp -= dmg; q.regenT = this.t + 10; this.broadcast({ t: 'hit', id: q.id, hp: Math.max(0, Math.round(q.hp)), by: by ? by.id : 0 }); if (q.hp <= 0 && !(q.dead > 0)) { q.dead = 4; q.deaths++; if (by) by.kills++; this.broadcast({ t: 'kill', victim: q.id, killer: by ? by.id : 0, cause: cause || '' }); } }
  tick() {
    this.t += DT;
    for (const p of this.players.values()) {
      if (p.bot && p.brain) p.brain(this, p);
      if (p.cd > 0) p.cd -= DT;
      if (p.hp < HP && p.dead <= 0 && this.t > (p.regenT || 0)) p.hp = Math.min(HP, p.hp + DT * 1.2);
      if (p.dead > 0) { if (p.bot || p.wantRespawn) p.dead -= DT; if (p.dead <= 0) { p.wantRespawn = false; const sp = this.spawnPoint(); p.x = sp.x; p.z = sp.z; p.y = this.T.terrainH(p.x, p.z); p.hp = HP; p.prot = this.t + Math.min(20, PROT); if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify({ t: 'respawn', x: p.x, y: p.y, z: p.z })); } continue; }
      if (p.cs) continue;
      const i = p.input, len = Math.hypot(i.mx, i.mz) || 1, sp = i.sprint ? SPRINT : SPEED;
      // mz>0 = adelante; yaw igual que el cliente (-sin, -cos)
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = -fz, rz = fx;
      const nx = p.x + (fx * i.mz + rx * i.mx) / len * sp * DT * (len > 0 && (i.mx || i.mz) ? 1 : 0), nz = p.z + (fz * i.mz + rz * i.mx) / len * sp * DT * ((i.mx || i.mz) ? 1 : 0);
      const lim = this.half * .97, rr = Math.hypot(nx, nz), k = rr > lim ? lim / rr : 1, ny = this.T.terrainH(nx * k, nz * k);
      if (ny > this.sea - 1.1 && Math.abs(ny - p.y) < 1.3 + Math.abs(p.vy) * DT) { p.x = nx * k; p.z = nz * k; }
      const g = this.T.terrainH(p.x, p.z); if (i.jump && p.y <= g + .05) p.vy = 7; p.vy -= 22 * DT; p.y += p.vy * DT; if (p.y <= g) { p.y = g; p.vy = 0; }
    }
    this.snapshot();
  }
  snapshot() {
    const list = [...this.players.values()];
    for (const me of list) {
      if (!me.ws || me.ws.readyState !== 1) continue;
      const near = []; for (const q of list) { if (Math.hypot(q.x - me.x, q.z - me.z) > RADIUS && q !== me) continue; near.push([q.id, +q.x.toFixed(2), +q.y.toFixed(2), +q.z.toFixed(2), +q.yaw.toFixed(3), Math.max(0, Math.round(q.hp)), q.dead > 0 ? 1 : 0]); }
      me.ws.send(JSON.stringify({ t: 'snap', n: Math.round(this.t * 20), me: me.id, p: near }));
    }
  }
  broadcast(m) { const s = JSON.stringify(m); for (const p of this.players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(s); }
  broadcastTribe(tid, m) { const s = JSON.stringify(m); for (const p of this.players.values()) if (p.tid === tid && p.ws && p.ws.readyState === 1) p.ws.send(s); }
  info() { return { map: this.mapId, name: this.map.name, players: this.humans, bots: this.count - this.humans, max: this.max }; }
  close() { clearInterval(this.timer); }
}
