#!/usr/bin/env python3
"""Genera dist/pvp-island-crazygames.zip con el cliente listo para subir a CrazyGames.
Uso: python3 tools/package_crazygames.py wss://game.tudominio.com
(el cliente es un único index.html; el servidor de juego se aloja aparte, ver docs/DEPLOY.md)"""
import sys, os, zipfile, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = sys.argv[1] if len(sys.argv) > 1 else None
if not url or not url.startswith('wss://'):
    sys.exit('Indica la URL segura del servidor: python3 tools/package_crazygames.py wss://game.tudominio.com')
html = open(os.path.join(root, 'client', 'index.html'), encoding='utf8').read()
html, n = re.subn(r"wss://pvp-island\.example\.com", url, html)
if n == 0: sys.exit('No se encontró el marcador SERVER_URL en el cliente')
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
out = os.path.join(root, 'dist', 'pvp-island-crazygames.zip')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z: z.writestr('index.html', html)
print(f'{out} ({os.path.getsize(out)/1024:.0f} KB) → servidor {url}')
