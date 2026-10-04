// regresión: paredes, puertas y techos sin "bottom" (como los envía el cliente) deben aceptarse
import { Buildings } from './buildings.js';
const B = new Buildings(); let bad = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) bad++; };
const top = 5, f = (i, j) => B.place({ kind: 'foundation', i, j, L: 0, top, bottom: 4 }, 1, 0);
ok(f(0, 0).ok && f(1, 0).ok, 'cimientos');
ok(B.place({ kind: 'wall', i: 0, j: 0, dir: 'h', L: 0, top }, 1, 2).ok, 'pared sin bottom');
ok(B.place({ kind: 'door', i: 1, j: 0, dir: 'h', L: 0, top }, 1, 3).ok, 'puerta sin bottom');
ok(B.place({ kind: 'ceiling', i: 0, j: 0, L: 0, top }, 1, 4).ok, 'techo sin bottom');
ok(!B.place({ kind: 'foundation', i: 5, j: 5, L: 0, top }, 1, 0).ok, 'cimiento sin bottom se rechaza');
ok(!B.place({ kind: 'wall', i: 9, j: 9, dir: 'h', L: 0, top }, 1, 0).ok, 'pared sin cimiento se rechaza');
process.exit(bad ? 1 : 0);
