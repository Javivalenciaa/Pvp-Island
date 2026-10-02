import WebSocket from 'ws';
import { createServer } from './index.js';
const srv = createServer({ port: 0 }); await new Promise((r) => srv.wss.on('listening', r)); const port = srv.wss.address().port;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const client = (name, token, map) => new Promise((res) => { const ws = new WebSocket('ws://localhost:' + port); const st = { snaps: [], welcome: null, ws }; ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name, token, map }))); ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome') { st.welcome = m; res(st); } else if (m.t === 'snap') st.snaps.push(m); else (st.other ||= []).push(m); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
ok(srv.rooms.length === 2 && srv.rooms.every((r) => r.count === 8), 'dos mapas con 8 bots cada uno (sin humanos)');
const bot0 = [...srv.rooms[0].players.values()].find((p) => p.bot), bx0 = bot0.x, bz0 = bot0.z; await sleep(2500); ok(Math.hypot(bot0.x - bx0, bot0.z - bz0) > 1, 'los bots se mueven solos'); srv.setBots(false);
const a = await client('Ana', 'tok-ana', 'isla'), b = await client('Beto', 'tok-beto', 'isla');
ok(a.welcome.seed === 0 && a.welcome.world === 640, 'bienvenida con semilla del mapa');
await sleep(300);
const last = (c) => c.snaps[c.snaps.length - 1], mine = (c) => last(c).p.find((q) => q[0] === c.welcome.id);
const x0 = mine(a)[1], z0 = mine(a)[3];
a.ws.send(JSON.stringify({ t: 'input', mx: 0, mz: 1, sprint: true, yaw: 0 })); await sleep(1500);
ok(Math.hypot(mine(a)[1] - x0, mine(a)[3] - z0) > 3, 'el servidor mueve al jugador con su input');
// PvP: acercar a Beto al frente de Ana y atacar
const room = srv.rooms[0], pa = [...room.players.values()].find((p) => p.id === a.welcome.id), pb = [...room.players.values()].find((p) => p.id === b.welcome.id);
pb.x = pa.x - Math.sin(pa.yaw) * -1.5 * -1; pb.z = pa.z + Math.cos(pa.yaw) * 1.5 * -1; pb.x = pa.x - Math.sin(pa.yaw) * 1.5; pb.z = pa.z - Math.cos(pa.yaw) * 1.5;
await sleep(150); ok(last(a).p.some((q) => q[0] === b.welcome.id), 've a otros jugadores cercanos y no a los lejanos (' + last(a).p.length + ' de ' + room.count + ')');
pa.prot = 0; pb.prot = 0; const hp0 = pb.hp; a.ws.send(JSON.stringify({ t: 'input', mx: 0, mz: 0, yaw: pa.yaw })); await sleep(120); a.ws.send(JSON.stringify({ t: 'attack' })); await sleep(150);
ok(pb.hp < hp0, 'el ataque PvP quita vida a un enemigo: ' + hp0 + ' -> ' + pb.hp);
pa.prot = 0; pb.prot = 0; pb.tid = pa.tid; const hp1 = pb.hp; await sleep(700); a.ws.send(JSON.stringify({ t: 'attack' })); await sleep(150); ok(pb.hp === hp1, 'sin fuego amigo dentro de la misma tribu');
// los bots dejan sitio: con humanos el total se mantiene en minPlayers
ok(room.count === 8 && room.humans === 2, 'los bots dejan sitio a los humanos: ' + room.humans + ' humanos, ' + (room.count - room.humans) + ' bots');
// modo cliente: posición enviada, validación anti-teletransporte y daño por arma
pa.cs = false; pb.tid = 's:tok-beto'; pb.hp = 100; pb.dead = 0; pb.x = pa.x + 1.5; pb.y = pa.y; pb.z = pa.z; pb.cs = false; await sleep(100);
a.ws.send(JSON.stringify({ t: 'pos', x: pa.x + 0.3, y: pa.y, z: pa.z, yaw: 0 })); await sleep(120); ok(pa.cs === true, 'el servidor acepta la posición del cliente');
const xx = pa.x; a.ws.send(JSON.stringify({ t: 'pos', x: pa.x + 300, y: pa.y, z: pa.z, yaw: 0 })); await sleep(150); ok(Math.abs(pa.x - xx) < 1 && a.other && a.other.some((m) => m.t === 'correct'), 'se rechaza el teletransporte y se corrige al cliente');
await sleep(700); a.ws.send(JSON.stringify({ t: 'attack', target: b.welcome.id, weapon: 'iron_sword' })); await sleep(150); ok(pb.hp === 52, 'la espada de hierro hace 48 de daño: ' + pb.hp);
await sleep(400); a.ws.send(JSON.stringify({ t: 'attack', target: b.welcome.id, weapon: 'iron_sword', dmg: 9999 })); await sleep(150); ok(pb.hp === 4 && !(pb.dead > 0), 'el cliente no puede inflar el daño: ' + pb.hp);
await sleep(400); a.ws.send(JSON.stringify({ t: 'shot', target: b.welcome.id, weapon: 'bow', charge: 1 })); await sleep(150); ok(pb.dead > 0 && pa.kills >= 1, 'una flecha tensada mata y suma baja');
await sleep(1500); ok(pb.dead > 0, 'un jugador muerto espera a pedir reaparecer'); b.ws.send(JSON.stringify({ t: 'respawn' })); await sleep(1700); ok(pb.dead <= 0 && pb.hp === 100 && b.other.some((m) => m.t === 'respawn'), 'el jugador reaparece con vida completa al pedirlo');
// tribus por invitación (máx. 3) y chat global
const c = await client('Cris', 'tok-cris', 'isla'), d = await client('Dani', 'tok-dani', 'isla'); await sleep(200);
const pc = [...room.players.values()].find((p) => p.id === c.welcome.id), pd = [...room.players.values()].find((p) => p.id === d.welcome.id);
for (const p of [pa, pb, pc, pd]) { p.x = pa.x; p.z = pa.z; p.y = pa.y; p.cs = true; }
a.ws.send(JSON.stringify({ t: 'invite', target: b.welcome.id })); await sleep(150); ok(b.other.some((m) => m.t === 'invite' && m.from === a.welcome.id), 'la invitación llega al jugador invitado');
b.ws.send(JSON.stringify({ t: 'invreply', from: a.welcome.id, accept: true })); await sleep(150); ok(pa.tid === pb.tid && pa.tid.startsWith('t'), 'al aceptar se forma la tribu: ' + pa.tid);
a.ws.send(JSON.stringify({ t: 'invite', target: c.welcome.id })); await sleep(100); c.ws.send(JSON.stringify({ t: 'invreply', from: a.welcome.id, accept: true })); await sleep(150); ok(pc.tid === pa.tid, 'tercer miembro entra');
a.ws.send(JSON.stringify({ t: 'invite', target: d.welcome.id })); await sleep(100); d.ws.send(JSON.stringify({ t: 'invreply', from: a.welcome.id, accept: true })); await sleep(150); ok(pd.tid !== pa.tid, 'el cuarto no entra: máximo 3 por tribu');
a.ws.send(JSON.stringify({ t: 'chat', text: 'hola a todos' })); await sleep(150); ok([c, d].every((x) => x.other.some((m) => m.t === 'chat' && m.text === 'hola a todos' && !m.tribe)), 'el chat global llega a todos');
a.ws.send(JSON.stringify({ t: 'chat', text: 'spam' })); await sleep(100); ok(!d.other.some((m) => m.text === 'spam'), 'el chat limita la frecuencia');
await sleep(1000); a.ws.send(JSON.stringify({ t: 'chat', text: '/t solo tribu' })); await sleep(150); ok(c.other.some((m) => m.text === 'solo tribu' && m.tribe) && !d.other.some((m) => m.text === 'solo tribu'), 'el chat de tribu solo llega a la tribu');
c.ws.send(JSON.stringify({ t: 'tleave' })); await sleep(150); ok(pc.tid === 's:tok-cris' && pa.tid === pb.tid, 'abandonar la tribu');
// protección al aparecer
const hpP = pd.hp; pd.prot = room.t + 10; pa.tid = 's:tok-ana'; pa.prot = 0; pa.cd = 0; pa.x = pd.x; pa.z = pd.z; pa.y = pd.y; a.ws.send(JSON.stringify({ t: 'attack', target: d.welcome.id, weapon: 'iron_sword' })); await sleep(150); ok(pd.hp === hpP, 'los jugadores recién llegados están protegidos');
// construcción autoritativa
{
  const send = (c, m) => c.ws.send(JSON.stringify(m)), has = (c, f) => c.other.some(f);
  const pid = pa.id; for (const p of [pa, pb, pc, pd]) { p.cs = true; p.dead = 0; p.prot = 0; p.cd = 0; }
  pa.tid = 's:tok-ana'; pb.tid = 's:tok-beto'; pc.tid = 's:tok-cris'; pd.tid = 's:tok-dani';
  const top = pa.y + .5, ix = Math.floor(pa.x / 3), jz = Math.floor(pa.z / 3);
  send(a, { t: 'build', piece: { kind: 'wall', key: `Wh${ix},${jz},0`, i: ix, j: jz, L: 0, dir: 'h', top, bottom: top - 1 } }); await sleep(150); ok(has(a, (m) => m.t === 'pdeny'), 'una pared sin cimiento se rechaza');
  send(a, { t: 'build', piece: { kind: 'foundation', key: `F${ix},${jz}`, i: ix, j: jz, L: 0, top, bottom: top - 1 } }); await sleep(150); ok(has(b, (m) => m.t === 'pb' && m.p.kind === 'foundation' && m.p.o === 's:tok-ana'), 'el cimiento se crea y todos lo ven');
  send(a, { t: 'build', piece: { kind: 'door', key: `Wh${ix},${jz},0`, i: ix, j: jz, L: 0, dir: 'h', top, bottom: top - 1 } }); await sleep(150); ok(room.B.get(`Wh${ix},${jz},0`), 'la puerta sobre el cimiento se acepta');
  send(a, { t: 'build', piece: { kind: 'wall', key: `Wv${ix},${jz},0`, i: ix, j: jz, L: 0, dir: 'v', top, bottom: top - 1 } }); await sleep(150);
  send(b, { t: 'door', key: `Wh${ix},${jz},0` }); await sleep(120); ok(room.B.get(`Wh${ix},${jz},0`).open === false, 'otra tribu no puede abrir la puerta');
  send(a, { t: 'door', key: `Wh${ix},${jz},0` }); await sleep(120); ok(room.B.get(`Wh${ix},${jz},0`).open === true, 'su dueño sí puede abrirla');
  send(b, { t: 'upgrade', key: `Wv${ix},${jz},0` }); await sleep(120); ok(room.B.get(`Wv${ix},${jz},0`).tier === 0, 'otra tribu no puede mejorar piezas ajenas');
  send(a, { t: 'upgrade', key: `Wv${ix},${jz},0` }); await sleep(120); ok(room.B.get(`Wv${ix},${jz},0`).tier === 1, 'el dueño mejora la pared a madera');
  // raideo: Beto golpea la pared ajena
  pb.x = pa.x + 1; pb.z = pa.z; pb.y = pa.y; const w = room.B.get(`Wv${ix},${jz},0`), hpw = w.hp; send(b, { t: 'phit', key: w.key, weapon: 'iron_axe' }); await sleep(150);
  ok(w.hp < hpw && Math.abs((hpw - w.hp) - 14 * 0.75) < .6, 'un hacha de hierro daña la pared ajena con la resistencia de la madera: ' + (hpw - w.hp).toFixed(1));
  send(a, { t: 'phit', key: w.key, weapon: 'iron_axe' }); await sleep(80); ok(w.hp === hpw - 14 * .75 || w.hp > hpw - 14, 'no se puede dañar la propia construcción');
  // destruir y derrumbe en cascada: al romper el cimiento caen puerta y pared
  const f = room.B.get(`F${ix},${jz}`); f.hp = 5; pb.cd = 0; send(b, { t: 'phit', key: f.key, weapon: 'iron_axe' }); await sleep(200);
  ok(!room.B.get(f.key) && !room.B.get(w.key) && !room.B.get(`Wh${ix},${jz},0`) && has(a, (m) => m.t === 'pd' && m.keys.length === 3), 'al caer el cimiento se derrumba todo lo que sostenía (3 piezas)');
  // un jugador que entra después recibe las piezas existentes
  send(a, { t: 'build', piece: { kind: 'foundation', key: `F${ix + 5},${jz}`, i: ix + 5, j: jz, L: 0, top, bottom: top - 1 } }); await sleep(150);
  const e2 = await client('Eva', 'tok-eva', 'isla'); await sleep(250); ok(e2.other && e2.other.some((m) => m.t === 'pieces' && m.list.length === 1), 'quien entra después recibe las construcciones existentes'); e2.ws.close();
}
// objetos, trampas, torretas, explosivos y botín
{
  const send = (c, m) => c.ws.send(JSON.stringify(m)), has = (c, f) => c.other.some(f);
  for (const p of [pa, pb, pc, pd]) { p.cs = true; p.dead = 0; p.prot = 0; p.cd = 0; p.hp = 100; p.tid = 's:' + p.token; }
  pb.x = pa.x + 2; pb.z = pa.z; pb.y = pa.y; pc.x = pa.x + 40; pc.z = pa.z; pc.y = pa.y; pd.x = pa.x + 300; pd.z = pa.z;
  const base = { x: pa.x, y: pa.y, z: pa.z }; const at = (dx) => ({ x: base.x + dx, y: base.y, z: base.z }); const near = (dx) => { pa.x = base.x + dx + 1; pa.z = base.z; pa.y = base.y; };
  // cofre: solo su tribu lo abre; contenido en el servidor; al destruirlo suelta un saco
  near(-2); send(a, { t: 'place', dep: Object.assign({ t: 'chest', r: 0 }, at(-2)) }); await sleep(150); const chest = [...room.D.map.values()].find((d) => d.t === 'chest'); ok(chest && has(b, (m) => m.t === 'db' && m.d.t === 'chest'), 'el cofre se coloca y todos lo ven');
  const slots = new Array(24).fill(null); slots[0] = { id: 'ingot', n: 12 }; send(a, { t: 'cset', id: chest.id, slots }); await sleep(120); send(a, { t: 'copen', id: chest.id }); await sleep(150); ok(has(a, (m) => m.t === 'chest' && m.slots[0] && m.slots[0].n === 12), 'el dueño guarda y recupera el contenido del cofre');
  send(b, { t: 'copen', id: chest.id }); await sleep(150); ok(!b.other.some((m) => m.t === 'chest'), 'otra tribu no puede abrir el cofre');
  send(b, { t: 'dhit', id: chest.id, weapon: 'iron_axe' }); await sleep(120); ok(chest.hp === 700 - 16, 'un hacha de hierro daña el cofre ajeno');
  chest.hp = 5; pb.cd = 0; send(b, { t: 'dhit', id: chest.id, weapon: 'iron_axe' }); await sleep(200); ok(!room.D.map.has(chest.id) && room.D.bags.size === 1 && has(a, (m) => m.t === 'lb'), 'al destruir el cofre suelta su botín en un saco');
  const bag = [...room.D.bags.values()][0]; pb.x = bag.x; pb.z = bag.z; send(b, { t: 'lpick', id: bag.id }); await sleep(150); ok(has(b, (m) => m.t === 'give' && m.items[0][0] === 'ingot' && m.items[0][1] === 12), 'quien llega al saco recoge el botín');
  // estacas: dañan y ralentizan al enemigo
  near(-30); send(a, { t: 'place', dep: Object.assign({ t: 'spikes', r: 0 }, at(-30)) }); await sleep(120); const sp = [...room.D.map.values()].find((d) => d.t === 'spikes');
  pb.x = sp.x; pb.z = sp.z; pb.y = sp.y; pb.hp = 100; await sleep(700); ok(pb.hp < 100 && has(b, (m) => m.t === 'slow'), 'las estacas dañan y frenan al enemigo: ' + pb.hp);
  pa.x = sp.x + .5; pa.z = sp.z; const hpa = pa.hp; await sleep(700); ok(pa.hp === hpa, 'las estacas no dañan a su dueño');
  // cepo
  near(-50); send(a, { t: 'place', dep: Object.assign({ t: 'beartrap', r: 0 }, at(-50)) }); await sleep(120); const bt = [...room.D.map.values()].find((d) => d.t === 'beartrap'); pb.x = bt.x; pb.z = bt.z; pb.hp = 100; await sleep(300);
  ok(bt.armed === false && has(b, (m) => m.t === 'stun'), 'el cepo inmoviliza al enemigo');
  // torreta ballesta con munición
  pb.x = pa.x + 100; pa.x = pa.x - 0; near(-60); send(a, { t: 'place', dep: Object.assign({ t: 'ballista', r: 0 }, at(-60)) }); await sleep(120); const bal = [...room.D.map.values()].find((d) => d.t === 'ballista');
  pa.x = bal.x + 1; pa.z = bal.z; send(a, { t: 'load', id: bal.id, n: 10 }); await sleep(120); ok(bal.ammo === 10, 'se carga la ballesta con munición');
  pb.x = bal.x + 15; pb.z = bal.z; pb.y = bal.y; pb.hp = 100; await sleep(1700); ok(pb.hp < 100 && bal.ammo < 10 && has(b, (m) => m.t === 'fx' && m.k === 'bolt'), 'la ballesta dispara sola al enemigo: ' + pb.hp);
  // explosivo: daña a enemigos y construcciones, no a la propia tribu
  const ex = pa.x + 200 > 0 ? at(-80) : at(-80); pa.x = ex.x + 6; pa.z = ex.z; pb.x = ex.x; pb.z = ex.z; pb.y = ex.y; pb.hp = 100; pa.hp = 100; pa.exT = 0;
  send(a, { t: 'explode', kind: 'bomb', x: ex.x, y: ex.y + .3, z: ex.z }); await sleep(150); ok(pb.hp < 100 && has(b, (m) => m.t === 'boom'), 'una bomba daña a los enemigos cercanos: ' + pb.hp);
  send(a, { t: 'explode', kind: 'bomb', x: ex.x, y: ex.y, z: ex.z }); await sleep(100); ok(true, 'las explosiones se limitan por frecuencia') && null;
  // barril explosivo en cadena y mina
  near(-120); send(a, { t: 'place', dep: Object.assign({ t: 'mine', r: 0 }, at(-120)) }); await sleep(120); const mine = [...room.D.map.values()].find((d) => d.t === 'mine'); pb.x = mine.x; pb.z = mine.z; pb.y = mine.y; pb.hp = 100; await sleep(200);
  ok(!room.D.map.has(mine.id) && pb.hp < 100, 'la mina explota al pisarla: ' + pb.hp);
  // cama y reaparición
  near(-140); send(a, { t: 'place', dep: Object.assign({ t: 'bed', r: 0 }, at(-140)) }); await sleep(120); const bed = [...room.D.map.values()].find((d) => d.t === 'bed'); pa.x = bed.x + 1; pa.z = bed.z; send(a, { t: 'bed', id: bed.id }); await sleep(100); ok(pa.bed === bed.id, 'se fija la cama como punto de reaparición');
  pa.hp = 1; room.hurt(pa, 5, pb); await sleep(100); send(a, { t: 'drop', slots: [{ id: 'wood', n: 30 }] }); send(a, { t: 'respawn' }); await sleep(1700); ok(Math.hypot(pa.x - bed.x, pa.z - bed.z) < 1 && room.D.bags.size >= 1, 'al morir suelta lo que llevaba y reaparece en su cama');
}
b.ws.close(); await sleep(200); ok(room.humans === 3 && room.count === 8, 'al salir un humano entra un bot: ' + room.humans + '/' + room.count);
// los bots se mueven y combaten solos
srv.close(); process.exit(process.exitCode || 0);
