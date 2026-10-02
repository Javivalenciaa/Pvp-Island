import { heightAt, biomeAt, MAPS, DT } from '../../shared/world.js';
const SPEED = 4.8, SPRINT = 7.8, RADIUS = 160, HP = 100, REACH = 2.6, DMG = 14, ATK_CD = .6;
export class Room {
  constructor(mapId, maxPlayers = 20) { this.mapId = mapId; this.map = MAPS[mapId]; this.max = maxPlayers; this.players = new Map(); this.nextId = 1; this.t = 0; this.tribes = new Map(); this.timer = setInterval(() => this.tick(), DT * 1000); }
  get humans() { let n = 0; for (const p of this.players.values()) if (!p.bot) n++; return n; }
  get count() { return this.players.size; }
  spawnPoint() { for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, r = this.map.size * (.15 + Math.random() * .25), x = Math.cos(a) * r, z = Math.sin(a) * r; if (heightAt(this.map, x, z) > 1.5) return { x, z }; } return { x: 0, z: 0 }; }
  join(name, tribe, ws, bot = false) {
    if (this.count >= this.max) return null;
    const id = this.nextId++, sp = this.spawnPoint(), tr = tribe || `Tribu ${1 + (id % 4)}`;
    const p = { id, name: (name || 'Jugador').slice(0, 16), tribe: tr, bot, ws, x: sp.x, z: sp.z, y: heightAt(this.map, sp.x, sp.z), vy: 0, yaw: 0, hp: HP, input: { mx: 0, mz: 0, sprint: false, jump: false }, cd: 0, kills: 0, deaths: 0, dead: 0 };
    this.players.set(id, p); this.tribes.set(tr, (this.tribes.get(tr) || 0) + 1); this.broadcast({ t: 'join', id, name: p.name, tribe: tr, bot });
    return p;
  }
  leave(p) { this.players.delete(p.id); this.tribes.set(p.tribe, Math.max(0, (this.tribes.get(p.tribe) || 1) - 1)); this.broadcast({ t: 'leave', id: p.id }); }
  onMessage(p, m) {
    if (m.t === 'input') { const i = p.input; i.mx = Math.max(-1, Math.min(1, +m.mx || 0)); i.mz = Math.max(-1, Math.min(1, +m.mz || 0)); i.sprint = !!m.sprint; i.jump = !!m.jump; if (Number.isFinite(m.yaw)) p.yaw = m.yaw; }
    else if (m.t === 'attack') this.attack(p);
    else if (m.t === 'chat') this.broadcastTribe(p.tribe, { t: 'chat', from: p.name, tribe: true, text: String(m.text || '').slice(0, 120) });
  }
  attack(p) {
    if (p.cd > 0 || p.dead > 0) return; p.cd = ATK_CD; let best = null, bd = REACH;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    for (const q of this.players.values()) { if (q === p || q.dead > 0 || q.tribe === p.tribe) continue; const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz); if (d < bd && (dx * fx + dz * fz) / (d || 1) > .3) { bd = d; best = q; } }
    if (best) this.hurt(best, DMG, p);
  }
  hurt(q, dmg, by) { q.hp -= dmg; if (q.hp <= 0 && !q.dead) { q.dead = 4; q.deaths++; if (by) by.kills++; this.broadcast({ t: 'kill', victim: q.id, killer: by ? by.id : 0 }); } }
  tick() {
    this.t += DT;
    for (const p of this.players.values()) {
      if (p.bot && p.brain) p.brain(this, p);
      if (p.cd > 0) p.cd -= DT;
      if (p.dead > 0) { p.dead -= DT; if (p.dead <= 0) { const sp = this.spawnPoint(); p.x = sp.x; p.z = sp.z; p.y = heightAt(this.map, p.x, p.z); p.hp = HP; } continue; }
      const i = p.input, len = Math.hypot(i.mx, i.mz) || 1, sp = i.sprint ? SPRINT : SPEED;
      // mz>0 = adelante; yaw igual que el cliente (-sin, -cos)
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = -fz, rz = fx;
      const nx = p.x + (fx * i.mz + rx * i.mx) / len * sp * DT * (len > 0 && (i.mx || i.mz) ? 1 : 0), nz = p.z + (fz * i.mz + rz * i.mx) / len * sp * DT * ((i.mx || i.mz) ? 1 : 0);
      const lim = this.map.size / 2 * .97, rr = Math.hypot(nx, nz), k = rr > lim ? lim / rr : 1, ny = heightAt(this.map, nx * k, nz * k);
      if (ny > this.map.sea - 1.1 && Math.abs(ny - p.y) < 1.3 + Math.abs(p.vy) * DT) { p.x = nx * k; p.z = nz * k; }
      const g = heightAt(this.map, p.x, p.z); if (i.jump && p.y <= g + .05) p.vy = 7; p.vy -= 22 * DT; p.y += p.vy * DT; if (p.y <= g) { p.y = g; p.vy = 0; }
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
  broadcastTribe(tribe, m) { const s = JSON.stringify(m); for (const p of this.players.values()) if (p.tribe === tribe && p.ws && p.ws.readyState === 1) p.ws.send(s); }
  info() { return { map: this.mapId, name: this.map.name, players: this.humans, bots: this.count - this.humans, max: this.max }; }
  close() { clearInterval(this.timer); }
}
