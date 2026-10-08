// Navegador real: tirar objetos al suelo (clic derecho / Q), abrir la caja con cuenta atrás, coger solo lo que quieres.
const { chromium } = require('/opt/node-tools/node_modules/playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2] || '/tmp/pvp-ui', PORT = 8096, ROOT = path.resolve(__dirname, '..'); fs.mkdirSync(OUT, { recursive: true });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn('node', ['src/index.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), BOT_BASES: '0', BOT_DRIFT: '0', BOT_TARGETS: 'isla=0,cordillera=0' }, stdio: 'ignore' }); process.on('exit', () => srv.kill());
  await new Promise((r) => setTimeout(r, 2000)); const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('isla-lang', 'en'); localStorage.setItem('isla-quality', 'baja'); localStorage.setItem('pvp-priv', '1'); } catch (e) {} });
  await p.goto('file://' + path.join(ROOT, 'client/index.html') + '?server=ws://localhost:' + PORT + '&map=isla&menu=1'); await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 120000 });
  await p.evaluate(() => document.querySelector('#btnPlay').click()); await p.waitForFunction(() => window.__isla && window.__isla.NET.on, null, { timeout: 90000 }); await p.waitForTimeout(1500);
  // mochila llena de piedra + madera + una hacha; tiramos con el botón derecho (evento contextmenu) y con Q
  await p.evaluate(() => { const I = window.__isla; I.giveItem('wood', 60); I.giveItem('stone', 40); I.giveItem('stone_axe', 1); });
  const n0 = await p.evaluate(() => window.__isla.inv.count('wood')); await p.keyboard.press('Tab'); await p.waitForTimeout(500);
  await p.evaluate(() => { const I = window.__isla, i = I.inv.slots.findIndex((s) => s && s.id === 'wood'); document.querySelector(`#slots [data-i="${i}"]`).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
  await p.waitForTimeout(800); const n1 = await p.evaluate(() => ({ wood: window.__isla.inv.count('wood'), bags: window.__isla.NET.bags.size }));
  ok(n1.wood < n0 && n1.bags === 1, `clic derecho tira la pila al suelo (madera ${n0} -> ${n1.wood}) y aparece una caja (${n1.bags})`);
  await p.evaluate(() => window.__isla.dropSlot(window.__isla.inv.slots.findIndex((s) => s && s.id === 'stone_axe'), false)); await p.waitForTimeout(600);
  ok(await p.evaluate(() => window.__isla.NET.bags.size === 2), 'también se puede tirar una herramienta: 2 cajas en el suelo');
  // abrir una caja con E (mensaje bopen) y coger
  await p.evaluate(() => { const I = window.__isla, id = [...I.NET.bags.keys()][0]; I.netSend({ t: 'bopen', id }); }); await p.waitForTimeout(800);
  const open = await p.evaluate(() => ({ bag: window.__isla.chestOpen && window.__isla.chestOpen.bag, slots: [...document.querySelectorAll('#cslots .slot')].filter((e) => e.innerHTML.length > 40).length, timer: document.querySelector('#bagTimer').hidden ? '' : document.querySelector('#bagTimer').textContent, title: document.querySelector('#chestTitle').textContent }));
  console.log(JSON.stringify(open)); ok(open.bag && open.slots >= 1 && /disappears in 0:[0-5]\d/.test(open.timer) && open.title === 'Crate', 'la caja se abre con su contenido y la cuenta atrás bajo el inventario: ' + open.timer);
  await p.screenshot({ path: path.join(OUT, '8-crate.png'), timeout: 120000 });
  const w0 = await p.evaluate(() => window.__isla.inv.count('wood')), a0 = await p.evaluate(() => window.__isla.inv.count('stone_axe'));
  await p.evaluate(() => document.querySelector('#cslots [data-c="0"]').click()); await p.waitForTimeout(800);
  const got = await p.evaluate(() => ({ wood: window.__isla.inv.count('wood'), axe: window.__isla.inv.count('stone_axe'), bags: window.__isla.NET.bags.size, open: !!(window.__isla.chestOpen && window.__isla.chestOpen.bag) }));
  ok((got.wood > w0 || got.axe > a0) && got.bags === 1, 'al coger lo que contiene, la caja vacía desaparece y queda la otra'); console.log(JSON.stringify(got));
  await p.keyboard.press('Tab'); await p.waitForTimeout(400); await p.evaluate(() => { const I = window.__isla; I.sendInv && 0; });
  await p.keyboard.press('KeyQ'); await p.waitForTimeout(800); ok(await p.evaluate(() => window.__isla.NET.bags.size >= 1), 'la tecla Q también tira el objeto de la barra rápida (sin errores)');
  ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); srv.kill(); process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e); process.exit(1); });
