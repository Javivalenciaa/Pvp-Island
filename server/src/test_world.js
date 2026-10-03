import { createTerrain } from '../../shared/terrain.js';
import { buildWorld, nodeDigest } from '../../shared/world.js';
import { MAPS } from '../../shared/maps.js';
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
// Huellas de la lista de recursos tal como la genera el cliente (client/index.html); si el cliente cambia su generación hay que actualizar estas cifras
const CLIENT = { isla: '2309:130168e1', cordillera: '5059:50d05ee1' };
for (const [id, m] of Object.entries(MAPS)) { const W = buildWorld(createTerrain({ world: m.world, seed: m.seed })); ok(nodeDigest(W.nodes) === CLIENT[id], `${id}: los ${W.nodes.length} recursos del servidor coinciden con los del cliente`); }
