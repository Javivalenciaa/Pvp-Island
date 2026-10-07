// Simulación sin red de bases de bots: construcción, arcones, bombas, raids y defensa. MIN=minutos simulados, SEED=0 para no sembrar bases iniciales.
import { createServer } from './index.js';
import { bases } from './botbase.js';
const MIN = +process.env.MIN || 10, BOTS = +process.env.BOTS || 9;
const srv = createServer({ port: 0, minPlayers: { isla: BOTS, cordillera: 0 }, bases: process.env.SEED !== '0' }); await new Promise((r) => srv.wss.on('listening', r));
const room = srv.rooms[0]; for (const p of room.players.values()) p.prot = 0;
const evs = [], oB = room.broadcast.bind(room); room.broadcast = (m) => { if (m.t === 'ev') evs.push([Math.round(room.t), m.k, m.a, m.b].join(' ')); if (m.t === 'boom') (room._booms = room._booms || []).push(1); return oB(m); };
const summary = () => { const bs = bases(room, true); return [...bs.values()].map((o) => `${o.name}[${o.tid}] piezas=${o.n} tier=${[...room.B.map.values()].filter((q) => q.owner === o.tid).reduce((s, q) => s + q.tier, 0)} cofres=${o.chests.length}`).join(' | '); };
const ticks = MIN * 60 * 20; const t0 = Date.now(); let slow = 0;
for (let i = 0; i < ticks; i++) {
  const a = performance.now(); room.tick(); const d = performance.now() - a; if (d > 20) slow++;
  if (i % (20 * 60) === 0) console.log(`t=${Math.round(i / 1200)}m`, summary());
}
console.log('FINAL', summary());
for (const bt of room._bb.bt.values()) console.log(bt.tid, 'base', !!bt.base, 'built', bt.built, 'pool', JSON.stringify(Object.fromEntries(Object.entries(bt.pool).map(([k, v]) => [k, Math.round(v)]))), 'raid', bt.raid && bt.raid.phase, 'known', [...bt.known].join(','));
const bots = [...room.players.values()].filter((p) => p.ai); const modes = {}; for (const p of bots) modes[p.ai.mode] = (modes[p.ai.mode] || 0) + 1; console.log('modos', JSON.stringify(modes), 'bombas', bots.reduce((s, p) => s + (p.ai.bombs || 0), 0));
console.log('EVENTOS', evs.length); console.log(evs.slice(0, 40).join('\n')); console.log('explosiones', (room._booms || []).length, 'ticks lentos >20ms:', slow, 'cpu s', ((Date.now() - t0) / 1000).toFixed(1));
srv.close(); process.exit(0);
