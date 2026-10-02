import { heightAt } from '../../shared/world.js';
// Los bots usan exactamente el mismo canal que un jugador: solo mandan "input" y "attack", sin ver información oculta.
const NAMES = ['Ragnar', 'Freya', 'Bjorn', 'Astrid', 'Ulf', 'Sigrid', 'Leif', 'Ingrid', 'Thor', 'Helga', 'Erik', 'Gudrun'];
export function brain(room, p) {
  const b = p.ai || (p.ai = { wx: p.x, wz: p.z, think: 0, react: 0, flee: 0 });
  b.think -= 1 / 20; b.react -= 1 / 20;
  // enemigo más cercano a la vista (radio limitado, con tiempo de reacción humano)
  let tgt = null, td = 45; for (const q of room.players.values()) { if (q === p || q.dead > 0 || q.tribe === p.tribe) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < td) { td = d; tgt = q; } }
  if (p.hp < 30 && tgt) b.flee = 3;
  let gx, gz, mode = 'wander';
  if (b.flee > 0) { b.flee -= 1 / 20; mode = 'flee'; gx = p.x + (p.x - tgt.x); gz = p.z + (p.z - tgt.z); }
  else if (tgt && b.react <= 0) { mode = 'chase'; gx = tgt.x; gz = tgt.z; }
  else if (tgt) { gx = p.x; gz = p.z; }
  else { if (b.think <= 0 || Math.hypot(b.wx - p.x, b.wz - p.z) < 3) { b.think = 6 + Math.random() * 8; const a = Math.random() * 6.283, r = 20 + Math.random() * 60; b.wx = p.x + Math.cos(a) * r; b.wz = p.z + Math.sin(a) * r; } gx = b.wx; gz = b.wz; }
  const dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz);
  if (d > .5) { p.yaw = Math.atan2(-dx, -dz); p.input.mx = 0; p.input.mz = mode === 'chase' && d < 1.8 ? 0 : 1; p.input.sprint = mode !== 'wander' && d > 6; } else { p.input.mz = 0; p.input.sprint = false; }
  p.input.jump = Math.random() < .01;
  if (mode === 'chase' && d < 2.3 && Math.random() < .35) room.attack(p);
}
export const botName = (i) => NAMES[i % NAMES.length];
