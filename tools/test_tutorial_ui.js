// Navegador real: primera partida = tutorial inmediato (sin esperar red): revienta la base de paja, fabrica, construye, farmea y pasa a la isla con kit.
const { chromium } = require('/opt/node-tools/node_modules/playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2] || '/tmp/pvp-ui', PORT = 8095, ROOT = path.resolve(__dirname, '..'); fs.mkdirSync(OUT, { recursive: true });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn('node', ['src/index.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), BOT_BASES: '1', BOT_DRIFT: '0' }, stdio: 'ignore' }); process.on('exit', () => srv.kill());
  await new Promise((r) => setTimeout(r, 2500)); const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('isla-lang', 'en'); localStorage.setItem('isla-quality', 'baja'); localStorage.setItem('pvp-priv', '1'); } catch (e) {} });
  await p.goto('file://' + path.join(ROOT, 'client/index.html') + '?server=ws://localhost:' + PORT + '&map=isla&menu=1'); await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 120000 });
  const t0 = Date.now(); await p.evaluate(() => document.querySelector('#btnPlay').click());
  await p.waitForFunction(() => window.__isla.TUT.on && window.__isla.state === 'playing', null, { timeout: 30000 }); ok(true, `el tutorial arranca al instante, sin esperar al servidor (${Date.now() - t0} ms, ya en juego)`);
  await p.waitForTimeout(1500); const s0 = await p.evaluate(() => ({ obj: document.querySelector('#objTxt').textContent, lab: document.querySelector('#objLab').textContent, sub: document.querySelector('#objSub').textContent, bombs: window.__isla.inv.count('bomb'), base: window.__isla.pieces.filter((x) => x.owner === 'tut').length }));
  console.log(JSON.stringify(s0)); ok(/Blow up/.test(s0.obj) && s0.bombs === 5 && s0.base >= 12, 'paso 1: bombas en la mochila y una base de paja delante');
  await p.screenshot({ path: path.join(OUT, '9-tutorial.png'), timeout: 120000 });
  // lanzamos explosiones sobre la base (equivale a las bombas lanzadas)
  await p.evaluate(() => { const I = window.__isla, T = window.THREE, B = I.TUT.base; for (const [dx, dz] of [[0, 0], [2, 2], [-2, -2], [3, -1]]) I.explode(new T.Vector3(B.x + dx, I.terrainH(B.x, B.z) + 1.5, B.z + dz), 6, 300, { noPlayer: true }); });
  await p.waitForFunction(() => window.__isla.TUT.step >= 1, null, { timeout: 30000 }); const s1 = await p.evaluate(() => ({ wood: window.__isla.inv.count('wood'), step: window.__isla.TUT.step }));
  ok(s1.wood >= 140, `la base revienta y da botín: ${s1.wood} de madera, pasa al paso 2`);
  await p.evaluate(() => { const I = window.__isla; I.stats.crafted.spear = 1; }); await p.evaluate(() => window.__isla.sim(1.2)); await p.waitForFunction(() => window.__isla.TUT.step >= 2, null, { timeout: 60000 }); ok(true, 'fabricar la lanza avanza al paso 3');
  await p.evaluate(() => { const I = window.__isla; I.stats.placed.foundation = 1; }); await p.evaluate(() => window.__isla.sim(1.2)); await p.waitForFunction(() => window.__isla.TUT.step >= 3, null, { timeout: 60000 }); ok(true, 'colocar el cimiento avanza al paso 4');
  await p.evaluate(() => { const I = window.__isla; I.stats.placed.wall = 3; I.stats.placed.door = 1; }); await p.evaluate(() => window.__isla.sim(1.2)); await p.waitForFunction(() => window.__isla.TUT.step >= 4, null, { timeout: 60000 }); ok(true, 'paredes y puerta avanzan al paso 5 (farmeo)');
  await p.evaluate(() => { const I = window.__isla; I.stats.got.wood = (I.stats.got.wood || 0) + 15; I.sim(1.2); });
  await p.waitForFunction(() => window.__isla.NET.on, null, { timeout: 60000 }); const end = await p.evaluate(() => ({ tut: window.__isla.TUT.on, axe: window.__isla.inv.count('stone_axe'), bomb: window.__isla.inv.count('bomb'), flag: localStorage.getItem('pvp-tut') }));
  console.log(JSON.stringify(end)); ok(!end.tut && end.axe >= 1 && end.bomb >= 1 && end.flag === '1', 'al acabar pasa a la isla online con el kit inicial y no vuelve a salir el tutorial');
  ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); srv.kill(); process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e); process.exit(1); });
