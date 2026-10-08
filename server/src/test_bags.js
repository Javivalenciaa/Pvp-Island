// Cajas del suelo: objetos tirados (60 s), botín de un muerto (se abre, se coge lo que se quiere, el resto queda), y caducidad.
import { createServer } from './index.js';
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const srv = createServer({ port: 0, minPlayers: 0 }); await new Promise((r) => srv.wss.on('listening', r));
const room = srv.rooms[0], msgs = { a: [], b: [] }, sock = (k) => ({ readyState: 1, send(s) { msgs[k].push(JSON.parse(s)); } });
const a = room.join('Ana', 'ta', sock('a')), b = room.join('Beto', 'tb', sock('b')); a.prot = b.prot = 0; b.x = a.x + 1; b.z = a.z; b.y = a.y;
room.onMessage(a, { t: 'toss', item: { id: 'iron_axe', n: 1, dur: 40 } }); room.onMessage(a, { t: 'toss', item: { id: 'wood', n: 80 } });
const bags = [...room.D.bags.values()]; ok(bags.length === 1 || bags.length === 2, 'tirar un objeto crea una caja en el suelo (' + bags.length + ')');
await new Promise((r) => setTimeout(r, 200)); room.onMessage(a, { t: 'toss', item: { id: 'wood', n: 80 } });
const t = [...room.D.bags.values()].filter((g) => g.k === 'toss'); ok(t.length >= 2 && t.every((g) => Math.abs(g.expire - room.t - 60) < 1), 'caducan a los 60 s');
const bag = t[0]; b.x = bag.x; b.z = bag.z; b.y = bag.y; msgs.b.length = 0; room.onMessage(b, { t: 'bopen', id: bag.id });
const op = msgs.b.find((m) => m.t === 'bag'); ok(op && op.slots.length === 1 && op.left >= 58 && op.left <= 60, 'otro jugador la abre y ve el contenido y la cuenta atrás (' + (op && op.left) + ' s)');
room.onMessage(b, { t: 'btake', id: bag.id, i: 0, item: op.slots[0].id, n: op.slots[0].n }); const gv = msgs.b.find((m) => m.t === 'give');
ok(gv && gv.items[0][0] === op.slots[0].id && !room.D.bags.has(bag.id), 'coge el objeto y la caja vacía desaparece');
// botín de un muerto: varias cosas, se coge una y el resto queda
const v = room.join('Vic', 'tv', sock('a')); v.x = b.x + 2; v.z = b.z; v.y = b.y; v.dead = 4; room.dropBag(v, [{ id: 'wood', n: 100 }, { id: 'stone', n: 60 }, { id: 'iron_sword', n: 1, dur: 70 }]);
const lb = [...room.D.bags.values()].find((g) => Math.hypot(g.x - v.x, g.z - v.z) < 1); ok(lb && Math.abs(lb.expire - room.t - 600) < 1, 'el botín de un muerto dura 10 min');
b.x = lb.x; b.z = lb.z; msgs.b.length = 0; room.onMessage(b, { t: 'btake', id: lb.id, i: 2, item: 'iron_sword', n: 1 }); room.onMessage(b, { t: 'btake', id: lb.id, i: 0, item: 'wood', n: 30 });
const gi = msgs.b.filter((m) => m.t === 'give').map((m) => m.items[0]); ok(gi.length === 2 && gi[0][2] === 70 && gi[1][1] === 30, 'coge lo que quiere (espada con su durabilidad y 30 de madera)');
ok(room.D.bags.has(lb.id) && lb.slots.length === 2 && lb.slots.find((s) => s.id === 'wood').n === 70, 'el resto se queda en la caja');
room.onMessage(b, { t: 'btake', id: lb.id, i: 0, item: 'stone', n: 5 }); ok(msgs.b.filter((m) => m.t === 'give').length === 2, 'un objeto que no está en esa casilla no se entrega');
b.x += 50; msgs.b.length = 0; room.onMessage(b, { t: 'bopen', id: lb.id }); ok(!msgs.b.some((m) => m.t === 'bag'), 'lejos no se puede abrir');
for (let i = 0; i < 20 * 61; i++) room.tick(); ok(![...room.D.bags.values()].some((g) => g.k === 'toss') && room.D.bags.has(lb.id), 'las tiradas desaparecen al minuto; el botín del muerto sigue');
for (let i = 0; i < 20 * 560; i++) room.tick(); ok(!room.D.bags.has(lb.id), 'el botín del muerto desaparece a los 10 min');
srv.close(); process.exit(process.exitCode || 0);
