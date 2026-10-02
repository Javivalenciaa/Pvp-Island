#!/usr/bin/env python3
"""Regenera en client/index.html la región @@terrain a partir de shared/terrain.js y shared/maps.js
(el cliente es un único HTML, así que el código compartido se incrusta)."""
import re, sys, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(root, 'client', 'index.html')
t = open(os.path.join(root, 'shared', 'terrain.js')).read().replace('export function', 'function')
maps = open(os.path.join(root, 'shared', 'maps.js')).read()
m = re.search(r'export const MAPS = (\{.*?\n\});', maps, re.S)
block = f"""// @@terrain-begin (generado por tools/sync_terrain.py desde shared/terrain.js)
{t}
const MAPS = {m.group(1)};
const MAP_ID = (location.search.match(/[?&]map=(\\w+)/) || [])[1] in MAPS ? location.search.match(/[?&]map=(\\w+)/)[1] : 'isla';
const TERRAIN = createTerrain({{ world: MAPS[MAP_ID].world, seed: MAPS[MAP_ID].seed }});
const {{ WORLD, HALF, SEG, N, CELL, MOUNT, MOUNT2, baseHeight, forestAt, LAKES, rawHeight, heights, terrainH, slopeAt, lakeAt, nearLake, biomeAt, BIOMES, CAVES, caveInfo, roofH, heights0, archInfo, archTop, ARCH_W, ARCH_H }} = TERRAIN;
// @@terrain-end"""
s = open(P).read()
if '// @@terrain-begin' in s:
    a = s.index('// @@terrain-begin'); b = s.index('// @@terrain-end') + len('// @@terrain-end'); s = s[:a] + block + s[b:]
else:
    a = s.index('const WORLD = 640, HALF = WORLD / 2, SEG = 320, N = SEG + 1, CELL = WORLD / SEG;')
    e = s.index('const nearLake = '); e = s.index('\n', e)
    s = s[:a] + block + s[e:]
open(P, 'w').write(s); print('terreno sincronizado')
