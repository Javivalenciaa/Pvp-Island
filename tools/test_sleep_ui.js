// Navegador real: un jugador se desconecta, otro ve su cuerpo dormido, y al volver recupera inventario y posición. También la lista de jugadores de la pausa.
const { chromium } = require('/opt/node-tools/node_modules/playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2] || '/tmp/pvp-ui', PORT = 8098, ROOT = path.resolve(__dirname, '..'); fs.mkdirSync(OUT, { recursive: true });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const srv = spawn('node', ['src/index.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), BOT_BASES: '1', BOT_DRIFT: '0' }, stdio: 'ignore' }); process.on('exit', () => srv.kill());
  await new Promise((r) => setTimeout(r, 2500)); const b = await chromium.launch({ args: ARGS }); const errs = [];
  const open = async (ctx, name) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); await p.addInitScript((n) => { try { localStorage.setItem('isla-lang', 'en'); localStorage.setItem('isla-quality', 'baja'); localStorage.setItem('pvp-priv', '1'); localStorage.setItem('pvp-name', n); } catch (e) {} }, name);
    await p.goto('file://' + path.join(ROOT, 'client/index.html') + '?server=ws://localhost:' + PORT + '&map=isla&menu=1'); await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 300000 }); return p; };
  const join = async (p, name) => { await p.fill('#inName', name); await p.evaluate(() => document.querySelector('#btnPlay').click()); await p.waitForFunction(() => window.__isla && window.__isla.NET.on, null, { timeout: 90000 }); await p.waitForTimeout(1500); };
  const ctxA = await b.newContext({ viewport: { width: 640, height: 360 } }), ctxB = await b.newContext({ viewport: { width: 640, height: 360 } });
  const pb = await open(ctxB, 'Observador'); await join(pb, 'Observador');
  let pa = await open(ctxA, 'Dormilona'); await join(pa, 'Dormilona');
  // la dormilona recoge cosas y se mueve un poco
  const before = await pa.evaluate(async () => { const I = window.__isla; I.giveItem('wood', 37); I.giveItem('stone', 11); for (let i = 0; i < 12; i++) { I.player.pos.x += 1.5; I.player.pos.y = I.terrainH(I.player.pos.x, I.player.pos.z) + .1; await new Promise((r) => setTimeout(r, 200)); } await new Promise((r) => setTimeout(r, 4500)); return { x: I.player.pos.x, z: I.player.pos.z, id: I.NET.id }; });
  console.log('tokenA', await pa.evaluate(() => localStorage.getItem('pvp-token'))); await pa.evaluate(() => window.__isla.sendInv()); await pa.waitForTimeout(500); await pa.close(); await pb.bringToFront(); await pb.waitForTimeout(2500);
  const seen = await pb.evaluate((id) => { const I = window.__isla, r = [...I.remotes()].find((x) => x.id === id), q = I.NET.roster.get(id); return { remote: !!r, sleep: r && r.sleep, rosterSleep: q && q.sleep, dist: r ? Math.hypot(r.pos.x - I.player.pos.x, r.pos.z - I.player.pos.z) : -1 }; }, before.id);
  console.log(JSON.stringify(seen)); ok(seen.rosterSleep === 1, 'el otro jugador ve que se ha dormido (lista de jugadores)');
  // el observador camina hasta el cuerpo y lo mira
  await pb.evaluate(async (t) => { const I = window.__isla; for (let i = 0; i < 200; i++) { const dx = t.x - 3 - I.player.pos.x, dz = t.z - I.player.pos.z, d = Math.hypot(dx, dz); if (d < 1) break; const k = Math.min(2.2, d) / d; I.player.pos.x += dx * k; I.player.pos.z += dz * k; I.player.pos.y = I.terrainH(I.player.pos.x, I.player.pos.z) + .1; I.player.yaw = Math.atan2(dx, dz) + Math.PI; await new Promise((r) => setTimeout(r, 140)); } }, before);
  await pb.bringToFront(); await pb.waitForTimeout(3000); console.log('obs', JSON.stringify(await pb.evaluate(() => { const I = window.__isla; return { x: I.player.pos.x, z: I.player.pos.z, remotes: [...I.remotes()].map((r) => r.id + ':' + (r.sleep ? 'z' : '')) }; })), 'body', JSON.stringify(before)); await pb.screenshot({ path: path.join(OUT, '6-sleeping.png'), timeout: 120000 });
  const seen2 = await pb.evaluate((id) => { window.__isla.sim(.4); const r = [...window.__isla.remotes()].find((x) => x.id === id); return r ? { sleep: r.sleep, rot: r.g.rotation.x } : null; }, before.id); console.log(JSON.stringify(seen2)); ok(seen2 && seen2.sleep === true && seen2.rot < -1, 'el cuerpo dormido se ve tumbado en su sitio');
  // pausa: lista de jugadores sin ninguna mención a bots
  await pb.evaluate(() => window.__isla.renderPauseRoster()); await pb.waitForTimeout(300);
  const roster = await pb.evaluate(() => ({ head: document.querySelector('#prH').textContent, names: [...document.querySelectorAll('#prL span')].map((x) => x.textContent), txt: document.body.innerText }));
  console.log(JSON.stringify(roster.head), roster.names.join(' | ')); ok(roster.names.length >= 6 && roster.names.some((n) => /\(you\)/.test(n)) && roster.names.some((n) => /Dormilona.*Zzz/.test(n)), 'la pausa lista a todos los jugadores del mapa, también al dormido');
  ok(!/\bbots?\b/i.test(roster.txt), 'ningún texto de la pantalla menciona bots'); await pb.screenshot({ path: path.join(OUT, '7-pause-roster.png'), timeout: 120000 });
  await pb.evaluate(() => document.querySelector('#btnResume').click());
  // vuelve: mismo cuerpo, inventario y sitio
  pa = await open(ctxA, 'Dormilona'); console.log('tokenA2', await pa.evaluate(() => localStorage.getItem('pvp-token'))); await join(pa, 'Dormilona');
  const after = await pa.evaluate(() => { const I = window.__isla; return { x: I.player.pos.x, z: I.player.pos.z, id: I.NET.id, wood: I.inv.count('wood'), stone: I.inv.count('stone') }; });
  console.log(JSON.stringify(after)); ok(after.id === before.id && after.wood === 37 && after.stone === 11 && Math.hypot(after.x - before.x, after.z - before.z) < 3, 'al volver recupera el mismo cuerpo, la posición y el inventario');
  await pb.waitForTimeout(1500); ok(await pb.evaluate((id) => { const q = window.__isla.NET.roster.get(id); return q && !q.sleep; }, before.id), 'el observador ve que despierta');
  ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); srv.kill(); process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e); process.exit(1); });
