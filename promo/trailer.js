const C = require('./cap.js'); const fs = require('fs');
const STORY = process.env.STORY === '1'; const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  const { b, p } = await C.open(); const E = (f, a) => p.evaluate(f, a);
  await E(() => { document.querySelector('#btnPlay').click(); document.querySelector('[data-q="baja"]').click(); });
  // free-camera hook + site + inventory
  const info = await E(() => {
    const I = window.__isla; const r0 = I.post.render.bind(I.post);
    I.post.render = (t) => { const c = window.__cam; if (!c) I.camera.children.forEach((q) => { q.visible = true; }); if (c) { let sx = 0, sy = 0, sz = 0; if (window.__shake > 0) { sx = (Math.random() - .5) * window.__shake; sy = (Math.random() - .5) * window.__shake; sz = (Math.random() - .5) * window.__shake; window.__shake *= .88; } I.camera.position.set(c.x + sx, c.y + sy, c.z + sz); I.camera.lookAt(c.tx, c.ty, c.tz); } I.camera.children.forEach((q) => { q.visible = !c; }); r0(t); };
    I.giveItem('stone_axe', 1); I.giveItem('stone_pick', 1); I.giveItem('iron_sword', 1); I.giveItem('wood', 300); I.giveItem('stone', 100);
    const types = {}; for (const n of I.nodes) types[n.type] = (types[n.type] || 0) + 1;
    return { types, spawn: I.spawn };
  });
  console.log(JSON.stringify(info));
  // choose a flat build site near spawn
  const site = await E(() => {
    const I = window.__isla, G = I.GRID;
    for (let rr = 14; rr < 300; rr += 3) for (let a = 0; a < 6.28; a += .25) {
      const x = Math.round((I.spawn.x + Math.cos(a) * rr) / 3) * 3, z = Math.round((I.spawn.z + Math.sin(a) * rr) / 3) * 3;
      const hs = []; for (let u = 0; u <= 6; u += 1.5) for (let v = 0; v <= 6; v += 1.5) hs.push(I.terrainH(x + u, z + v));
      if (Math.min(...hs) < 2.5 || Math.max(...hs) - Math.min(...hs) > .8 || I.LAKES.some((L) => Math.hypot(x - L.x, z - L.z) < L.R * 1.7) || I.POIS.some((q) => Math.hypot(x - q.x, z - q.z) < 30)) continue;
      for (const n of I.nodes) if (Math.abs(n.x - x - 3) < 14 && Math.abs(n.z - z - 3) < 14) n.depleted = true;
      return { x, z, top: Math.max(...hs) + .3, bottom: Math.min(...hs) - .6, i0: x / G, j0: z / G };
    }
  });
  console.log('site', JSON.stringify(site));
  const fix = (name) => !only || only.includes(name);
  const setCam = (c) => E((c) => { window.__cam = c; }, c); const noCam = () => E(() => { window.__cam = null; });
  const mid = (n) => (STORY ? [Math.floor(n / 2)] : null); // in story mode render only one frame per scene
  async function scene(name, n, per) { if (!fix(name)) return; console.log('scene', name, n); C.mark && C.mark(name);
    if (STORY) { for (let i = 0; i < n; i++) { await per(i, n, true); await p.evaluate(() => { window.__isla.sim(.05); }); if (i === Math.floor(n * .75)) { await C.grab(p, 50); fs.renameSync(`${C.OUT}/${String(C.getFrame() - 1).padStart(5, '0')}.jpg`, `${C.OUT}/story_${name}.jpg`); } } }
    else { await C.run(p, n, (i, nn) => per(i, nn, false)); } }
  const sx = site.x + 3, sz = site.z + 3;
  // ---- S1 aerial intro
  await E(() => window.__isla.setPhase(.58));
  await scene('aerial', 30, async (i, n) => { const k = i / n, a = 2.2 + k * 1.0, r = 62 - k * 22, y = site.top + 26 - k * 10; await setCam({ x: sx + Math.cos(a) * r, y, z: sz + Math.sin(a) * r, tx: sx, ty: site.top + 3, tz: sz }); });
  // ---- S2 farm: tree then rock
  const farm = await E(() => { const I = window.__isla, p = I.player; const c = (t) => I.nodes.filter((n) => n.type === t && !n.depleted).sort((a, b) => Math.hypot(a.x - I.spawn.x, a.z - I.spawn.z) - Math.hypot(b.x - I.spawn.x, b.z - I.spawn.z))[0]; const tr = c('tree'), ro = c('rock') || c('stone') || c('ore'); return { tr: tr && { x: tr.x, z: tr.z }, ro: ro && { x: ro.x, z: ro.z, t: ro.type } }; });
  console.log('farm', JSON.stringify(farm));
  const equip = (id) => E((id) => { const I = window.__isla; const ix = I.inv.slots.findIndex((s) => s && s.id === id); window.dispatchEvent(new KeyboardEvent('keydown', { key: String(ix + 1), code: 'Digit' + (ix + 1) })); window.dispatchEvent(new KeyboardEvent('keyup', { key: String(ix + 1), code: 'Digit' + (ix + 1) })); }, id);
  const stand = (t, dist, yo) => E(({ t, dist, yo }) => { const I = window.__isla, p = I.player; const a = Math.atan2(t.z - I.spawn.z, t.x - I.spawn.x) + .3; const x = t.x - Math.cos(a) * dist, z = t.z - Math.sin(a) * dist; p.pos.set(x, I.terrainH(x, z) + .05, z); p.vel.set(0, 0, 0); p.hp = 1e5; const dx = t.x - x, dz = t.z - z; p.yaw = Math.atan2(dx, dz) + Math.PI; p.pitch = yo; window.__aimT = t; }, { t, dist, yo });
  await noCam(); await E(() => window.__isla.setPhase(.52));
  if (farm.tr) await scene('tree', 32, async (i) => { if (i === 0) { await equip('stone_axe'); await stand(farm.tr, 2.2, .35); await E(() => { const I = window.__isla; I.press(true); }); } await E(() => { const I = window.__isla, p = I.player, t = window.__aimT; const dx = t.x - p.pos.x, dz = t.z - p.pos.z; p.yaw = Math.atan2(dx, dz) + Math.PI; p.pitch = .3 + Math.sin(performance.now() / 120) * .02; }); });
  await E(() => window.__isla.press(false));
  if (farm.ro) await scene('rock', 24, async (i) => { if (i === 0) { await equip('stone_pick'); await stand(farm.ro, 2.2, .1); await E(() => window.__isla.press(true)); } await E(() => { const I = window.__isla, p = I.player, t = window.__aimT; const dx = t.x - p.pos.x, dz = t.z - p.pos.z; p.yaw = Math.atan2(dx, dz) + Math.PI; p.pitch = .12; }); });
  await E(() => window.__isla.press(false));
  // ---- S3 build
  await E(() => { window.__isla.setPhase(.6); });
  const parts = [];
  for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) parts.push({ kind: 'foundation', key: `F${site.i0 + di},${site.j0 + dj}`, i: site.i0 + di, j: site.j0 + dj });
  [['h', 0, 0], ['h', 1, 0], ['v', 0, 0], ['v', 0, 1], ['v', 2, 0], ['v', 2, 1], ['h', 0, 2], ['h', 1, 2]].forEach(([d, i, j], k) => parts.push({ kind: k === 7 ? 'door' : 'wall', key: `W${d}${site.i0 + i},${site.j0 + j},0`, dir: d, i: site.i0 + i, j: site.j0 + j }));
  for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) parts.push({ kind: 'ceiling', key: `C${site.i0 + di},${site.j0 + dj},0`, i: site.i0 + di, j: site.j0 + dj });
  await scene('build', 56, async (i, n) => { const k = i / n, a = 4.7 + k * 1.3, r = 17 - k * 3.5, y = site.top + 5.6 - k * 2.2; await setCam({ x: sx + Math.cos(a) * r, y, z: sz + Math.sin(a) * r, tx: sx, ty: site.top + 1.5, tz: sz });
    const want = Math.min(parts.length, Math.floor(i / 2.2) + 1); await E(({ parts, want, site }) => { const I = window.__isla; while (window.__built == null) window.__built = 0; const ps = parts; for (; window.__built < want; window.__built++) { I.addPiece(Object.assign({ L: 0, tier: 1, top: site.top, bottom: site.bottom }, ps[window.__built])); } if (want >= ps.length && !window.__furn) { window.__furn = 1; I.addDeployable({ t: 'campfire', x: site.x + 4.5, y: site.top, z: site.z + 5.2, r: 0 }); I.addDeployable({ t: 'chest', x: site.x + 4.8, y: site.top, z: site.z + 3.2, r: 0 }); I.addDeployable({ t: 'torch', x: site.x + 7.6, y: site.top, z: site.z + 7.6, r: 0 }); I.addDeployable({ t: 'torch', x: site.x - 1.6, y: site.top, z: site.z + 7.6, r: 0 }); } }, { parts, want, site }); });
  // ---- S4 fight (first person, dusk)
  await E(() => { window.__cam = null; window.__isla.setPhase(.66); });
  await scene('fight', 64, async (i) => {
    if (i === 0) { await equip('iron_sword'); await E(() => { const I = window.__isla, p = I.player, S = I.spawn; p.pos.set(S.x, I.terrainH(S.x, S.z) + .05, S.z); p.vel.set(0, 0, 0); p.hp = 1e5; p.yaw = S.yaw; I.bots.slice().forEach((b) => I.hurtBot(b, 9999)); const fx = -Math.sin(S.yaw), fz = -Math.cos(S.yaw), rx = -fz, rz = fx; for (const [d, o, t] of [[9, -4, 'raider'], [11, 3, 'raider'], [12, 8, 'archer'], [15, 0, 'brute']]) { const x = S.x + fx * d + rx * o, z = S.z + fz * d + rz * o; const bt = I.spawnBot(t, x, z, 2); bt.aggroT = 99; } }); }
    await E(() => { const I = window.__isla, p = I.player; p.hp = 1e5; let best = null, bd = 1e9; for (const b of I.bots) { const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z); if (d < bd) { bd = d; best = b; } }
      if (!best) { I.press(false); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW' })); return; } const dx = best.pos.x - p.pos.x, dz = best.pos.z - p.pos.z; p.yaw = Math.atan2(dx, dz) + Math.PI; p.pitch = Math.atan2(best.pos.y + 1.1 - (p.pos.y + 1.62), Math.hypot(dx, dz));
      if (bd > 2.6) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW' })); else window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW' })); I.press(bd < 3.4); });
  });
  await E(() => { window.__isla.press(false); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW' })); window.__isla.bots.slice().forEach((b) => window.__isla.hurtBot(b, 9999)); });
  // ---- S5 explosion
  await E(() => window.__isla.setPhase(.7));
  await scene('boom', 64, async (i, n) => { const k = i / n, a = 5.3 + k * .7, r = 13 - k * 3, y = site.top + 2.6 + k * 1.6; await setCam({ x: sx + Math.cos(a) * r, y, z: sz + Math.sin(a) * r, tx: sx + 1, ty: site.top + 1.6, tz: sz + 1 });
    await E(({ i, sx, sz, top, site }) => { const I = window.__isla, T = window.THREE; const boom = (x, z, R) => { I.explode(new T.Vector3(x, top + 1.2, z), R, 300, { noPlayer: true }); window.__shake = 1.4; for (const q of I.pieces.slice()) { const c = q.obj && q.obj.position ? q.obj.position : null; const bb = q.boxes && q.boxes[0]; if (!bb) continue; const cx = (bb.minX + bb.maxX) / 2, cz = (bb.minZ + bb.maxZ) / 2; if (Math.hypot(cx - x, cz - z) < R * .85 && q.kind !== 'foundation') I.destroyPiece(q); } };
      if (i === 2) { for (const [dx, dz, t] of [[-8, -9, 'raider'], [-10, -6, 'sapper'], [-7, -12, 'raider']]) { const b = I.spawnBot(t, sx + dx, sz + dz, 3); b.aggroT = 99; } }
      if (i === 14) boom(site.x + 1.5, site.z + 3.0, 5.5); if (i === 26) boom(site.x + 4.5, site.z + 6.0, 6.5); if (i === 36) boom(site.x + 6, site.z + 2, 5); if (i === 38) { try { I.addDeployable({ t: 'barrel', x: site.x + 4.2, y: top, z: site.z + 4.2, r: 0 }); } catch (e) {} } }, { i, sx, sz, top: site.top, site }); });
  // ---- S6 outro wide
  await E(() => window.__isla.setPhase(.62));
  await scene('outro', 30, async (i, n) => { const k = i / n, a = 5.0 + k * .5, r = 30 + k * 40, y = site.top + 10 + k * 22; await setCam({ x: sx + Math.cos(a) * r, y, z: sz + Math.sin(a) * r, tx: sx, ty: site.top + 2, tz: sz }); });
  console.log('frames', C.getFrame()); await b.close();
})();
