// Apariencia del personaje: se valida en el servidor para que nadie envíe valores raros
const D = { skin: '#dcae8c', hair: '#5a3a1f', eye: '#3a5a8a', cloth: '#8a2f26', trim: '#d9c9a0', pants: '#4b3623' };
const hexOk = (h, d) => (typeof h === 'string' && /^#[0-9a-fA-F]{6}$/.test(h) ? h : d);
const num = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
export function cleanLook(l) {
  if (!l || typeof l !== 'object') return null;
  return { skin: hexOk(l.skin, D.skin), hair: hexOk(l.hair, D.hair), eye: hexOk(l.eye, D.eye), cloth: hexOk(l.cloth, D.cloth), trim: hexOk(l.trim, D.trim), pants: hexOk(l.pants, D.pants),
    hairStyle: [0, 1, 2, 3, 4, 5].includes(l.hairStyle | 0) ? l.hairStyle | 0 : 0, beard: l.beard !== false && l.beard !== 0, helm: ['none', 'cone', 'horn', 'band', 'goggles', 'hood'].includes(l.helm) ? l.helm : 'none',
    head: num(l.head, .8, 1.3, 1), arms: num(l.arms, .85, 1.2, 1), thick: num(l.thick, .7, 1.4, 1), height: num(l.height, .9, 1.12, 1), build: num(l.build, .85, 1.25, 1) };
}
const pk = (a) => a[(Math.random() * a.length) | 0], r = (a, b) => a + Math.random() * (b - a);
export function randomLook() {
  return cleanLook({ skin: pk(['#f1cdb0', '#dcae8c', '#c98f6b', '#a86c4a', '#7d4e35', '#553524']), hair: pk(['#d2a24c', '#a0471f', '#5a3a1f', '#251c14', '#d8d1be', '#7a2f2a']), eye: pk(['#3a5a8a', '#4f7a3a', '#6a4a2a', '#222']), cloth: pk(['#8a2f26', '#2f4c78', '#3f5a38', '#6b4a2e', '#6d6a63', '#2c2a28', '#a8782a']), pants: pk(['#4b3623', '#2c2a28', '#3f5a38']),
    hairStyle: (Math.random() * 6) | 0, beard: Math.random() < .6, helm: pk(['none', 'cone', 'horn', 'band', 'hood']), head: r(.9, 1.12), arms: r(.93, 1.08), thick: r(.85, 1.15), height: r(.95, 1.05), build: r(.92, 1.12) });
}
