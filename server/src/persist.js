import fs from 'node:fs';
import path from 'node:path';
// Guardado en JSON por mapa: piezas, objetos, tribus y nodos agotados. Escritura atómica (tmp + rename).
export function snapshotRoom(r) {
  return {
    v: 1, savedAt: Date.now(), nextTribe: r.nextTribe, nextDep: r.D.next,
    tribes: [...r.tribeInfo], tokens: [...r.tribeOfToken], names: [...r.names], deadSleepers: [...r.deadSleepers],
    sleepers: r.sleepers.map((q) => ({ token: q.token, name: q.name, tid: q.tid, x: q.x, y: q.y, z: q.z, yaw: q.yaw, hp: q.hp, look: q.look, held: q.held || '', slots: q.slots || [], armor: q.armor || null, hunger: q.hunger, thirst: q.thirst, bed: q.bed || 0, kills: q.kills || 0, deaths: q.deaths || 0, sleepAt: q.sleepAt })), reports: [...r.reports].map(([k, m]) => [k, [...m.values()]]),
    pieces: [...r.B.map.values()], deps: [...r.D.map.values()].map((d) => ({ ...d, cd: 0 })),
  };
}
export function restoreRoom(r, s) {
  if (!s || s.v !== 1) return false;
  r.nextTribe = s.nextTribe || 1; r.tribeInfo = new Map(s.tribes || []); r.tribeOfToken = new Map(s.tokens || []);
  r.deadSleepers = new Map(s.deadSleepers || []); for (const q of s.sleepers || []) r.addSleeper(q);
  r.names = new Map(s.names || []); r.reports = new Map((s.reports || []).map(([k, l]) => [k, new Map(l.map((e) => [e.who, e]))]));
  for (const p of s.pieces || []) r.B.map.set(p.key, p);
  for (const d of s.deps || []) { r.D.map.set(d.id, d); }
  r.D.next = Math.max(s.nextDep || 1, ...[...r.D.map.keys()].map((k) => k + 1), 1);
  return true;
}
export function saveRoom(r, dir) {
  if (!dir) return; fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, r.mapId + '.json'), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(snapshotRoom(r))); fs.renameSync(tmp, f);
}
export function loadRoom(r, dir) {
  if (!dir) return false; const f = path.join(dir, r.mapId + '.json');
  try { return restoreRoom(r, JSON.parse(fs.readFileSync(f, 'utf8'))); } catch (e) { return false; }
}
