#!/usr/bin/env python3
"""Genera dist/pvp-island-crazygames.zip listo para subir a CrazyGames y comprueba los requisitos técnicos.
Uso: python3 tools/package_crazygames.py wss://game.tudominio.com
El cliente es un único index.html; el servidor de juego se aloja aparte (docs/DEPLOY.md)."""
import sys, os, re, zipfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = sys.argv[1] if len(sys.argv) > 1 else None
if not url or not re.match(r'^wss://[A-Za-z0-9.-]+(:\d+)?(/.*)?$', url):
    sys.exit('Indica la URL segura del servidor: python3 tools/package_crazygames.py wss://game.tudominio.com')
html = open(os.path.join(root, 'client', 'index.html'), encoding='utf8').read()
html, n = re.subn(r"wss://pvp-island\.example\.com", url, html)
if n == 0: sys.exit('No se encontró el marcador SERVER_URL en el cliente')
problems, notes = [], []
# --- requisitos técnicos de CrazyGames (Basic + Full)
ext = sorted(set(re.findall(r'https?://[A-Za-z0-9./_?=&%-]+', html)))
allowed = ('https://sdk.crazygames.com/', 'http://www.w3.org/1999/xhtml')
for u in ext:
    if not u.startswith(allowed): problems.append('URL externa no permitida: ' + u)
if 'sdk.crazygames.com/crazygames-sdk-v3.js' not in html: problems.append('Falta el script del SDK de CrazyGames')
for needle, why in [('loadingStart', 'loadingStart/loadingStop'), ('gameplayStart', 'gameplayStart/gameplayStop'), ('requestAd', 'anuncios por el SDK'), ('getUser', 'cuenta de CrazyGames'), ('showInviteButton', 'enlace de invitación'), ('disableChat', 'preferencia disableChat'), ('muteAudio', 'preferencia muteAudio'), ('happytime', 'happytime'), ('.data', 'datos en la nube del SDK')]:
    if needle not in html: problems.append('Falta en el cliente: ' + why)
if re.search(r'<a\s[^>]*href=["\']https?:', html): problems.append('Hay enlaces externos en el HTML')
if re.search(r'(googletag|adsbygoogle|doubleclick|facebook\.com|twitter\.com|discord\.gg)', html): problems.append('Referencias a anuncios o redes externas')
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
out = os.path.join(root, 'dist', 'pvp-island-crazygames.zip')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z: z.writestr('index.html', html)
total = len(html.encode('utf8')); zsize = os.path.getsize(out)
notes.append(f'tamaño sin comprimir {total/1048576:.2f} MB (límite de descarga inicial 50 MB), zip {zsize/1024:.0f} KB, 1 archivo (límite 1500)')
if total > 50 * 1048576: problems.append('La descarga inicial supera 50 MB')
print(f'{out}\n  servidor de juego: {url}')
for x in notes: print('  OK  ' + x)
if problems:
    print('PROBLEMAS:'); [print('  - ' + p) for p in problems]; sys.exit(1)
print('  OK  sin URLs externas salvo el SDK, SDK integrado (loading, gameplay, anuncios, cuenta, datos, invitaciones, ajustes)')
