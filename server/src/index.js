import { WebSocketServer } from 'ws';
import { Room } from './room.js';
import { brain, botName } from './bots.js';
import { MAPS } from '../../shared/maps.js';
import { loadRoom, saveRoom } from './persist.js';
// Dos servidores de hasta 20 jugadores: uno por mapa. Si no hay jugadores humanos suficientes se rellenan con bots.
// minPlayers: número (igual para todos los mapas) o { isla: 6, cordillera: 7 }. `drift` hace que el objetivo de cada sala fluctúe ±1 de vez en cuando (sala más viva).
export function createServer({ port = 8080, maxPlayers = 20, minPlayers = 8, dataDir = null, drift = false } = {}) {
  const rooms = Object.keys(MAPS).map((id) => new Room(id, maxPlayers));
  rooms.forEach((r) => loadRoom(r, dataDir));
  const saver = dataDir ? setInterval(() => rooms.forEach((r) => { try { saveRoom(r, dataDir); } catch (e) { console.error('guardado', e.message); } }), 30000) : null;
  let botN = 0, botsOn = true;
  const baseOf = (room) => (typeof minPlayers === 'number' ? minPlayers : (minPlayers[room.mapId] ?? 8)), target = new Map();
  const goal = (room) => Math.max(0, Math.min(room.max - 1, target.has(room.mapId) ? target.get(room.mapId) : baseOf(room)));
  const addBot = (room) => { const n = botN++; const p = room.join(botName(n) + (n >= 12 ? n : ''), null, null, true, 'tb' + Math.floor(n / 3)); if (p && botsOn) p.brain = brain; return p; };
  const balance = (room) => { // bots hasta minPlayers; los bots dejan sitio a los humanos
    const bots = [...room.players.values()].filter((p) => p.bot);
    const g = goal(room);
    while (room.count < g && room.count < room.max) addBot(room);
    while (room.count > g && bots.length) { room.leave(bots.pop()); }
    if (room.count >= room.max) { const b = [...room.players.values()].find((p) => p.bot); if (b) room.leave(b); }
  };
  rooms.forEach(balance);
  const driftT = drift ? setInterval(() => { for (const r of rooms) { const b = baseOf(r); if (b <= 0) continue; target.set(r.mapId, Math.max(2, b + (Math.random() < .5 ? -1 : 1) * (Math.random() < .6 ? 1 : 0))); balance(r); } }, 45000) : null;
  const wss = new WebSocketServer({ port });
  wss.on('connection', (ws) => {
    let me = null, room = null;
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch (e) { return; }
      if (!me) {
        if (m.t === 'list') { ws.send(JSON.stringify({ t: 'rooms', rooms: rooms.map((r) => r.info()) })); return; }
        if (m.t !== 'join') return;
        room = rooms.find((r) => r.mapId === m.map) || rooms.sort((a, b) => a.humans - b.humans)[0];
        if (room.count >= room.max) { const b = [...room.players.values()].find((p) => p.bot); if (b) room.leave(b); }
        me = room.join(m.name, m.token, ws, false, null, m.look);
        if (!me) { ws.send(JSON.stringify({ t: 'full' })); return; }
        ws.send(JSON.stringify({ t: 'welcome', id: me.id, map: room.mapId, seed: room.map.seed, world: room.map.world, tid: me.tid, tribe: room.pub(me).tribe, phase: room.phase(), wx: room.wx.state, day: Math.floor((room.t + 42) / 600) + 1, x: me.x, z: me.z, roster: [...room.players.values()].map((q) => room.pub(q)) }));
        if (room.B.map.size) ws.send(JSON.stringify({ t: 'pieces', list: [...room.B.map.values()].map((q) => room.B.pub(q)) }));
        if (room.D.map.size) ws.send(JSON.stringify({ t: 'deps', list: [...room.D.map.values()].map((d) => room.D.pub(d)) }));
        if (room.nodes.size) ws.send(JSON.stringify({ t: 'nodes', list: [...room.nodes.keys()] }));
        if (room.D.bags.size) ws.send(JSON.stringify({ t: 'bags', list: [...room.D.bags.values()].map((b) => ({ id: b.id, x: b.x, y: b.y, z: b.z })) }));
        balance(room); return;
      }
      room.onMessage(me, m);
    });
    ws.on('close', () => { if (me && room) { room.leave(me); balance(room); } });
  });
  return { wss, rooms, setBots(v) { botsOn = v; for (const r of rooms) for (const p of r.players.values()) if (p.bot) p.brain = v ? brain : null; }, close() { if (driftT) clearInterval(driftT); if (saver) { clearInterval(saver); rooms.forEach((r) => saveRoom(r, dataDir)); } rooms.forEach((r) => r.close()); wss.close(); } };
}
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  const port = +process.env.PORT || 8080; let mp = { isla: 6, cordillera: 7 };
  if (process.env.BOT_TARGETS) { mp = {}; for (const kv of process.env.BOT_TARGETS.split(',')) { const [k, v] = kv.split('='); if (k && Number.isFinite(+v)) mp[k.trim()] = +v; } } // p. ej. BOT_TARGETS=isla=6,cordillera=7
  const srv = createServer({ port, dataDir: process.env.DATA_DIR || null, minPlayers: mp, drift: process.env.BOT_DRIFT !== '0' });
  console.log('Servidor en el puerto', port, process.env.DATA_DIR ? '(guardando en ' + process.env.DATA_DIR + ')' : '(sin persistencia)', 'ocupación base:', JSON.stringify(mp));
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { srv.close(); process.exit(0); });
}
