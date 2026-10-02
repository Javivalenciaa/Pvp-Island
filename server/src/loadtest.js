// Prueba de carga: 20 jugadores simulados por sala moviéndose, construyendo y hablando. Mide el coste de cada tick y el ancho de banda.
import WebSocket from 'ws';
import { createServer } from './index.js';
const N = +process.env.N || 20, SECS = +process.env.SECS || 20;
const srv = createServer({ port: 0, minPlayers: 0 }); await new Promise((r) => srv.wss.on('listening', r)); const port = srv.wss.address().port;
const room = srv.rooms[0]; const orig = room.tick.bind(room); const times = []; room.tick = () => { const t = process.hrtime.bigint(); orig(); times.push(Number(process.hrtime.bigint() - t) / 1e6); };
clearInterval(room.timer); room.timer = setInterval(() => room.tick(), 50);
let bytes = 0, msgs = 0; const clients = [];
for (let i = 0; i < N; i++) {
  const ws = new WebSocket('ws://localhost:' + port); const c = { ws, x: 0, z: 0, y: 0, id: 0 }; clients.push(c);
  ws.on('message', (d) => { bytes += d.length; msgs++; const m = JSON.parse(d); if (m.t === 'welcome') { c.id = m.id; c.x = m.x; c.z = m.z; c.y = room.T.terrainH(c.x, c.z); } });
  await new Promise((r) => ws.on('open', r)); ws.send(JSON.stringify({ t: 'join', name: 'P' + i, token: 'load' + i, map: 'isla' }));
}
await new Promise((r) => setTimeout(r, 500));
// agrupa a todos en un radio de 60 m para el peor caso (todos se ven entre sí)
const cx = clients[0].x, cz = clients[0].z; const pl = [...room.players.values()];
pl.forEach((p, i) => { p.x = cx + Math.cos(i) * 20; p.z = cz + Math.sin(i) * 20; p.y = room.T.terrainH(p.x, p.z); p.prot = 0; });
clients.forEach((c, i) => { c.x = pl[i].x; c.z = pl[i].z; });
let step = 0; const mover = setInterval(() => { step++; for (const c of clients) { const a = step * .1 + c.id; c.x += Math.cos(a) * .4; c.z += Math.sin(a) * .4; c.y = room.T.terrainH(c.x, c.z); c.ws.send(JSON.stringify({ t: 'pos', x: c.x, y: c.y, z: c.z, yaw: a })); if (step % 20 === 0) c.ws.send(JSON.stringify({ t: 'chat', text: 'hola ' + step })); if (step % 15 === 0) c.ws.send(JSON.stringify({ t: 'attack', target: pl[(c.id + 1) % N].id, weapon: 'iron_sword' })); } }, 100);
await new Promise((r) => setTimeout(r, SECS * 1000)); clearInterval(mover);
times.sort((a, b) => a - b); const avg = times.reduce((s, v) => s + v, 0) / times.length;
console.log(`jugadores ${room.humans}  ticks ${times.length}  tick medio ${avg.toFixed(2)} ms  p99 ${times[Math.floor(times.length * .99)].toFixed(2)} ms  máx ${times[times.length - 1].toFixed(2)} ms (presupuesto 50 ms)`);
console.log(`bajada por jugador: ${(bytes / N / SECS / 1024).toFixed(1)} KB/s  ${(msgs / N / SECS).toFixed(0)} msg/s`);
process.exitCode = avg < 10 && times[Math.floor(times.length * .99)] < 40 ? 0 : 1; srv.close(); process.exit(process.exitCode);
