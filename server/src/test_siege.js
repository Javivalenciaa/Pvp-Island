// C4, caja fuerte, escudos, vida de torretas, mejora de torretas y rampas (servidor).
import { createServer } from './index.js';
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const srv = createServer({ port: 0, minPlayers: 0 }); await new Promise((r) => srv.wss.on('listening', r));
const room = srv.rooms[0], msgs = [], sock = (a) => ({ readyState: 1, send(s) { a.push(JSON.parse(s)); } }), la = [], lb = [];
const a = room.join('Atacante', 'ta', sock(la)), b = room.join('Defensor', 'tb', sock(lb)); a.prot = b.prot = 0; srv.setBots(false);
const T = room.T, cx = Math.round(a.x / 3), cz = Math.round(a.z / 3), top = T.terrainH(cx * 3 + 1.5, cz * 3 + 1.5) + 1; b.x = cx * 3 + 1.5; b.z = cz * 3 + 1.5 + 8; b.y = T.terrainH(b.x, b.z);
const place = (kind, i, j, extra = {}) => room.B.place(Object.assign({ kind, i, j, L: 0, top, bottom: top - 1 }, extra), a.tid, room.B.countOf(a.tid));
// base METAL del atacante-dueño contra C4 del defensor... usamos al "Defensor" como dueño de la base y al "Atacante" como asaltante
const own = b.tid; const mk = (kind, i, j, extra) => { const r = room.B.place(Object.assign({ kind, i, j, L: 0, top, bottom: top - 1 }, extra), own, 0); return r.p; };
const fd = mk('foundation', cx, cz); fd.tier = 3; fd.hp = room.B.maxHp(fd); const wall = mk('wall', cx, cz, { dir: 'h' }); wall.tier = 3; wall.hp = room.B.maxHp(wall); const stone = mk('wall', cx, cz, { dir: 'v' }); stone.tier = 2; stone.hp = room.B.maxHp(stone);
ok(room.B.maxHp(wall) === 1500, 'pared de metal: 1500 de vida');
// C4: se colocan junto a la pared (muy pegadas) y se detonan a distancia
const wc = { x: cx * 3 + 1.5, z: cz * 3 }; a.x = wc.x + 3; a.z = wc.z - 10; a.y = T.terrainH(a.x, a.z); a.cs = false;
const put = (n) => { for (let k = 0; k < n; k++) room.onMessage(a, { t: 'place', dep: { t: 'c4', x: wc.x + (k - n / 2) * .1, y: top + 1.4, z: wc.z - .15, r: 0 } }); };
put(10); ok([...room.D.map.values()].filter((d) => d.t === 'c4').length === 8, 'máximo 8 cargas C4 colocadas a la vez (' + [...room.D.map.values()].filter((d) => d.t === 'c4').length + ')');
const hp0 = wall.hp; const c4s = () => [...room.D.map.values()].filter((d) => d.t === 'c4').length;
for (let n = 1; n <= 8; n++) { // detona de uno en uno para medir cuántas hacen falta
  const ds = [...room.D.map.values()].filter((d) => d.t === 'c4'); if (!ds.length) break; const d = ds[0]; room.D.map.delete(d.id); room.explode('charge', d.x, d.y, d.z, a);
  if (!room.B.map.has(wall.key)) { ok(n >= 6 && n <= 7, `una pared de metal cae con ${n} C4 (objetivo: 6-7)`); break; } if (n === 8) ok(false, 'la pared de metal sigue en pie tras 8 C4');
}
ok(!room.B.map.has(stone.key) || stone.hp < room.B.maxHp(stone), 'la pared de piedra de al lado también sufre');
// detonación remota a distancia: se pierde si no hay C4 cerca
for (const d of [...room.D.map.values()]) if (d.t === 'c4') room.D.map.delete(d.id); a.x += 200; room.onMessage(a, { t: 'det' }); ok(la.some((m) => m.t === 'notice' && /90 m/.test(m.text)), 'sin cargas a menos de 90 m no hace nada');
a.x = wc.x + 3; a.dead = 0; put(2); const n2 = c4s(); a.detT = 0; room.onMessage(a, { t: 'det' }); for (let i = 0; i < 20; i++) room.tick(); ok(n2 === 2 && c4s() === 0, 'la detonación remota explota todas las cargas del dueño');
// defender: destruir un C4 ajeno lo desactiva (sin explosión)
put(1); const dc = [...room.D.map.values()].find((d) => d.t === 'c4'); const booms = []; const oe = room.explode.bind(room); room.explode = (...x) => { booms.push(x[0]); return oe(...x); }; room.damageDep(dc, 999, b); ok(!room.D.map.has(dc.id) && booms.length === 0, 'destruir un C4 ajeno lo desactiva sin explosión'); room.explode = oe;
// torretas con vida y mejora
const mt = room.D.add('mortar', cx * 3 + 5, top, cz * 3 + 5, 0, own); ok(mt.hp === 750, 'el mortero tiene 750 de vida'); const bl = room.D.add('ballista', cx * 3 + 6, top, cz * 3 + 5, 0, own); ok(bl.hp === 650, 'la ballesta tiene 650 de vida');
b.x = bl.x + 1; b.z = bl.z; lb.length = 0; room.onMessage(b, { t: 'dup', id: bl.id }); ok(bl.lvl === 1 && bl.maxHp > 800 && room.capOf(bl) === 90, 'mejorar la ballesta: nivel 1, más vida y munición 60→90 (' + room.capOf(bl) + ')');
room.onMessage(b, { t: 'dup', id: bl.id }); ok(bl.lvl === 2 && room.capOf(bl) === 120, 'nivel 2: munición 120'); lb.length = 0; room.onMessage(b, { t: 'dup', id: bl.id }); ok(bl.lvl === 2 && lb.some((m) => m.t === 'give'), 'no hay nivel 3 y se devuelve el coste');
for (let k = 0; k < 4; k++) room.explode('charge', mt.x, mt.y, mt.z, a); ok(!room.D.map.has(mt.id), 'unas pocas cargas C4 destruyen un mortero');
// caja fuerte: 48 huecos, inmune a golpes, se rompe con explosivos
const sf = room.D.add('safe', cx * 3 + 4, top, cz * 3 + 4, 0, own); ok(sf.slots.length === 48 && sf.hp === 1500, 'caja fuerte: 48 huecos y 1500 de vida'); a.x = sf.x + 1; a.z = sf.z; a.y = sf.y; a.cd = 0;
const sh0 = sf.hp; for (let k = 0; k < 30; k++) { a.cd = 0; room.onMessage(a, { t: 'dhit', id: sf.id, weapon: 'iron_axe' }); } ok(sf.hp > sh0 - 40, 'los golpes casi no la dañan (' + (sh0 - sf.hp).toFixed(0) + ' tras 30 hachazos)');
let k = 0; while (room.D.map.has(sf.id) && k < 20) { room.explode('charge', sf.x, sf.y, sf.z, a); k++; } ok(!room.D.map.has(sf.id) && k >= 5 && k <= 8, `con ${k} C4 se rompe la caja fuerte`);
// escudo: reduce golpes de frente, no de espaldas ni explosiones
a.dead = 0; b.dead = 0; b.hp = 100; b.yaw = 0; b.x = 0; b.z = 0; a.x = 0; a.z = -2; b.held = 'shield'; room.onMessage(b, { t: 'block', on: true }); ok(b.blocking === true, 'se puede alzar el escudo si lo llevas en la mano');
room.hurt(b, 40, a, 'melee'); ok(Math.abs(b.hp - (100 - 40 * .22)) < .01, 'el escudo absorbe el 78 % de un golpe frontal (' + (100 - b.hp).toFixed(1) + ' de daño)');
b.hp = 100; a.z = 2; room.hurt(b, 40, a, 'melee'); ok(b.hp === 60, 'por la espalda no protege'); b.hp = 100; a.z = -2; room.hurt(b, 40, a, 'explosion'); ok(b.hp < 70, 'las explosiones atraviesan el escudo');
// rampas
const mkf = (i, j) => room.B.place({ kind: 'foundation', i, j, L: 0, top: 5, bottom: 4 }, a.tid, 0);
mkf(50, 50); const r1 = room.B.place({ kind: 'ramp', i: 50, j: 50, dir: 'e', top: 99 }, a.tid, 1); ok(r1.ok && r1.p.top === 5 && r1.p.key === 'R50,50' && r1.p.dir === 'e', 'una rampa se coloca sobre un cimiento (y toma su altura)');
ok(!room.B.place({ kind: 'ramp', i: 60, j: 60, dir: 'n', top: 5 }, a.tid, 1).ok, 'sin cimiento no hay rampa'); ok(!room.B.place({ kind: 'ceiling', i: 50, j: 50, L: 0, top: 5 }, a.tid, 1).ok, 'no se puede poner techo donde hay rampa');
room.B.remove(room.B.get('F50,50')); ok(!room.B.get('R50,50'), 'si cae el cimiento, cae la rampa');
srv.close(); process.exit(process.exitCode || 0);
