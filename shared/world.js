// Mundo determinista por semilla: servidor y clientes generan el mismo terreno sin enviarlo por red.
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = (x, y, s) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; };
function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, y, s, o = 4) { let t = 0, a = .5, f = 1, n = 0; for (let i = 0; i < o; i++) { t += a * vnoise(x * f, y * f, s + i * 31); n += a; a *= .5; f *= 2.03; } return t / n; }
export const MAPS = {
  isla: { name: 'Isla del Hierro', seed: 1337, size: 2000, sea: 0, cave: 3 },
  cordillera: { name: 'Cordillera Helada', seed: 90210, size: 2400, sea: 0, cave: 4 },
};
// altura: isla con costa suave, cordilleras y valles; los lagos son depresiones fijas
export function heightAt(map, x, z) {
  const h = map.size / 2, r = Math.hypot(x, z) / h, s = map.seed;
  const base = fbm(x / 420, z / 420, s, 5), ridge = 1 - Math.abs(fbm(x / 260 + 50, z / 260 - 20, s + 7, 4) * 2 - 1);
  const mount = Math.max(0, fbm(x / 700 + 9, z / 700 + 4, s + 3, 3) - .45) * 2.2;
  let y = (base - .42) * 26 + ridge * mount * 70;
  y -= Math.pow(Math.max(0, r - .72) / .28, 1.6) * 60;
  return y;
}
export function biomeAt(map, x, z) {
  const y = heightAt(map, x, z), t = fbm(x / 600 + 100, z / 600, map.seed + 11, 3), m = fbm(x / 380 - 40, z / 380 + 70, map.seed + 19, 3);
  if (y < map.sea - .3) return 'agua'; if (y < map.sea + 1.6) return 'playa'; if (y > 46) return 'nieve'; if (y > 30) return 'montana';
  if (m > .62) return 'pantano'; if (t > .6) return 'desierto'; return m < .42 ? 'bosque_denso' : 'pradera';
}
// entradas a cuevas y minas: posiciones deterministas en laderas de montaña
export function caveEntrances(map) {
  const r = mulberry32(map.seed ^ 0xCAFE), out = []; let tries = 0;
  while (out.length < map.cave && tries++ < 4000) { const x = (r() - .5) * map.size * .8, z = (r() - .5) * map.size * .8, y = heightAt(map, x, z); if (y > 14 && y < 40 && out.every((o) => Math.hypot(o.x - x, o.z - z) > 260)) out.push({ id: out.length, x, z, y, kind: out.length % 2 ? 'mina' : 'cueva' }); }
  return out;
}
export const DT = 1 / 20;
