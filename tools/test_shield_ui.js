// Navegador real: con el escudo en la mano, mantener clic (izquierdo o derecho) levanta la guardia y la muestra en pantalla.
const { chromium } = require('/opt/node-tools/node_modules/playwright'); const { spawn } = require('child_process'); const path = require('path');
const PORT = 8097, ROOT = path.resolve(__dirname, '..'); const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn('node', ['src/index.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), BOT_BASES: '0', BOT_DRIFT: '0' }, stdio: 'ignore' }); process.on('exit', () => srv.kill());
  await new Promise((r) => setTimeout(r, 2500)); const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const p = await b.newPage({ viewport: { width: 1000, height: 580 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('isla-lang', 'en'); localStorage.setItem('isla-quality', 'baja'); localStorage.setItem('pvp-priv', '1'); localStorage.setItem('pvp-tut', '1'); } catch (e) {} });
  await p.goto('file://' + path.join(ROOT, 'client/index.html') + '?server=ws://localhost:' + PORT + '&map=isla'); await p.waitForFunction(() => document.body.classList.contains('ready') && !document.querySelector('#btnPlay').disabled, null, { timeout: 120000 });
  await p.evaluate(() => document.querySelector('#btnPlay').click()); await p.waitForFunction(() => window.__isla.NET.on && window.__isla.state === 'playing', null, { timeout: 60000 }); await p.waitForTimeout(1500);
  const r0 = await p.evaluate(() => { const I = window.__isla; I.inv.add('shield', 1); const i = I.inv.slots.findIndex((s) => s && s.id === 'shield'); I.sel = i; return i; }); await p.evaluate(() => window.__isla.sim(.3));
  const hint = await p.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|')); ok(/Shield: hold click/.test(hint), 'al sacar el escudo se explica cómo cubrirse');
  await p.evaluate(() => { window.__isla.press(true); window.__isla.sim(.3); });
  let st = await p.evaluate(() => ({ blk: window.__isla.NET.block, cls: document.body.classList.contains('blocking'), vis: !document.querySelector('#blk').hidden, txt: document.querySelector('#blk').textContent })); ok(st.blk && st.cls && st.vis, 'con clic izquierdo se cubre y aparece el indicador: ' + JSON.stringify(st));
  await p.evaluate(() => { window.__isla.press(false); window.__isla.sim(.3); }); st = await p.evaluate(() => ({ blk: window.__isla.NET.block, vis: !document.querySelector('#blk').hidden })); ok(!st.blk && !st.vis, 'al soltar baja la guardia');
  await p.evaluate(() => { window.__isla.pressR(true); window.__isla.sim(.3); }); st = await p.evaluate(() => window.__isla.NET.block); ok(st === true, 'con clic derecho también se cubre'); await p.evaluate(() => window.__isla.pressR(false));
  ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); srv.kill(); process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e); process.exit(1); });
