import { createTerrain } from '../../shared/terrain.js';
import { MAPS } from '../../shared/maps.js';
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
for (const [id, mp] of Object.entries(MAPS)) {
  const T = createTerrain({ world: mp.world, seed: mp.seed });
  ok(T.CAVES.length >= 3, id + ': tiene cuevas (' + T.CAVES.length + ')');
  for (const c of T.CAVES) {
    const at = (u, v) => [c.x + c.dx * u - c.dz * v, c.z + c.dz * u + c.dx * v];
    // andando de fuera hacia dentro: el suelo nunca sube más de lo que se puede escalar y acaba plano a la altura y0
    let maxStep = 0, prev = null; for (let u = -6; u <= 16; u += .5) { const [x, z] = at(u, 0), h = T.terrainH(x, z); if (prev !== null) maxStep = Math.max(maxStep, Math.abs(h - prev)); prev = h; }
    const [cx, cz] = at(15, 0); const [tx, tz] = at(u1(c) + 1, 0);
    ok(maxStep < 1.1, `${id} cueva ${c.id}: se entra andando (salto máx. ${maxStep.toFixed(2)} m cada 0,5 m)`);
    ok(Math.abs(T.terrainH(cx, cz) - c.y0) < .05 && Math.abs(T.terrainH(tx, tz) - c.y0) < .05, `${id} cueva ${c.id}: suelo plano dentro`);
    ok(T.roofH(cx, cz) - T.terrainH(cx, cz) >= 3.5, `${id} cueva ${c.id}: techo a ${(T.roofH(cx, cz) - T.terrainH(cx, cz)).toFixed(1)} m de altura`);
    const [wx, wz] = at(15, 9.5); ok(T.terrainH(wx, wz) - c.y0 > 3, `${id} cueva ${c.id}: paredes de roca`);
    ok(!!T.caveInfo(cx, cz) && T.caveInfo(cx, cz).roof, `${id} cueva ${c.id}: caveInfo detecta el interior`);
  }
}
function u1(c) { return c.u1; }
