// Simulación sin red: observa a los bots durante N minutos de juego simulado y resume su comportamiento.
import { createServer } from './index.js';
const MIN = +process.env.MIN || 5;
const srv = createServer({ port: 0, minPlayers: { isla: 8, cordillera: 0 } }); await new Promise((r) => srv.wss.on('listening', r));
const room = srv.rooms[0]; for (const p of room.players.values()) p.prot = 0;
const modes = {}, felled = new Set(), gears = {}, stats = { hits: 0, kills: 0, swings: 0, flees: 0, turned: 0 };
const oBroadcast = room.broadcast.bind(room); room.broadcast = (m) => { if (m.t === 'nd') felled.add(m.id); if (m.t === 'swing') stats.swings++; if (m.t === 'hit') stats.hits++; if (m.t === 'kill') { stats.kills++; const k = (m.cause || (m.by ? 'jugador' : 'otro')); (stats.causes = stats.causes || {})[k] = (stats.causes[k] || 0) + 1; if (stats.kills <= 2) console.log('kill', JSON.stringify(m)); } return oBroadcast(m); };
const ticks = MIN * 60 * 20, last = new Map();
for (let i = 0; i < ticks; i++) {
  room.tick();
  if (i % 20 === 0) for (const p of room.players.values()) { if (!p.ai) continue; modes[p.ai.mode] = (modes[p.ai.mode] || 0) + 1; if (p.ai.mode === 'flee' && last.get(p.id) !== 'flee') stats.flees++; last.set(p.id, p.ai.mode); }
}
for (const p of room.players.values()) if (p.ai) gears[p.ai.gear] = (gears[p.ai.gear] || 0) + 1;
const tot = Object.values(modes).reduce((a, b) => a + b, 0);
console.log(`Simulados ${MIN} min con ${room.count} bots`);
console.log('tiempo por actividad:', Object.entries(modes).map(([k, v]) => `${k} ${(v / tot * 100).toFixed(0)}%`).join(', '));
console.log('recursos talados/minados:', felled.size, '· golpes (swing):', stats.swings, '· impactos entre jugadores:', stats.hits, '· muertes:', stats.kills, '· huidas:', stats.flees);
console.log('causas de muerte:', JSON.stringify(stats.causes));
console.log('herramientas:', JSON.stringify(gears));
const moved = [...room.players.values()].map((p) => Math.hypot(p.x - (p.ai ? p.ai.px : p.x), p.z - (p.ai ? p.ai.pz : p.z)));
srv.close(); process.exit(0);
