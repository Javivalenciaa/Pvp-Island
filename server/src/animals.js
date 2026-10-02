// Fauna simulada en el servidor: ciervos, jabalíes, lobos y caballos (domables). Los clientes solo dibujan lo que reciben.
export const ANI = {
  deer: { hp: 50, walk: 1.5, run: 8.2, temper: 'flee', fleeR: 15, loot: { meat: 5, hide: 3, fat: 2 }, n: 14 },
  boar: { hp: 85, walk: 1.3, run: 6, temper: 'defend', provokeR: 5, dmg: 12, cd: 1.1, reach: 1.7, loot: { meat: 6, hide: 2, fat: 4 }, n: 8 },
  wolf: { hp: 60, walk: 1.8, run: 6.6, temper: 'hunt', aggro: 26, dmg: 9, cd: .95, reach: 1.6, loot: { meat: 3, hide: 3, fat: 1 }, n: 8 },
  horse: { hp: 120, walk: 2, run: 11, temper: 'flee', fleeR: 12, loot: { meat: 8, hide: 4 }, n: 6, tameFood: ['apple', 'berries'], mount: true },
};
ANI.wolf.tameFood = ['raw_meat', 'cooked_meat'];
export class Fauna {
  constructor(room) { this.room = room; this.map = new Map(); this.next = 1; }
  spawnAll() { for (const [type, d] of Object.entries(ANI)) for (let i = 0; i < d.n; i++) this.spawn(type); }
  spawn(type, near) {
    const r = this.room, T = r.T;
    for (let t = 0; t < 60; t++) {
      const a = Math.random() * 6.283, rr = r.half * (.1 + Math.random() * .75), x = near ? near.x + (Math.random() - .5) * 60 : Math.cos(a) * rr, z = near ? near.z + (Math.random() - .5) * 60 : Math.sin(a) * rr;
      const h = T.terrainH(x, z); if (h > 1.8 && h < 22 && !T.lakeAt(x, z) && T.slopeAt(x, z) < .5 && Math.hypot(x, z) < r.half * .93) {
        const an = { id: this.next++, type, x, y: h, z, yaw: Math.random() * 6.283, hp: ANI[type].hp, dead: 0, corpse: 60, acc: [0, 0, 0], provoked: 0, wx: x, wz: z, timer: 1, atk: 0, tame: 0, owner: null, rider: 0, mode: 0, spd: 0 };
        this.map.set(an.id, an); return an;
      }
    }
    return null;
  }
  pub(a) { return [a.id, a.type, +a.x.toFixed(2), +a.y.toFixed(2), +a.z.toFixed(2), +a.yaw.toFixed(2), Math.max(0, Math.round(a.hp / ANI[a.type].hp * 100)), (a.dead ? 1 : 0) | (a.owner ? 2 : 0) | (a.rider ? 4 : 0), a.mode, +a.spd.toFixed(1)]; }
  hurt(a, dmg, p) {
    if (a.dead) return; a.hp -= dmg; a.provoked = 14; a.lastBy = p ? p.id : 0;
    if (a.hp <= 0) { a.dead = this.room.t; a.rider = 0; this.room.broadcast({ t: 'adead', id: a.id }); }
  }
  butcher(a, p, dmg) {
    const D = ANI[a.type], c = Math.min(dmg, a.corpse); a.corpse -= c; const done = a.corpse <= .001, give = [];
    [['raw_meat', D.loot.meat], ['hide', D.loot.hide], ['fat', D.loot.fat || 0]].forEach(([id, total], i) => { a.acc[i] += total * c / 60; const whole = done ? Math.round(a.acc[i]) : Math.floor(a.acc[i]); a.acc[i] -= whole; if (whole > 0) give.push([id, whole]); });
    if (give.length) this.room.send(p, { t: 'give', items: give }); if (done) this.map.delete(a.id);
  }
  update(dt) {
    const r = this.room, T = r.T, t = r.t, players = [...r.players.values()].filter((q) => q.dead <= 0 && q.prot <= t);
    const counts = {}; for (const a of this.map.values()) if (!a.dead) counts[a.type] = (counts[a.type] || 0) + 1;
    for (const [type, d] of Object.entries(ANI)) if ((counts[type] || 0) < d.n && Math.random() < dt * .1) this.spawn(type);
    for (const a of [...this.map.values()]) {
      const D = ANI[a.type];
      if (a.dead) { if (t - a.dead > 150) this.map.delete(a.id); continue; }
      if (a.rider) { const q = r.players.get(a.rider); if (!q || q.dead > 0) { a.rider = 0; } else { a.spd = Math.hypot(q.x - a.x, q.z - a.z) / dt; a.yaw = q.yaw + Math.PI; a.x = q.x; a.y = q.y - .1; a.z = q.z; a.mode = a.spd > 6 ? 2 : 0; continue; } }
      a.provoked = Math.max(0, a.provoked - dt); a.atk -= dt;
      const tame = !!a.owner, enemyOf = (q) => !tame || q.tid !== a.owner;
      let near = null, nd = 1e9; for (const q of players) { const d = Math.hypot(q.x - a.x, q.z - a.z); if (d < nd && Math.abs(q.y - a.y) < 8 && (tame ? false : true)) { nd = d; near = q; } }
      let mx = 0, mz = 0, sp = 0, mode = 0, tgt = null;
      if (tame && a.type === 'wolf') {
        // sigue a su tribu y ataca a los enemigos cercanos
        let own = null, od = 1e9; for (const q of players) if (q.tid === a.owner) { const d = Math.hypot(q.x - a.x, q.z - a.z); if (d < od) { od = d; own = q; } }
        let foe = null, fd = 14; for (const q of players) if (q.tid !== a.owner) { const d = Math.hypot(q.x - a.x, q.z - a.z); if (d < fd) { fd = d; foe = q; } }
        if (foe && (!own || Math.hypot(foe.x - own.x, foe.z - own.z) < 30)) { tgt = foe; mode = 1; mx = foe.x - a.x; mz = foe.z - a.z; sp = D.run; const dist = Math.hypot(mx, mz); if (dist < D.reach + .4) { sp = 0; if (a.atk <= 0) { a.atk = D.cd; r.hurt(foe, D.dmg, null, 'animal'); } } }
        else if (own && od > 5) { mx = own.x - a.x; mz = own.z - a.z; sp = od > 14 ? D.run : D.walk * 1.5; }
      } else if (!tame || a.type !== 'wolf') {
        const hunter = D.temper === 'hunt' && !tame, def = D.temper === 'defend';
        if (near && D.temper === 'flee' && !tame && (nd < 2.5 || a.provoked > 0 || nd < D.fleeR * .35)) { mode = 3; mx = a.x - near.x; mz = a.z - near.z; sp = D.run; }
        else if (near && hunter && (nd < D.aggro * (r.isNight ? 1.4 : 1) || a.provoked > 0) && a.hp > D.hp * .25) { mode = 1; tgt = near; mx = near.x - a.x; mz = near.z - a.z; sp = D.run; if (nd < D.reach + .4) { sp = 0; if (a.atk <= 0) { a.atk = D.cd; r.hurt(near, D.dmg, null, 'animal'); } } }
        else if (near && def && (a.provoked > 0 || nd < D.provokeR) && nd < 30) { mode = 1; tgt = near; mx = near.x - a.x; mz = near.z - a.z; sp = D.run; if (nd < D.reach + .4) { sp = 0; if (a.atk <= 0) { a.atk = D.cd; r.hurt(near, D.dmg, null, 'animal'); } } }
        else if (near && hunter && a.hp <= D.hp * .25 && nd < 30) { mode = 3; mx = a.x - near.x; mz = a.z - near.z; sp = D.run; }
        else { a.timer -= dt; if (a.timer <= 0) { if (Math.random() < .45) { a.wx = a.x; a.wz = a.z; a.timer = 2 + Math.random() * 4; } else { const ang = Math.random() * 6.283, rr = 5 + Math.random() * 10; a.wx = a.x + Math.cos(ang) * rr; a.wz = a.z + Math.sin(ang) * rr; a.timer = 6 + Math.random() * 6; } } const wd = Math.hypot(a.wx - a.x, a.wz - a.z); if (wd > 1) { mx = a.wx - a.x; mz = a.wz - a.z; sp = D.walk; } }
      }
      const len = Math.hypot(mx, mz) || 1; mx /= len; mz /= len;
      const nx = a.x + mx * sp * dt, nz = a.z + mz * sp * dt, nh = T.terrainH(nx, nz);
      if (sp > 0 && (nh < .3 || T.lakeAt(nx, nz) || Math.hypot(nx, nz) > r.half * .95 || Math.abs(nh - a.y) > 1.4)) { a.wx = a.x; a.wz = a.z; sp = 0; if (mode === 3) { const t2 = mx; mx = -mz; mz = t2; } }
      else if (sp > 0) { a.x = nx; a.z = nz; a.y = nh; }
      if (sp > 0) a.yaw = Math.atan2(mx, mz); a.spd = sp; a.mode = sp > D.walk + .5 ? 2 : sp > 0 ? 1 : 0; if (mode === 1 && sp === 0) a.mode = 4;
      if (a.tame > 0 && !a.owner) a.tame = Math.max(0, a.tame - dt * 1.5);
    }
  }
}
