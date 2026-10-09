// Construcción autoritativa: las mismas reglas de apoyo que el cliente, daño por material y derrumbe en cascada.
export const GRID = 3, LEVEL_H = 3.2, WALL_H = 3;
export const PIECE_HP = { foundation: 400, wall: 300, door: 220, ceiling: 250, ramp: 300 };
export const TIER_MULT = [.25, 1, 2.5, 5], TIER_RES = [0, .25, .6, .85], EXP_RES = [0, 0, .35, .6];
// daño de cada arma contra construcciones (antes de la resistencia del material)
export const PIECE_DMG = { fists: 1, stone_axe: 8, stone_pick: 8, spear: 5, hammer: 6, iron_axe: 14, iron_pick: 14, iron_sword: 10 };
const fKey = (i, j) => `F${i},${j}`, wKey = (d, i, j, L) => `W${d}${i},${j},${L}`, cKey = (i, j, L) => `C${i},${j},${L}`;
const edgeCells = (d, i, j) => (d === 'h' ? [[i, j - 1], [i, j]] : [[i - 1, j], [i, j]]);
const cellEdges = (i, j) => [['h', i, j], ['h', i, j + 1], ['v', i, j], ['v', i + 1, j]];
export function pieceCenter(p) {
  if (p.kind === 'foundation') return { x: p.i * GRID + 1.5, y: p.top - 1, z: p.j * GRID + 1.5 };
  if (p.kind === 'ceiling') return { x: p.i * GRID + 1.5, y: p.top + p.L * LEVEL_H + WALL_H, z: p.j * GRID + 1.5 };
  if (p.kind === 'ramp') return { x: p.i * GRID + 1.5, y: p.top + 1.6, z: p.j * GRID + 1.5 };
  const y = p.top + p.L * LEVEL_H + 1.5; return p.dir === 'h' ? { x: p.i * GRID + 1.5, y, z: p.j * GRID } : { x: p.i * GRID, y, z: p.j * GRID + 1.5 };
}
export class Buildings {
  constructor() { this.map = new Map(); }
  get(key) { return this.map.get(key); }
  maxHp(p) { return PIECE_HP[p.kind] * TIER_MULT[p.tier]; }
  pub(p) { return { kind: p.kind, key: p.key, i: p.i, j: p.j, L: p.L, dir: p.dir, tier: p.tier, top: p.top, bottom: p.bottom, hp: Math.round(p.hp), open: p.open, o: p.owner }; }
  wallSupported(w) { const c = edgeCells(w.dir, w.i, w.j); return w.L === 0 ? c.some(([a, b]) => this.map.has(fKey(a, b))) : c.some(([a, b]) => this.map.has(cKey(a, b, w.L - 1))); }
  cellHasWalls(i, j, L) { return cellEdges(i, j).some(([d, a, b]) => this.map.has(wKey(d, a, b, L))); }
  ceilingSupported(c) {
    if (!this.map.has(fKey(c.i, c.j))) return false; if (this.cellHasWalls(c.i, c.j, c.L)) return true;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => this.map.has(cKey(c.i + di, c.j + dj, c.L)) && this.cellHasWalls(c.i + di, c.j + dj, c.L));
  }
  // valida y crea una pieza; devuelve { ok, p } o { ok: false, why }
  place(d, owner, count) {
    const kind = d.kind; if (!PIECE_HP[kind]) return { ok: false, why: 'Pieza no válida' };
    const i = d.i | 0, j = d.j | 0, L = d.L | 0, dir = d.dir === 'v' ? 'v' : 'h';
    if (Math.abs(i) > 400 || Math.abs(j) > 400 || L < 0 || L > 6 || !Number.isFinite(+d.top) || (kind === 'foundation' && !Number.isFinite(+d.bottom))) return { ok: false, why: 'Posición no válida' };
    const key = kind === 'foundation' ? fKey(i, j) : kind === 'ceiling' ? cKey(i, j, L) : kind === 'ramp' ? `R${i},${j}` : wKey(dir, i, j, L);
    if (this.map.has(key)) return { ok: false, why: 'Ya hay una pieza aquí' };
    if (count >= 450) return { ok: false, why: 'Tu tribu ha alcanzado el límite de piezas' };
    const p = { kind, key, i, j, L: kind === 'foundation' ? 0 : L, dir: kind === 'wall' || kind === 'door' ? dir : kind === 'ramp' ? (['n', 's', 'e', 'w'].includes(d.dir) ? d.dir : 'n') : undefined, tier: 0, top: +d.top, bottom: Number.isFinite(+d.bottom) ? +d.bottom : +d.top, open: false, owner };
    if ((kind === 'wall' || kind === 'door') && !this.wallSupported(p)) return { ok: false, why: 'Las paredes van sobre un cimiento' };
    if (kind === 'ceiling' && !this.ceilingSupported(p)) return { ok: false, why: 'El techo va sobre un cimiento con paredes' };
    if (kind === 'ceiling' && this.map.has(`R${i},${j}`)) return { ok: false, why: 'Hay una rampa aquí' };
    if (kind === 'ramp' && (!this.map.has(fKey(i, j)) || this.map.has(cKey(i, j, 0)))) return { ok: false, why: 'La rampa va sobre un cimiento sin techo' };
    if (kind === 'ramp') p.top = this.map.get(fKey(i, j)).top;
    p.hp = this.maxHp(p); this.map.set(key, p); return { ok: true, p };
  }
  // quita una pieza y todo lo que deja de estar sostenido; devuelve las piezas retiradas
  remove(p) {
    const out = [p]; this.map.delete(p.key); let changed = true;
    while (changed) {
      changed = false;
      for (const q of [...this.map.values()]) { if (q.kind === 'foundation') continue; const ok = q.kind === 'ceiling' ? this.ceilingSupported(q) : q.kind === 'ramp' ? this.map.has(fKey(q.i, q.j)) : this.wallSupported(q); if (!ok) { this.map.delete(q.key); out.push(q); changed = true; } }
    }
    return out;
  }
  countOf(tid) { let n = 0; for (const p of this.map.values()) if (p.owner === tid) n++; return n; }
  changeOwner(from, to) { for (const p of this.map.values()) if (p.owner === from) p.owner = to; }
}
