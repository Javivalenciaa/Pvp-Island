import WebSocket from 'ws';
import { createServer } from './index.js';
const srv = createServer({ port: 0 }); await new Promise((r) => srv.wss.on('listening', r)); const port = srv.wss.address().port;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const client = (name, tribe, map) => new Promise((res) => { const ws = new WebSocket('ws://localhost:' + port); const st = { snaps: [], welcome: null, ws }; ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name, tribe, map }))); ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome') { st.welcome = m; res(st); } else if (m.t === 'snap') st.snaps.push(m); else (st.other ||= []).push(m); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
ok(srv.rooms.length === 2 && srv.rooms.every((r) => r.count === 8), 'dos mapas con 8 bots cada uno (sin humanos)');
const a = await client('Ana', 'Lobos', 'isla'), b = await client('Beto', 'Osos', 'isla');
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
const hp0 = pb.hp; a.ws.send(JSON.stringify({ t: 'input', mx: 0, mz: 0, yaw: pa.yaw })); await sleep(120); a.ws.send(JSON.stringify({ t: 'attack' })); await sleep(150);
ok(pb.hp < hp0, 'el ataque PvP quita vida a un enemigo: ' + hp0 + ' -> ' + pb.hp);
pb.tribe = pa.tribe; const hp1 = pb.hp; await sleep(700); a.ws.send(JSON.stringify({ t: 'attack' })); await sleep(150); ok(pb.hp === hp1, 'sin fuego amigo dentro de la misma tribu');
// los bots dejan sitio: con humanos el total se mantiene en minPlayers
ok(room.count === 8 && room.humans === 2, 'los bots dejan sitio a los humanos: ' + room.humans + ' humanos, ' + (room.count - room.humans) + ' bots');
// modo cliente: posición enviada, validación anti-teletransporte y daño por arma
pa.cs = false; pb.tribe = 'Osos'; pb.hp = 100; pb.dead = 0; pb.x = pa.x + 1.5; pb.y = pa.y; pb.z = pa.z; pb.cs = false; await sleep(100);
a.ws.send(JSON.stringify({ t: 'pos', x: pa.x + 0.3, y: pa.y, z: pa.z, yaw: 0 })); await sleep(120); ok(pa.cs === true, 'el servidor acepta la posición del cliente');
const xx = pa.x; a.ws.send(JSON.stringify({ t: 'pos', x: pa.x + 300, y: pa.y, z: pa.z, yaw: 0 })); await sleep(150); ok(Math.abs(pa.x - xx) < 1 && a.other && a.other.some((m) => m.t === 'correct'), 'se rechaza el teletransporte y se corrige al cliente');
await sleep(700); a.ws.send(JSON.stringify({ t: 'attack', target: b.welcome.id, weapon: 'iron_sword' })); await sleep(150); ok(pb.hp === 52, 'la espada de hierro hace 48 de daño: ' + pb.hp);
await sleep(400); a.ws.send(JSON.stringify({ t: 'attack', target: b.welcome.id, weapon: 'iron_sword', dmg: 9999 })); await sleep(150); ok(pb.hp === 4 && !(pb.dead > 0), 'el cliente no puede inflar el daño: ' + pb.hp);
await sleep(400); a.ws.send(JSON.stringify({ t: 'shot', target: b.welcome.id, weapon: 'bow', charge: 1 })); await sleep(150); ok(pb.dead > 0 && pa.kills >= 1, 'una flecha tensada mata y suma baja');
await sleep(4300); ok(pb.dead <= 0 && pb.hp === 100, 'el jugador reaparece con vida completa');
b.ws.close(); await sleep(200); ok(room.humans === 1 && room.count === 8, 'al salir un humano entra un bot');
// los bots se mueven y combaten solos
const bot = [...room.players.values()].find((p) => p.bot), bx = bot.x, bz = bot.z; await sleep(2500); ok(Math.hypot(bot.x - bx, bot.z - bz) > 1, 'los bots se mueven solos');
srv.close(); process.exit(process.exitCode || 0);
