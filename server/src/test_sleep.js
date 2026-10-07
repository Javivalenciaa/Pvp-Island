// Desconexión estilo ARK: el cuerpo se queda durmiendo, otros pueden matarlo y saquearlo; si sobrevive, el dueño vuelve con todo.
import WebSocket from 'ws';
import fs from 'node:fs';
import { createServer } from './index.js';
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = '/tmp/pvp-sleep-test'; fs.rmSync(dir, { recursive: true, force: true });
let srv = createServer({ port: 0, minPlayers: 0, dataDir: dir }); await new Promise((r) => srv.wss.on('listening', r)); let port = srv.wss.address().port;
const conn = async (name, token) => { const ws = new WebSocket('ws://localhost:' + port); const c = { ws, msgs: [] }; ws.on('message', (d) => c.msgs.push(JSON.parse(d))); await new Promise((r) => ws.on('open', r)); ws.send(JSON.stringify({ t: 'join', name, token, map: 'isla' })); await sleep(250); return c; };
const send = (c, m) => c.ws.send(JSON.stringify(m)), room = srv.rooms[0];
const a = await conn('Dormilona', 'tok-a'), b = await conn('Asesino', 'tok-b');
const pa = [...room.players.values()].find((p) => p.name === 'Dormilona'), pb = [...room.players.values()].find((p) => p.name === 'Asesino'); pa.prot = 0; pb.prot = 0;
const slots = Array.from({ length: 24 }, () => null); slots[0] = { id: 'iron_sword', n: 1, dur: 80 }; slots[1] = { id: 'wood', n: 120 }; slots[5] = { id: 'bomb', n: 3 };
send(a, { t: 'pos', x: pa.x, y: pa.y, z: pa.z, yaw: 1 }); send(a, { t: 'invfull', slots, armor: 'iron_armor', hunger: 55, thirst: 40 }); await sleep(200);
ok(pa.slots && pa.slots.length === 24 && pa.armor === 'iron_armor', 'el servidor guarda el inventario completo que informa el cliente');
const { x, y, z, id } = pa; a.ws.close(); await sleep(300);
ok(room.players.has(id) && pa.sleeping, 'al desconectarse el cuerpo sigue en el mapa durmiendo');
ok(b.msgs.some((m) => m.t === 'sleep' && m.id === id), 'los demás reciben el aviso de que se ha dormido');
ok(room.count === 1 && room.humans === 1, 'un cuerpo dormido no cuenta como jugador conectado');
await sleep(150); ok(b.msgs.some((m) => m.t === 'snap' && m.p.some((e) => e[0] === id && e[8] === 1 && Math.abs(e[1] - x) < .1)), 'aparece en las instantáneas como dormido, en su sitio');
// reconectar: vuelve con todo
let a2 = await conn('Dormilona', 'tok-a'); const w = a2.msgs.find((m) => m.t === 'welcome');
ok(w && w.id === id && w.restore && w.restore.slots[1].n === 120 && w.restore.armor === 'iron_armor' && Math.abs(w.x - x) < .1, 'al volver recupera su cuerpo, posición e inventario');
ok(b.msgs.some((m) => m.t === 'wake' && m.id === id) && !pa.sleeping, 'los demás ven que despierta');
// dormir otra vez y que lo maten
send(a2, { t: 'invfull', slots, armor: 'iron_armor', hunger: 55, thirst: 40 }); await sleep(2000); a2.ws.close(); await sleep(300); ok(pa.sleeping, 'vuelve a dormir');
pb.x = x + 1; pb.y = y; pb.z = z; pb.cd = 0; send(b, { t: 'attack', target: id, weapon: 'iron_sword' }); await sleep(100);
for (let i = 0; i < 6 && room.players.has(id); i++) { pb.cd = 0; room.hurt(pa, 30, pb, 'melee'); }
ok(!room.players.has(id), 'un jugador puede matar al cuerpo dormido y desaparece');
const bag = [...room.D.bags.values()].find((g) => Math.hypot(g.x - x, g.z - z) < 1.5); const ids = bag ? bag.slots.map((s) => s.id + (s.n > 1 ? '×' + s.n : '')) : [];
ok(bag && ids.includes('iron_sword') && ids.includes('wood×120') && ids.includes('bomb×3') && ids.includes('iron_armor'), 'suelta una bolsa con todo lo que llevaba: ' + ids.join(' '));
b.msgs.length = 0; send(b, { t: 'lpick', id: bag.id }); pb.x = bag.x; pb.z = bag.z; send(b, { t: 'lpick', id: bag.id }); await sleep(150);
ok(b.msgs.some((m) => m.t === 'give' && m.items.length >= 4), 'el asesino puede recoger el botín');
ok(b.msgs.some((m) => m.t === 'kill' && m.victim === id && m.killer === pb.id), 'aparece en el feed como baja');
let a3 = await conn('Dormilona', 'tok-a'); ok(a3.msgs.some((m) => m.t === 'notice' && /abatido por Asesino/.test(m.text)), 'al volver le avisan de que su cuerpo fue abatido');
ok(!a3.msgs.find((m) => m.t === 'welcome').restore, 'y empieza de cero, sin inventario restaurado');
// persistencia: un cuerpo dormido sobrevive a un reinicio del servidor
send(a3, { t: 'invfull', slots, armor: null, hunger: 90, thirst: 90 }); await sleep(2000); const p3 = [...room.players.values()].find((p) => p.name === 'Dormilona'); a3.ws.close(); await sleep(300);
srv.close(); await sleep(300);
srv = createServer({ port: 0, minPlayers: 0, dataDir: dir }); await new Promise((r) => srv.wss.on('listening', r)); port = srv.wss.address().port;
const r2 = srv.rooms[0], s2 = [...r2.players.values()].find((p) => p.sleeping && p.token === 'tok-a');
ok(!!s2 && s2.slots[1].n === 120, 'tras reiniciar el servidor el cuerpo dormido sigue ahí con su inventario');
const a4 = await conn('Dormilona', 'tok-a'); ok(a4.msgs.find((m) => m.t === 'welcome').restore.slots[1].n === 120, 'y se puede recuperar');
srv.close(); process.exit(process.exitCode || 0);
