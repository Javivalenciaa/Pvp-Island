import { WebSocketServer } from 'ws';
import { Room } from './room.js';
import { brain, botName } from './bots.js';
import { MAPS } from '../../shared/maps.js';
// Dos servidores de hasta 20 jugadores: uno por mapa. Si no hay jugadores humanos suficientes se rellenan con bots.
export function createServer({ port = 8080, maxPlayers = 20, minPlayers = 8 } = {}) {
  const rooms = Object.keys(MAPS).map((id) => new Room(id, maxPlayers));
  let botN = 0;
  const addBot = (room) => { const p = room.join(botName(botN++) + (botN > 12 ? botN : ''), `Tribu ${1 + (botN % 4)}`, null, true); if (p) p.brain = brain; return p; };
  const balance = (room) => { // bots hasta minPlayers; los bots dejan sitio a los humanos
    const bots = [...room.players.values()].filter((p) => p.bot);
    while (room.count < minPlayers && room.count < room.max) addBot(room);
    while (room.count > minPlayers && bots.length) { room.leave(bots.pop()); }
    if (room.count >= room.max) { const b = [...room.players.values()].find((p) => p.bot); if (b) room.leave(b); }
  };
  rooms.forEach(balance);
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
        me = room.join(m.name, m.tribe, ws);
        if (!me) { ws.send(JSON.stringify({ t: 'full' })); return; }
        ws.send(JSON.stringify({ t: 'welcome', id: me.id, map: room.mapId, seed: room.map.seed, world: room.map.world, tribe: me.tribe, x: me.x, z: me.z, roster: [...room.players.values()].map((q) => ({ id: q.id, name: q.name, tribe: q.tribe, bot: q.bot })) }));
        balance(room); return;
      }
      room.onMessage(me, m);
    });
    ws.on('close', () => { if (me && room) { room.leave(me); balance(room); } });
  });
  return { wss, rooms, close() { rooms.forEach((r) => r.close()); wss.close(); } };
}
if (process.argv[1] && process.argv[1].endsWith('index.js')) { const port = +process.env.PORT || 8080; createServer({ port, minPlayers: process.env.MIN_PLAYERS !== undefined ? +process.env.MIN_PLAYERS : 8 }); console.log('Servidor en el puerto', port); }
