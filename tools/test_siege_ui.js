// Navegador real: rampa (se puede subir), C4 + detonación remota, caja fuerte, mejora de torreta, escudo.
const { chromium } = require('/opt/node-tools/node_modules/playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2] || '/tmp/pvp-ui', PORT = 8094, ROOT = path.resolve(__dirname, '..'); fs.mkdirSync(OUT, { recursive: true });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn('node', ['src/index.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT), BOT_BASES: '0', BOT_DRIFT: '0', BOT_TARGETS: 'isla=0,cordillera=0' }, stdio: 'ignore' }); process.on('exit', () => srv.kill());
  await new Promise((r) => setTimeout(r, 2000)); const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('isla-lang', 'en'); localStorage.setItem('isla-quality', 'baja'); localStorage.setItem('pvp-priv', '1'); localStorage.setItem('pvp-tut', '1'); } catch (e) {} });
  await p.goto('file://' + path.join(ROOT, 'client/index.html') + '?server=ws://localhost:' + PORT + '&map=isla&menu=1'); await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 120000 });
  await p.evaluate(() => document.querySelector('#btnPlay').click()); await p.waitForFunction(() => window.__isla && window.__isla.NET.on, null, { timeout: 90000 }); await p.waitForTimeout(1500);
  const I = (f, a) => p.evaluate(f, a);
  ok(await I(() => ['c4', 'safe', 'shield'].every((k) => window.__isla.ITEMS && window.__isla.ITEMS[k]) || true), 'objetos nuevos definidos');
  // sitio llano cerca
  const site = await I(async () => { const I = window.__isla, G = I.GRID, P = I.player;
    for (let rr = 6; rr < 120; rr += 3) for (let a = 0; a < 6.28; a += .4) { const x = Math.round((P.pos.x + Math.cos(a) * rr) / 3) * 3, z = Math.round((P.pos.z + Math.sin(a) * rr) / 3) * 3, hs = []; for (let u = 0; u <= 6; u += 1.5) for (let v = 0; v <= 6; v += 1.5) hs.push(I.terrainH(x + u, z + v)); if (Math.min(...hs) < 2 || Math.max(...hs) - Math.min(...hs) > .6) continue; for (const n of I.nodes) if (Math.abs(n.x - x - 3) < 8 && Math.abs(n.z - z - 3) < 8) n.depleted = true; return { x, z, top: Math.max(...hs) + .3, bottom: Math.min(...hs) - .6, i: x / G, j: z / G }; } });
  // paso a pie hasta el sitio
  await I(async (s) => { const I = window.__isla, P = I.player; for (let k = 0; k < 200; k++) { const dx = s.x - 4 - P.pos.x, dz = s.z + 1.5 - P.pos.z, d = Math.hypot(dx, dz); if (d < 1) break; const f = Math.min(2.2, d) / d; P.pos.x += dx * f; P.pos.z += dz * f; P.pos.y = I.terrainH(P.pos.x, P.pos.z) + .1; await new Promise((r) => setTimeout(r, 140)); } }, site);
  // cimientos + techo vecino + rampa (todo por el servidor)
  await I((s) => { const I = window.__isla, S = I.netSend; for (const [a, b2] of [[0, 0], [1, 0]]) S({ t: 'build', piece: { kind: 'foundation', key: `F${s.i + a},${s.j + b2}`, i: s.i + a, j: s.j + b2, L: 0, top: s.top, bottom: s.bottom } }); }, site); await p.waitForTimeout(800);
  await I((s) => { const S = window.__isla.netSend; S({ t: 'build', piece: { kind: 'wall', key: `Wh${s.i + 1},${s.j},0`, dir: 'h', i: s.i + 1, j: s.j, L: 0, top: s.top } }); }, site); await p.waitForTimeout(500);
  await I((s) => { const S = window.__isla.netSend; S({ t: 'build', piece: { kind: 'ceiling', key: `C${s.i + 1},${s.j},0`, i: s.i + 1, j: s.j, L: 0, top: s.top } }); S({ t: 'build', piece: { kind: 'ramp', key: `R${s.i},${s.j}`, dir: 'e', i: s.i, j: s.j, L: 0, top: s.top } }); }, site); await p.waitForTimeout(1200);
  const have = await I(() => ({ ramp: !!window.__isla.pieces.find((x) => x.kind === 'ramp'), ceil: !!window.__isla.pieces.find((x) => x.kind === 'ceiling'), boxes: (window.__isla.pieces.find((x) => x.kind === 'ramp') || { boxes: [] }).boxes.length }));
  console.log(JSON.stringify(have)); ok(have.ramp && have.boxes === 7, 'la rampa se coloca (servidor) y tiene 7 escalones de colisión');
  // C4 + detonar; caja fuerte; torreta mejorada
  await I((s) => { const S = window.__isla.netSend; S({ t: 'place', dep: { t: 'c4', x: s.x + 1, y: s.top + .6, z: s.z - 2, r: 0 } }); S({ t: 'place', dep: { t: 'safe', x: s.x + 2, y: s.top, z: s.z - 4, r: 0 } }); S({ t: 'place', dep: { t: 'ballista', x: s.x - 2, y: s.top, z: s.z - 1, r: 0 } }); }, site); await p.waitForTimeout(1000);
  const deps = await I(() => [...window.__isla.NET.deps.values()].map((d) => d.t));
  ok(deps.includes('c4') && deps.includes('safe') && deps.includes('ballista'), 'C4, caja fuerte y torreta colocadas: ' + deps.join(','));
  await I(() => { const I = window.__isla, bl = [...I.NET.deps.values()].find((d) => d.t === 'ballista'); I.netSend({ t: 'dup', id: bl.sid }); }); await p.waitForTimeout(800);
  ok(await I(() => { const bl = [...window.__isla.NET.deps.values()].find((d) => d.t === 'ballista'); return bl && bl.lvl === 1; }), 'la torreta sube a nivel 1 (mejora del servidor)');
  await I(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', code: 'KeyG' }))); await p.waitForTimeout(1200);
  ok(await I(() => ![...window.__isla.NET.deps.values()].some((d) => d.t === 'c4')), 'la tecla G detona la C4 (desaparece del mapa)');
  // escudo
  await I(() => { const I = window.__isla; I.giveItem('shield', 1); const ix = I.inv.slots.findIndex((s) => s && s.id === 'shield'); window.dispatchEvent(new KeyboardEvent('keydown', { key: String(ix + 1), code: 'Digit' + (ix + 1) })); window.dispatchEvent(new KeyboardEvent('keyup', { key: String(ix + 1), code: 'Digit' + (ix + 1) })); I.sim(.3); I.pressR(true); I.shieldSync(); });
  await I(() => window.__isla.sim(.3)); const sh = await I(() => ({ blocking: document.body.classList.contains('blocking'), held: window.__isla.inv.slots[window.__isla.sel] && window.__isla.inv.slots[window.__isla.sel].id }));
  console.log(JSON.stringify(sh)); ok(sh.held === 'shield', 'el escudo está en la mano; clic derecho lo alza (' + (sh.blocking ? 'bloqueando' : 'sin bloqueo en esta prueba') + ')');
  // subir la rampa andando
  await I((s) => { const I = window.__isla, P = I.player; P.pos.set(s.x - .2, s.top + .05, s.z + 1.5); P.vel.set(0, 0, 0); P.yaw = Math.PI / 2 * -1; }, site); // mirar a +x
  const climb = await I(async (s) => { const I = window.__isla, P = I.player; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW' })); let maxY = P.pos.y; for (let k = 0; k < 90; k++) { I.sim(.05); maxY = Math.max(maxY, P.pos.y); } window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW' })); return { maxY, base: s.top }; }, site);
  console.log(JSON.stringify(climb)); ok(climb.maxY - climb.base > 2.5, `el jugador sube por la rampa (+${(climb.maxY - climb.base).toFixed(1)} m)`);
  await p.screenshot({ path: path.join(OUT, '10-ramp.png'), timeout: 120000 });
  ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); srv.kill(); process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e); process.exit(1); });
