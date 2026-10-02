// Terreno determinista por semilla: servidor y clientes generan exactamente lo mismo (sin enviar el mapa por red).
// Con seed = 0 y world = 640 es idéntico al mapa del juego de un jugador.
export function createTerrain({ world = 640, seed = 0, maxLakes = 4 } = {}) {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash2(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
  function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  function fbm(x, y, o) { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f + i * 17.3, y * f - i * 9.1); n += a; a *= .5; f *= 2.03; } return s / n; }
  const WORLD = world, HALF = WORLD / 2, SEG = Math.round(WORLD / 2), N = SEG + 1, CELL = WORLD / SEG, K = WORLD / 640;
  const so = seed ? ((seed * 7.31) % 997) : 0, sr = mulberry32(seed || 1);
  let MOUNT = { x: 95 * K, z: -75 * K }, MOUNT2 = { x: -125 * K, z: -120 * K };
  if (seed) { const a = sr() * 6.283, b = a + 2 + sr() * 2; MOUNT = { x: Math.cos(a) * HALF * .3, z: Math.sin(a) * HALF * .3 }; MOUNT2 = { x: Math.cos(b) * HALF * .38, z: Math.sin(b) * HALF * .38 }; }
  function baseHeight(x, z) {
    const r = Math.hypot(x, z * 1.1) / HALF;
    const coast = (fbm(x * .0075 + 3 + so, z * .0075 + 7 + so, 4) - .5) * .3;
    const mask = 1 - smooth(.52, .94, r + coast);
    const base = fbm(x * .006 + so, z * .006 + so, 5);
    const hills = Math.pow(base, 2.1) * 32;
    const ridge = 1 - Math.abs(fbm(x * .013 + 11 + so, z * .013 - 4 + so, 4) * 2 - 1);
    const m1 = Math.exp(-((x - MOUNT.x) ** 2 + (z - MOUNT.z) ** 2) / (2 * 62 * 62 * K * K)) * 44 * (.45 + .55 * ridge * ridge);
    const m2 = Math.exp(-((x - MOUNT2.x) ** 2 + (z - MOUNT2.z) ** 2) / (2 * 48 * 48 * K * K)) * 30 * (.5 + .5 * ridge);
    return (2.2 + hills + m1 + m2) * mask - 7 * (1 - mask);
  }
  const forestBase = (x, z) => smooth(.42, .64, fbm(x * .011 + 40 + so, z * .011 + so, 3));
  const LAKES = [];
  {
    const rng = mulberry32(777 + (seed | 0));
    const spots = [[2.25, .5], [-2.3, .42], [.95, .45], [-.9, .55], [3.0, .3], [1.6, .6], [-1.5, .62], [0.2, .35], [-3.0, .55]];
    for (const [ang, rr] of spots) {
      if (LAKES.length >= maxLakes) break;
      let best = null;
      for (let t = 0; t < 300; t++) {
        const a = ang + (rng() - .5) * .6, r = HALF * (rr + (rng() - .5) * .15), x = Math.cos(a) * r, z = Math.sin(a) * r, h = baseHeight(x, z);
        if (h < 3.5 || h > 11) continue;
        const sl = Math.hypot(baseHeight(x + 8, z) - baseHeight(x - 8, z), baseHeight(x, z + 8) - baseHeight(x, z - 8)) / 16;
        if (!best || sl < best.sl) best = { x, z, sl, h };
      }
      if (best && best.sl < .25 && !LAKES.some((L) => Math.hypot(L.x - best.x, L.z - best.z) < 70)) LAKES.push({ x: best.x, z: best.z, R: 13 + rng() * 6, level: best.h - .4 });
    }
  }
  function rawHeight(x, z) {
    let h = baseHeight(x, z);
    for (const L of LAKES) {
      const d = Math.hypot(x - L.x, z - L.z);
      if (d > L.R * 1.45) continue;
      if (d < L.R) h = Math.min(h, L.level + .02 - 3.2 * (1 - (d / L.R) ** 2));
      else if (d < L.R * 1.12) h = Math.max(h, L.level + .02 + .6 * smooth(L.R, L.R * 1.12, d));
      else h = Math.max(h, lerp(L.level + .62, h, smooth(L.R * 1.12, L.R * 1.45, d)));
    }
    return h;
  }
  const heights = new Float32Array(N * N);
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) heights[iz * N + ix] = rawHeight(-HALF + ix * CELL, -HALF + iz * CELL);
  function terrainH(x, z) {
    const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    if (fx < 0 || fz < 0 || fx >= SEG || fz >= SEG) return -8;
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * N + ix;
    return lerp(lerp(heights[i], heights[i + 1], tx), lerp(heights[i + N], heights[i + N + 1], tx), tz);
  }
  // biomas: desierto (seco, casi sin árboles), pantano (bajo y húmedo) y jungla (arbolado denso). Manchas con centro fijo por semilla.
  const BIOMES = [];
  {
    const rng = mulberry32(5150 + (seed | 0)), big = WORLD > 800;
    const want = [['desert', .3], ['jungle', .26], ['swamp', .28], ...(big ? [['jungle', .2], ['desert', .2]] : [])];
    for (const [type, rr] of want) {
      let best = null;
      for (let t = 0; t < 400; t++) {
        const a = rng() * 6.283, r = HALF * (.18 + rng() * .5), x = Math.cos(a) * r, z = Math.sin(a) * r, R = HALF * rr * (.85 + rng() * .3);
        if (BIOMES.some((q) => Math.hypot(q.x - x, q.z - z) < (q.R + R) * .85) || Math.hypot(x - MOUNT.x, z - MOUNT.z) < 40 * K || Math.hypot(x - MOUNT2.x, z - MOUNT2.z) < 40 * K) continue;
        let land = 0; for (let k = 0; k < 24; k++) { const aa = k / 24 * 6.283, h = baseHeight(x + Math.cos(aa) * R * .6, z + Math.sin(aa) * R * .6); if (h > 1.8 && h < 12) land++; }
        if (!best || land > best.land) best = { type, x, z, R, land };
      }
      if (best && best.land >= 8) BIOMES.push(best);
    }
  }
  const biomeAt = (x, z) => {
    const h = terrainH(x, z), n = fbm(x * .02 + 9 + so, z * .02 - 5 + so, 3) - .5, out = { desert: 0, swamp: 0, jungle: 0 };
    for (const q of BIOMES) { const d = Math.hypot(x - q.x, z - q.z) / q.R + n * .55; out[q.type] = Math.max(out[q.type], 1 - smooth(.62, 1.0, d)); }
    out.desert *= (1 - smooth(13, 19, h)) * smooth(1.2, 2.4, h);
    out.swamp *= (1 - smooth(8, 12, h)) * smooth(.8, 1.8, h) * (1 - out.desert);
    out.jungle *= (1 - out.desert) * (1 - out.swamp) * smooth(1.8, 3.5, h) * (1 - smooth(15, 21, h));
    return out;
  };
  // cuevas/minas: boca en la ladera de una montaña; el interior es una sala aparte, fuera del mapa (se entra con un teletransporte validado por el servidor)
  const CAVES = [];
  {
    const rng = mulberry32(8080 + (seed | 0)), want = WORLD > 800 ? 5 : 3;
    for (let t = 0; t < 6000 && CAVES.length < want; t++) {
      const Mt = rng() < .55 ? MOUNT : MOUNT2, a = rng() * 6.283, r = (10 + rng() * 55) * K, x = Mt.x + Math.cos(a) * r, z = Mt.z + Math.sin(a) * r, h = terrainH(x, z);
      if (h < 9 || h > 34 || Math.abs(x) > HALF * .9 || Math.abs(z) > HALF * .9) continue;
      const gx = (terrainH(x + 1.5, z) - terrainH(x - 1.5, z)) / 3, gz = (terrainH(x, z + 1.5) - terrainH(x, z - 1.5)) / 3, sl = Math.hypot(gx, gz);
      if (sl < .35 || sl > 1.2 || CAVES.some((c) => Math.hypot(c.x - x, c.z - z) < 80 * K) || LAKES.some((L) => Math.hypot(x - L.x, z - L.z) < L.R * 2)) continue;
      const id = CAVES.length, dx = -gx / sl, dz = -gz / sl;
      CAVES.push({ id, x, z, y: h, dx, dz, ex: x + dx * 3.2, ez: z + dz * 3.2, in: { x: HALF + 300 + id * 400, y: -40, z: 0, R: 13, H: 5.5 } });
    }
  }
  const forestAt = (x, z) => { const b = biomeAt(x, z); return Math.min(1, forestBase(x, z) * (1 - b.desert * .95) + b.jungle * .9 + b.swamp * .25); };
  const slopeAt = (x, z) => Math.hypot(terrainH(x + 1, z) - terrainH(x - 1, z), terrainH(x, z + 1) - terrainH(x, z - 1)) / 2;
  const lakeAt = (x, z) => { for (const L of LAKES) if ((x - L.x) ** 2 + (z - L.z) ** 2 < L.R * L.R) return L; return null; };
  const nearLake = (x, z, f) => LAKES.some((L) => Math.hypot(x - L.x, z - L.z) < L.R * f);
  return { WORLD, HALF, SEG, N, CELL, MOUNT, MOUNT2, baseHeight, forestAt, LAKES, rawHeight, heights, terrainH, slopeAt, lakeAt, nearLake, biomeAt, BIOMES, CAVES };
}
