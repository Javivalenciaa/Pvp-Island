// Fondos 3D para la portada: base de madera volando por los aires con vikingos al frente. W/H por entorno; salida en OUT/bg_<nombre>.png
const C = require('./cap.js'); const fs = require('fs');
const NAME = process.env.NAME || 'wide';
(async () => {
  const { b, p } = await C.open(); const E = (f, a) => p.evaluate(f, a);
  await E(() => { document.querySelector('#btnPlay').click(); document.querySelector('[data-q="media"]').click(); });
  await E(() => { const I = window.__isla; const r0 = I.post.render.bind(I.post);
    I.post.render = (t) => { const c = window.__cam; if (c) { let sx = 0, sy = 0, sz = 0; if (window.__shake > 0) { sx = (Math.random() - .5) * window.__shake; sy = (Math.random() - .5) * window.__shake; sz = (Math.random() - .5) * window.__shake; window.__shake *= .88; } I.camera.position.set(c.x + sx, c.y + sy, c.z + sz); I.camera.lookAt(c.tx, c.ty, c.tz); } I.camera.children.forEach((q) => { q.visible = !c; }); r0(t); }; });
  const site = await E(() => { const I = window.__isla, G = I.GRID;
    for (let rr = 14; rr < 300; rr += 3) for (let a = 0; a < 6.28; a += .25) {
      const x = Math.round((I.spawn.x + Math.cos(a) * rr) / 3) * 3, z = Math.round((I.spawn.z + Math.sin(a) * rr) / 3) * 3, hs = [];
      for (let u = 0; u <= 6; u += 1.5) for (let v = 0; v <= 6; v += 1.5) hs.push(I.terrainH(x + u, z + v));
      if (Math.min(...hs) < 2.5 || Math.max(...hs) - Math.min(...hs) > .8 || I.LAKES.some((L) => Math.hypot(x - L.x, z - L.z) < L.R * 1.7) || I.POIS.some((q) => Math.hypot(x - q.x, z - q.z) < 30)) continue;
      for (const n of I.nodes) if (Math.abs(n.x - x - 3) < 16 && Math.abs(n.z - z - 3) < 16) n.depleted = true;
      return { x, z, top: Math.max(...hs) + .3, bottom: Math.min(...hs) - .6, i0: x / G, j0: z / G }; } });
  await E(() => window.__isla.setPhase(.64));  // atardecer dorado
  await E((site) => { const I = window.__isla; const P = [];
    for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) P.push({ kind: 'foundation', key: `F${site.i0 + di},${site.j0 + dj}`, i: site.i0 + di, j: site.j0 + dj });
    [['h', 0, 0], ['h', 1, 0], ['v', 0, 0], ['v', 0, 1], ['v', 2, 0], ['v', 2, 1], ['h', 0, 2], ['h', 1, 2]].forEach(([d, i, j], k) => P.push({ kind: k === 7 ? 'door' : 'wall', key: `W${d}${site.i0 + i},${site.j0 + j},0`, i: site.i0 + i, j: site.j0 + j, dir: d }));
    for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) P.push({ kind: 'ceiling', key: `C${site.i0 + di},${site.j0 + dj},0`, i: site.i0 + di, j: site.j0 + dj });
    for (const q of P) I.addPiece(Object.assign({ L: 0, tier: 1, top: site.top, bottom: site.bottom }, q)); }, site);
  const sx = site.x + 3, sz = site.z + 3, wide = process.env.W / process.env.H > 1.2;
  // cámara baja y cercana: la explosión llena el cuadro, los vikingos al frente
  const cam = wide ? { a: 5.2, r: 12.5, y: site.top + 1.7, ty: site.top + 2.2 } : { a: 5.2, r: 15.5, y: site.top + 1.5, ty: site.top + 3.4 };
  const camAt = (k) => ({ x: sx + Math.cos(cam.a + k) * cam.r, y: cam.y, z: sz + Math.sin(cam.a + k) * cam.r, tx: sx + 1, ty: cam.ty, tz: sz + 1 });
  await E((c) => { window.__cam = c; }, camAt(0));
  // vikingos delante de la cámara
  await E(({ sx, sz, cam, wide }) => { const I = window.__isla, ca = cam.a, rx = Math.cos(ca + Math.PI / 2), rz = Math.sin(ca + Math.PI / 2), fx = -Math.cos(ca), fz = -Math.sin(ca), bx = sx + Math.cos(ca) * (cam.r - 4.6), bz = sz + Math.sin(ca) * (cam.r - 4.6);
    const place = [['sapper', wide ? -2.2 : -1.6, 0], ['raider', wide ? 1.9 : 1.6, -.8]]; window.__guys = [];
    for (const [t, off, dz] of place) { const x = bx + rx * off + fx * dz, z = bz + rz * off + fz * dz, b = I.spawnBot(t, x, z, 3); b.aggroT = 99; window.__guys.push({ b, x, z }); } }, { sx, sz, cam, wide });
  await E(() => { const I = window.__isla; I.bots.forEach((b) => { b.speed = 0; }); });
  const boom = (x, z, R, y) => E(({ x, z, R, y }) => { const I = window.__isla, T = window.THREE; I.explode(new T.Vector3(x, y, z), R, 300, { noPlayer: true }); window.__shake = .5; }, { x, z, R, y });
  const frames = [];
  for (let i = 0; i < 26; i++) {
    await E(() => { const I = window.__isla; for (const g of window.__guys) { g.b.pos.x = g.x; g.b.pos.z = g.z; g.b.pos.y = I.terrainH(g.x, g.z); g.b.vel && g.b.vel.set(0, 0, 0); g.b.hp = 1e5; } });
    if (i === 3) await boom(site.x + 1.5, site.z + 5.2, 5.5, site.top + 1.5); if (i === 6) await boom(site.x + 4.5, site.z + 3, 6, site.top + 2.2); if (i === 10) await boom(site.x + 3, site.z + 1, 6.5, site.top + 1.6);
    await E((c) => { window.__cam = c; window.__isla.sim(.05); }, camAt(i * .0015)); await C.grab(p, 50);
  }
  const png = await E(() => { window.__isla.sim(.02); return window.__isla.renderer.domElement.toDataURL('image/png'); }); fs.writeFileSync(`${C.OUT}/bg_${NAME}.png`, Buffer.from(png.split(',')[1], 'base64'));
  // varios fotogramas para elegir el mejor momento
  for (const k of [6, 9, 12, 16]) { fs.copyFileSync(`${C.OUT}/${String(k).padStart(5, "0")}.jpg`, `${C.OUT}/pick_${NAME}_${k}.jpg`); }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
