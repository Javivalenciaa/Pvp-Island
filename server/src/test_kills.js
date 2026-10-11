// causa de muerte, kills de torretas, aviso al objetivo, informe de defensas y daño reducido.
import { createServer } from './index.js';
import { DEF, EXPLOSIONS } from './deps.js';
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const srv = createServer({ port: 0, minPlayers: 0 }); await new Promise((r) => srv.wss.on('listening', r));
const room = srv.rooms[0], sock = (a) => ({ readyState: 1, send(s) { a.push(JSON.parse(s)); } }), la = [], lb = [];
const a = room.join('Intruso', 'ta', sock(la)), b = room.join('Dueño', 'tb', sock(lb)); a.prot = b.prot = 0; srv.setBots(false);
ok(DEF.ballista.turret.dmg <= 34 && DEF.flamer.turret.dmg <= 6 && DEF.mortar.turret.dmg <= 80 && EXPLOSIONS.shell.dmg <= 80, 'daño de torretas y mortero reducido (' + [DEF.ballista.turret.dmg, DEF.flamer.turret.dmg, DEF.mortar.turret.dmg].join('/') + ')');
const T = room.T; b.x = 20; b.z = 20; b.y = T.terrainH(20, 20); a.x = 26; a.z = 20; a.y = T.terrainH(26, 20); b.cs = false; a.cs = false;
room.onMessage(b, { t: 'place', dep: { t: 'ballista', x: 21, y: b.y, z: 20, r: 0 } }); const bl = [...room.D.map.values()].find((d) => d.t === 'ballista');
ok(bl && bl.ownerName === 'Dueño' && bl.ownerId === b.id, 'la torreta recuerda a su dueño'); bl.ammo = 20; a.hp = 40; la.length = 0; lb.length = 0;
b.ws.readyState = 0; // el dueño se desconecta
for (let i = 0; i < 90 && a.hp > 0; i++) { room.tick(); }
ok(la.some((m) => m.t === 'warn' && m.w === 'ballista' && m.o === 'Dueño'), 'el objetivo recibe un aviso de que una torreta le dispara');
const kill = la.find((m) => m.t === 'kill');
ok(kill && kill.cause === 'turret' && kill.w === 'ballista' && kill.o === 'Dueño' && kill.vn === 'Intruso', 'el mensaje de muerte incluye causa, torreta y dueño: ' + JSON.stringify(kill));
ok(kill && kill.killer === b.id && b.kills === 1 && kill.k === 1, 'la kill se acredita al dueño de la torreta');
ok((room.tkLog.get(b.tid) || []).length === 1, 'se guarda para el informe del dueño desconectado');
b.ws.readyState = 1; lb.length = 0; room.sendReport(b); const rep = lb.find((m) => m.t === 'report');
ok(rep && rep.tk.length === 1 && rep.tk[0].v === 'Intruso' && rep.tk[0].w === 'ballista', 'al conectarse recibe qué abatieron sus torretas'); lb.length = 0; room.sendReport(b); ok(!lb.some((m) => m.t === 'report'), 'el informe se entrega una sola vez');
// lobo: la causa lleva el tipo de animal
a.dead = 0; a.hp = 5; la.length = 0; room.hurt(a, 10, null, 'animal', { type: 'wolf', x: a.x, z: a.z }); const k2 = la.find((m) => m.t === 'kill'); ok(k2 && k2.cause === 'animal' && k2.w === 'wolf' && !k2.killer, 'muerte por lobo: causa animal + wolf');
// jugador con arma
a.dead = 0; a.hp = 5; b.held = 'iron_axe'; la.length = 0; room.hurt(a, 10, b, 'melee'); const k3 = la.find((m) => m.t === 'kill'); ok(k3 && k3.kn === 'Dueño' && k3.w === 'iron_axe' && k3.k === 2, 'muerte por jugador: nombre, arma y su total de kills');
// charla de ambiente: un jugador de la isla comenta tras abatirte
const bot = room.join('Skadi', 'tbot', null, true); bot.prot = 0; a.dead = 0; a.hp = 5; a.lang = 'en'; const rnd = Math.random; Math.random = () => 0; la.length = 0; room.hurt(a, 50, bot, 'melee');
for (let i = 0; i < 100; i++) room.tick(); Math.random = rnd; const say = la.find((m) => m.t === 'chat' && m.from === 'Skadi'); ok(say && say.text === 'gg', 'tras abatirte, el otro jugador comenta en tu idioma: ' + (say && say.text));
// lobo domado: defiende al dueño de un jabalí
const wolf = room.fauna.spawn('wolf'), boar = room.fauna.spawn('boar'); a.dead = 0; a.hp = 100; a.prot = 0; a.x = 100; a.z = 100; a.y = T.terrainH(100, 100); b.x = 400; b.z = 400;
wolf.owner = a.tid; wolf.x = a.x + 3; wolf.z = a.z; wolf.y = a.y; boar.x = a.x + 6; boar.z = a.z; boar.y = a.y; boar.mode = 1; boar.provoked = 10; const bhp = boar.hp;
for (let i = 0; i < 160 && !boar.dead; i++) { boar.provoked = 10; room.tick(); } ok(boar.dead || boar.hp < bhp, 'el lobo domado ataca al jabalí que acosa a su dueño (vida del jabalí ' + Math.round(boar.hp) + '/' + bhp + ')');
process.exit(process.exitCode || 0);
