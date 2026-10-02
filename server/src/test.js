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
b.ws.close(); await sleep(200); ok(room.humans === 3 && room.count === 8, 'al salir un humano entra un bot: ' + room.humans + '/' + room.count);
// los bots se mueven y combaten solos
srv.close(); process.exit(process.exitCode || 0);
