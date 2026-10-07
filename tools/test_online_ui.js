// Prueba en navegador real (Chromium + swiftshader) contra un servidor local: menú, entrada en partida, bases visibles, brújula, feed, rango y mapa.
// Uso: node tools/test_online_ui.js [salida]   (capturas en la carpeta indicada, por defecto /tmp/pvp-ui)
const { chromium } = require('/opt/node-tools/node_modules/playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2] || '/tmp/pvp-ui', PORT = 8099, ROOT = path.resolve(__dirname, '..'); fs.mkdirSync(OUT, { recursive: true });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn('node', ['src/index.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), BOT_BASES: '1', BOT_DRIFT: '0' }, stdio: 'ignore' });
  global.__srv = srv; process.on('exit', () => { try { srv.kill(); } catch (e) { /* nada */ } }); await new Promise((r) => setTimeout(r, 2500));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  global.__b = b; const errs = []; const lang = process.env.LANG_UI || 'en';
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', (e) => errs.push(e.message + ' @ ' + String(e.stack || '').split('\n').slice(0, 6).join(' <- '))); p.on('console', (m) => { if (m.type() === 'error' && !/WebGL|GPU|swiftshader|ERR_TUNNEL|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  await p.addInitScript((l) => { try { localStorage.setItem('isla-lang', l); localStorage.setItem('isla-quality', 'baja'); localStorage.setItem('pvp-priv', '1'); } catch (e) {} }, lang);
  await p.goto('file://' + path.join(ROOT, 'client/index.html') + '?server=ws://localhost:' + PORT + '&map=isla&menu=1');
  await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 90000 }); await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, '1-menu-' + lang + '.png'), timeout: 120000 });
  ok(await p.evaluate(() => /bases|base/i.test(document.querySelector('#liveStat').textContent)), 'el menú muestra el estado del servidor: ' + await p.evaluate(() => document.querySelector('#liveStat').textContent));
  await p.evaluate(() => document.querySelector('#btnPlay').click());
  await p.waitForFunction(() => window.__isla && window.__isla.NET.on, null, { timeout: 60000 }); ok(true, 'conectado al servidor');
  await p.waitForFunction(() => !document.querySelector('#rank').hidden && !document.querySelector('#baseping').hidden, null, { timeout: 40000 }).catch(() => {}); await p.screenshot({ path: path.join(OUT, '2-spawn-' + lang + '.png'), timeout: 120000 });
  const st = await p.evaluate(() => ({ bases: window.__isla.NET.bases.length, names: window.__isla.NET.bases.map((b) => b.name).join(','), obj: document.querySelector('#objTxt').textContent, ping: document.querySelector('#baseping').hidden ? '' : document.querySelector('#baseping').textContent, rank: document.querySelector('#rank').hidden ? '' : document.querySelector('#rkN').textContent, pieces: window.__isla.pieces.length }));
  console.log(JSON.stringify(st)); ok(st.bases >= 2, 'el cliente conoce las bases: ' + st.names); ok(st.ping.length > 3, 'la brújula apunta a una base: ' + st.ping); ok(/Lv|Nv/.test(st.rank), 'hay rango visible: ' + st.rank);
  // caminar (a saltos permitidos por el servidor) hasta junto a la base más cercana para verla de cerca
  await p.evaluate(async () => { const I = window.__isla, b = I.NET.bases.filter((x) => x.bot).sort((a, c) => Math.hypot(a.x - I.player.pos.x, a.z - I.player.pos.z) - Math.hypot(c.x - I.player.pos.x, c.z - I.player.pos.z))[0], tx = b.x - 12, tz = b.z + 9;
    for (let i = 0; i < 140; i++) { const dx = tx - I.player.pos.x, dz = tz - I.player.pos.z, d = Math.hypot(dx, dz); if (d < 1.5) break; const k = Math.min(2.2, d) / d; I.player.pos.x += dx * k; I.player.pos.z += dz * k; I.player.pos.y = I.terrainH(I.player.pos.x, I.player.pos.z) + .1; I.player.yaw = Math.atan2(dx, dz) + Math.PI; await new Promise((r) => setTimeout(r, 160)); } });
  await p.waitForTimeout(2500); await p.screenshot({ path: path.join(OUT, '3-base-' + lang + '.png'), timeout: 120000 });
  // mensajes del servidor: feed, alertas e informe de raid
  await p.evaluate(() => { const I = window.__isla; for (const m of [{ t: 'ev', k: 'raid', a: 'Clan Ravn', b: 'Clan Fenrir' }, { t: 'ev', k: 'chest', a: 'Clan Ravn', b: 'Clan Fenrir' }, { t: 'ev', k: 'loot', a: 'Clan Ravn', b: 'Clan Fenrir' }, { t: 'ev', k: 'base', a: 'Clan Skadi' }, { t: 'alert', k: 'hit', by: 'Clan Ravn' }, { t: 'report', list: [{ who: 'Clan Ravn', pieces: 5, chest: 1, deps: 2, bot: true }, { who: 'Ragnar', pieces: 2, chest: 0, deps: 0 }] }]) I.netMsg(m); });
  await p.waitForTimeout(600); ok(await p.evaluate(() => document.querySelectorAll('#feed .ev').length >= 4 && !document.querySelector('#report').hidden), 'el feed y el informe de raid se muestran');
  await p.screenshot({ path: path.join(OUT, '5-events-' + lang + '.png'), timeout: 120000 });
  await p.keyboard.press('m'); await p.waitForTimeout(800); await p.screenshot({ path: path.join(OUT, '4-map-' + lang + '.png'), timeout: 120000 }); await p.keyboard.press('m');
  ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); srv.kill(); process.exit(process.exitCode || 0);
})().catch(async (e) => { console.error(e); try { global.__srv && global.__srv.kill(); if (global.__b) await global.__b.close(); } catch (x) { /* nada */ } process.exit(1); });
