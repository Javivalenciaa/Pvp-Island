// Objetos colocables (cofres, trampas, torretas…): estado, daño y comportamiento autoritativos.
export const DEF = {
  workbench: { hp: 300 }, furnace: { hp: 400 }, campfire: { hp: 150 }, chest: { hp: 700 }, spikes: { hp: 420 }, beartrap: { hp: 120 }, palisade: { hp: 380 },
  ballista: { hp: 260, turret: { range: 28, cd: 1.5, cap: 60, dmg: 48 } }, flamer: { hp: 240, turret: { range: 9.5, cd: .25, cap: 20, dmg: 9 } }, mortar: { hp: 280, turret: { range: 46, min: 12, cd: 4.5, cap: 20, dmg: 115, R: 5 } },
  mine: { hp: 20 }, barrel: { hp: 30 }, torch: { hp: 80 }, bell: { hp: 150 }, bed: { hp: 180 }, garden: { hp: 150 }, collector: { hp: 140 },
};
// daño de cada arma contra objetos
export const DEP_DMG = { fists: 1, stone_axe: 9, stone_pick: 9, spear: 6, hammer: 7, iron_axe: 16, iron_pick: 16, iron_sword: 12 };
export const EXPLOSIONS = { bomb: { R: 4.5, dmg: 150, pm: .5 }, barrel: { R: 5.5, dmg: 220, pm: .7 }, mine: { R: 4, dmg: 170, pm: .2 }, shell: { R: 5, dmg: 115, pm: .1 }, charge: { R: 3.2, dmg: 380, pm: 1.6 } };
export class Deps {
  constructor() { this.map = new Map(); this.next = 1; this.bags = new Map(); this.nextBag = 1; }
  pub(d) { return { id: d.id, t: d.t, x: d.x, y: d.y, z: d.z, r: d.r, hp: Math.round(d.hp), o: d.owner, ammo: d.ammo, armed: d.armed, planted: d.planted, grow: +d.grow.toFixed(2), water: +d.water.toFixed(1), broken: d.broken }; }
  add(t, x, y, z, r, owner) {
    const def = DEF[t]; if (!def) return null; const d = { id: this.next++, t, x, y, z, r: +r || 0, hp: def.hp, maxHp: def.hp, owner, ammo: 0, armed: t === 'beartrap', planted: false, grow: 0, water: 0, broken: false, cd: 0, slots: t === 'chest' ? new Array(24).fill(null) : null, lastHit: 0 };
    this.map.set(d.id, d); return d;
  }
  countOf(tid) { let n = 0; for (const d of this.map.values()) if (d.owner === tid) n++; return n; }
  changeOwner(from, to) { for (const d of this.map.values()) if (d.owner === from) d.owner = to; }
  addBag(x, y, z, slots) { const items = slots.filter((s) => s && s.n > 0).slice(0, 40); if (!items.length) return null; const b = { id: this.nextBag++, x, y, z, slots: items, expire: 0 }; this.bags.set(b.id, b); return b; }
}
