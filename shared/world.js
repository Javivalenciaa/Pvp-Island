// Posición de los recursos del mundo (árboles, rocas, vetas...) y puntos de interés. Es una copia EXACTA de la generación del cliente
// (client/index.html): el id de un recurso es su posición en `nodes`, y servidor y clientes tienen que coincidir. Lo comprueba server/src/test_world.js.
import { createTerrain } from './terrain.js';
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
const DIR_NAMES = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
const dirName = (x, z) => DIR_NAMES[Math.round(((Math.atan2(x, -z) * 180 / Math.PI + 360) % 360) / 45) % 8];
export function buildWorld(T) {
  const { WORLD, HALF, MOUNT, MOUNT2, CAVES, terrainH, slopeAt, nearLake, forestAt, biomeAt } = T;
  const SPAWN = (() => {
    for (let a = 2.3; a < 2.3 + Math.PI * 2; a += .05) for (let r = HALF * .95; r > 20; r -= 1.5) {
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = terrainH(x, z);
      if (h > 1.4) { const ix = x - Math.cos(a) * 6, iz = z - Math.sin(a) * 6; if (terrainH(ix, iz) > 1.6 && slopeAt(ix, iz) < .35) return { x: ix, z: iz }; break; }
    }
    return { x: 0, z: 0 };
  })();
  const POIS = [];
  {
    const rng = mulberry32(4040), AR = Math.max(1, Math.round((WORLD / 640) ** 2));
    for (const [type, want] of [['lighthouse', 1], ['ruins', 3 * AR], ['camp', 2 * AR], ['obelisk', 2 * AR], ['circle', 2 * AR], ['tower', AR + 1], ['wreck', 2 * AR]]) {
      let placed = 0;
      for (let t = 0; t < 5000 && placed < want; t++) {
        let x, z;
        if (type === 'lighthouse') { const a = rng() * 6.283; let r = HALF * .97; while (r > 60 && terrainH(Math.cos(a) * r, Math.sin(a) * r) < 3.2) r -= 2; x = Math.cos(a) * (r - 4); z = Math.sin(a) * (r - 4); }
        else if (type === 'wreck') { const a = rng() * 6.283; let r = HALF * .98; while (r > 60 && terrainH(Math.cos(a) * r, Math.sin(a) * r) < 1.1) r -= 1.5; x = Math.cos(a) * r; z = Math.sin(a) * r; if (terrainH(x, z) > 3 || slopeAt(x, z) > .35 || POIS.some((q) => Math.hypot(q.x - x, q.z - z) < 90)) continue; POIS.push({ type, x, z, y: terrainH(x, z), r: 8, name: 'Naufragio del ' + dirName(x, z) }); placed++; continue; }
        else { x = (rng() * 2 - 1) * HALF * .78; z = (rng() * 2 - 1) * HALF * .78; }
        const h = terrainH(x, z), R = type === 'lighthouse' ? 4 : 7;
        if (h < 2.6 || h > 18 || slopeAt(x, z) > .3 || nearLake(x, z, 1.8) || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 70) continue;
        let flat = true; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; if (Math.abs(terrainH(x + Math.cos(a) * R, z + Math.sin(a) * R) - h) > (type === 'lighthouse' ? 2.2 : 1.5)) flat = false; }
        if (!flat || POIS.some((q) => Math.hypot(q.x - x, q.z - z) < (type === 'ruins' || type === 'camp' || type === 'lighthouse' ? 110 : 75))) continue;
        POIS.push({ type, x, z, y: h, r: type === 'lighthouse' ? 6 : 10, name: type }); placed++;
      }
    }
  }
  const nodes = [], grid = new Map(), GC = 10, gkey = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  const gridAdd = (n) => { const k = gkey(Math.floor(n.x / GC), Math.floor(n.z / GC)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(n); };
  const near = (x, z, r) => { const out = [], c0 = Math.floor((x - r) / GC), c1 = Math.floor((x + r) / GC), d0 = Math.floor((z - r) / GC), d1 = Math.floor((z + r) / GC); for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) { const a = grid.get(gkey(cx, cz)); if (a) for (const n of a) out.push(n); } return out; };
  const rng = mulberry32(1337), AREA = (WORLD / 640) ** 2, KM = WORLD / 640;
  const plan = [['ore', 95], ['sulfur', 70], ['rock', 330], ['tree', 760], ['appletree', 100], ['bush', 340], ['berry', 160]].map(([t, c]) => [t, Math.round(c * (t === 'ore' || t === 'sulfur' ? Math.min(AREA, 1.6) : AREA))]);
  plan.push(['tree', Math.round(520 * AREA), 'jungle'], ['rock', Math.round(120 * AREA), 'desert'], ['bush', Math.round(120 * AREA), 'swamp']);
  const ok = (type, x, z, mode) => {
    const h = terrainH(x, z), s = slopeAt(x, z);
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 5 || nearLake(x, z, 1.15) || POIS.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + 3)) return false;
    if (CAVES.some((c) => Math.hypot(x - (c.x + c.dx * 12), z - (c.z + c.dz * 12)) < 24)) return false;
    if ((type === 'appletree' || type === 'berry') && biomeAt(x, z).desert > .35) return false;
    if (type === 'appletree') return h > 1.8 && h < 13 && s < .45;
    if (type === 'berry') return h > 1.3 && h < 14 && s < .5;
    if (mode === 'jungle') return h > 1.8 && h < 20 && s < .5 && biomeAt(x, z).jungle > .45;
    if (mode === 'desert') return h > 1.5 && s < .6 && biomeAt(x, z).desert > .5;
    if (mode === 'swamp') return h > .9 && s < .4 && biomeAt(x, z).swamp > .4;
    if (type === 'tree') return h > 1.8 && h < 25 && s < .55 && (forestAt(x, z) > .3 || hash2(x * 3 | 0, z * 3 | 0) < .05);
    if (type === 'bush') return h > 1.3 && h < 15 && s < .5;
    if (type === 'rock') return h > .9 && h < 26 && s < .9;
    if (type === 'ore') return h > 13 && s < 1.1;
    if (type === 'sulfur') return h > 11 && s < 1.1;
  };
  const free = (x, z, d) => { for (const n of near(x, z, d)) if ((n.x - x) ** 2 + (n.z - z) ** 2 < d * d) return false; return true; };
  const addNode = (type, x, z, yy) => { rng(); rng(); rng(); const n = { type, x, z, y: yy !== undefined ? yy : terrainH(x, z) }; nodes.push(n); gridAdd(n); return n; };
  for (const [type, count, mode] of plan) {
    let placed = 0;
    for (let t = 0; t < count * 40 && placed < count; t++) {
      let x, z;
      if (type === 'ore' || type === 'sulfur') { const M2 = (type === 'sulfur' ? rng() < .6 : rng() < .3) ? MOUNT2 : MOUNT, a = rng() * 6.283, r = Math.sqrt(rng()) * (M2 === MOUNT ? 85 : 60) * KM; x = M2.x + Math.cos(a) * r; z = M2.z + Math.sin(a) * r; }
      else { x = (rng() * 2 - 1) * HALF * .92; z = (rng() * 2 - 1) * HALF * .92; }
      if (!ok(type, x, z, mode) || !free(x, z, mode === 'jungle' ? 2.3 : type === 'bush' || type === 'berry' ? 2.2 : 3.2)) continue;
      addNode(type, x, z); placed++;
    }
  }
  for (const c of CAVES) for (const [type, cnt] of [['ore', 5], ['sulfur', 3], ['rock', 4]]) for (let k = 0; k < cnt; k++) { const a = rng() * 6.283, r = 1.6 + rng() * 4.4, u = 15 + Math.cos(a) * r, v = Math.sin(a) * r; addNode(type, c.x + c.dx * u - c.dz * v, c.z + c.dz * u + c.dx * v); }
  const guarantee = [['tree', 5, 9, 22], ['rock', 3, 8, 20], ['bush', 3, 6, 16], ['berry', 2, 6, 18], ['appletree', 1, 10, 26]];
  for (const [type, want, rmin, rmax] of guarantee) {
    let have = 0; for (const n of near(SPAWN.x, SPAWN.z, rmax)) if (n.type === type && Math.hypot(n.x - SPAWN.x, n.z - SPAWN.z) < rmax) have++;
    for (let t = 0; t < 400 && have < want; t++) {
      const a = rng() * 6.283, r = rmin + rng() * (rmax - rmin), x = SPAWN.x + Math.cos(a) * r, z = SPAWN.z + Math.sin(a) * r;
      if (terrainH(x, z) > 1.2 && slopeAt(x, z) < .6 && !nearLake(x, z, 1.15) && free(x, z, 3)) { addNode(type, x, z); have++; }
    }
  }
  return { SPAWN, POIS, nodes };
}
export const nodeDigest = (nodes) => { let h = 2166136261; for (const n of nodes) { for (const v of [n.x, n.z, n.y]) { h = Math.imul(h ^ Math.round(v * 100), 16777619) >>> 0; } for (let i = 0; i < n.type.length; i++) h = Math.imul(h ^ n.type.charCodeAt(i), 16777619) >>> 0; } return nodes.length + ':' + h.toString(16); };
