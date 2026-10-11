// Navegador real: siempre menú al abrir, racha diaria, objetivos que no se reinician, kills del mapa, causa de muerte y aviso de torreta.
const { chromium } = require('/opt/node-tools/node_modules/playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2] || '/tmp/pvp-ui', PORT = 8096, ROOT = path.resolve(__dirname, '..'); fs.mkdirSync(OUT, { recursive: true });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn('node', ['src/index.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), BOT_BASES: '1', BOT_DRIFT: '0' }, stdio: 'ignore' }); process.on('exit', () => srv.kill());
  await new Promise((r) => setTimeout(r, 2500)); const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.setItem('isla-lang', 'en'); localStorage.setItem('isla-quality', 'baja'); localStorage.setItem('pvp-priv', '1'); localStorage.setItem('pvp-tut', '1'); } } catch (e) {} });
  // 1) sin menu=1, el juego abre SIEMPRE el menú
  await p.goto('file://' + path.join(ROOT, 'client/index.html') + '?server=ws://localhost:' + PORT + '&map=isla'); await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 120000 }); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => window.__isla.state === 'menu' && !document.querySelector('#menu').hidden), 'al abrir, el juego muestra el menú (no entra directo al mapa)');
  // 2) racha: día 1 = hacha de hierro; los 7 días tienen premio
  const g = await p.evaluate(() => ({ n: window.__isla.GIFTS.length, d1: window.__isla.giftOf(1).kit.map((k) => k[0]), d2: window.__isla.giftOf(2).kit.map((k) => k[0]), d3: window.__isla.giftOf(3).kit.map((k) => k[0]), d4: window.__isla.giftOf(4).kit.map((k) => k[0]), d8: window.__isla.giftOf(8).kit.map((k) => k[0]) }));
  ok(g.n === 7 && g.d1[0] === 'iron_axe' && g.d2[0] === 'bomb' && g.d3.includes('ingot') && g.d4[0] === 'ballista' && g.d8[0] === 'iron_axe', 'racha: hacha de hierro, bombas, materiales, torreta… y vuelve a empezar al 8º día: ' + JSON.stringify(g));
  await p.evaluate(() => document.querySelector('#btnPlay').click()); await p.waitForFunction(() => window.__isla.NET.on && window.__isla.state === 'playing', null, { timeout: 60000 }); await p.waitForTimeout(3600);
  const d1 = await p.evaluate(() => ({ axe: window.__isla.inv.count('iron_axe'), banner: document.querySelector('#bannerT').textContent, streak: localStorage.getItem('pvp-streak') }));
  ok(d1.axe === 1 && d1.streak === '1' && /Day 1/.test(d1.banner), 'hoy te dan el hacha de hierro y lo anuncia: ' + JSON.stringify(d1));
  // 3) objetivos: no se reinician; con progreso guardado o inventario avanzado se saltan
  const o1 = await p.evaluate(() => { const I = window.__isla; I.stats.crafted.stone_axe = 1; I.stats.got.wood = 25; I.stats.got.stone = 12; I.stats.sawBase = 1; I.updateObjective(); const i0 = I.objIndex; localStorage.setItem('pvp-ostate', JSON.stringify({ i: i0, st: I.stats })); return i0; });
  ok(o1 >= 3, 'el progreso avanza (objetivo ' + (o1 + 1) + ')');
  const o2 = await p.evaluate(() => { const I = window.__isla; I.objIndex = 0; for (const k of ['got', 'crafted', 'placed']) for (const x of Object.keys(I.stats[k])) delete I.stats[k][x]; I.objRestore(); I.updateObjective(); return { i: I.objIndex, txt: document.querySelector('#objTxt').textContent }; });
  ok(o2.i >= o1, 'al volver a entrar, los objetivos se restauran y no vuelve a pedir talar un árbol: ' + JSON.stringify(o2));
  const o3 = await p.evaluate(() => { const I = window.__isla; localStorage.removeItem('pvp-ostate'); I.objIndex = 0; for (const k of ['got', 'crafted', 'placed']) for (const x of Object.keys(I.stats[k])) delete I.stats[k][x]; I.stats.sawBase = 0; I.stats.raidChests = 0; I.stats.looted = 0; I.inv.add('iron_pick', 1); I.inv.add('ingot', 6); I.objInfer(); I.updateObjective(); return { i: I.objIndex, txt: document.querySelector('#objTxt').textContent }; });
  ok(o3.i >= 9 && !/madera|wood/.test(o3.txt), 'con hierro en la mochila, los objetivos básicos se dan por hechos: ' + JSON.stringify(o3));
  // 3b) los planos conseguidos se conservan al salir y volver a entrar
  const bpt = await p.evaluate(() => { const I = window.__isla; I.stats.bp = { ballista: true }; I.stats.firstBp = true; localStorage.removeItem('pvp-ostate'); I.NET.on = true; I.stats.got.wood = 1; window.dispatchEvent(new Event('beforeunload')); const saved = JSON.parse(localStorage.getItem('pvp-ostate') || '{}'); I.stats.bp = {}; I.stats.firstBp = false; I.objRestore(); return { saved: !!(saved.st && saved.st.bp && saved.st.bp.ballista), now: I.stats.bp, first: I.stats.firstBp }; });
  ok(bpt.saved && bpt.now.ballista === true && bpt.first === true, 'un plano conseguido no se pierde al salir y volver a entrar: ' + JSON.stringify(bpt));
  // 4) kills del mapa arriba a la derecha y causa de muerte
  const k = await p.evaluate(() => { const I = window.__isla, N = I.NET; N.roster.set(901, { id: 901, name: 'Ragnar', tid: 'x', tribe: '' }); N.roster.set(902, { id: 902, name: 'Skadi', tid: 'y', tribe: '' });
    I.onKill({ victim: 902, killer: 901, cause: 'melee', w: 'iron_axe', kn: 'Ragnar', vn: 'Skadi', k: 3 }); I.onKill({ victim: 902, killer: 0, cause: 'turret', w: 'ballista', o: 'Ragnar', vn: 'Skadi', kn: 'Ragnar', k: 4 }); I.onKill({ victim: 901, killer: 0, cause: 'animal', w: 'wolf', vn: 'Ragnar' }); I.onKill({ victim: 901, killer: 0, cause: 'hunger', vn: 'Ragnar' });
    const el = document.querySelector('#kfeed'), r = el.getBoundingClientRect(), box = document.querySelector('#feedCol').getBoundingClientRect(); return { rows: [...el.children].map((c) => c.textContent), right: Math.round(innerWidth - r.right), top: Math.round(box.top), top3: document.querySelector('#ktop').textContent }; });
  console.log(JSON.stringify(k)); ok(k.rows.length === 4 && /Ragnar ⚔ Skadi · iron axe \(3\)/i.test(k.rows[0]) && /ballista turret/i.test(k.rows[1]) && /wolf/i.test(k.rows[2]) && /hunger/i.test(k.rows[3]), 'el recuadro de kills muestra quién mató a quién y cómo');
  ok(k.right < 40 && k.top < 130 && /Ragnar/.test(k.top3), 'está arriba a la derecha y hay un top de kills');
  const dt = await p.evaluate(() => { const I = window.__isla; return [I.deathText({ cause: 'turret', w: 'mortar', o: 'Ragnar' }), I.deathText({ cause: 'animal', w: 'wolf' }), I.deathText({ cause: 'melee', w: 'iron_axe', kn: 'Skadi' }), I.deathText({ cause: 'thirst' })]; });
  console.log(JSON.stringify(dt)); ok(/mortar/i.test(dt[0]) && /Ragnar/.test(dt[0]) && /wolf/i.test(dt[1]) && /Skadi killed you with iron axe/i.test(dt[2]) && /thirst/i.test(dt[3]), 'la causa de muerte siempre sale: torreta de X, lobo, jugador con arma, sed');
  // 5) aviso de torreta + informe al conectar
  const w = await p.evaluate(() => { const I = window.__isla; I.onTurretWarn({ w: 'ballista', o: 'Ragnar' }); return [...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|'); });
  ok(/Ragnar/.test(w) && /firing/i.test(w), 'avisa cuando una torreta te dispara: ' + w);
  const rp = await p.evaluate(() => { window.__isla.netMsg({ t: 'report', list: [{ who: 'Skadi', pieces: 3, chest: 1, deps: 2 }], tk: [{ w: 'ballista', v: 'Ragnar' }] }); const el = document.querySelector('#report'); return { hidden: el.hidden, txt: el.textContent }; });
  ok(!rp.hidden && /Ragnar/.test(rp.txt) && /Skadi/.test(rp.txt) && /pieces destroyed/.test(rp.txt), 'al conectar sale el log: lo que abatieron tus torretas y lo que te rompieron');
  await p.screenshot({ path: path.join(OUT, 'v4-killfeed.png'), timeout: 120000 });
  ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); srv.kill(); process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e); process.exit(1); });
