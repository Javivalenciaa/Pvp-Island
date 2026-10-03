# Envío a CrazyGames — Pvp-Island

Todo lo técnico está implementado para la **Full Implementation** (que incluye la Basic). Esta es la correspondencia con los requisitos y cómo comprobar cada uno.

## Generar el paquete
```
python3 tools/package_crazygames.py wss://TU-DOMINIO
```
Crea `dist/pvp-island-crazygames.zip` (un único `index.html`, ~290 KB) y **falla** si detecta URLs externas, falta de integración del SDK o tamaño excesivo. Sube ese zip en el Developer Portal (HTML5) y usa su herramienta de *Preview/QA* antes de enviar.

## Requisitos técnicos
| Requisito | Estado | Dónde / cómo se cumple |
|---|---|---|
| Descarga inicial ≤ 50 MB | Cumple | 1,02 MB sin comprimir (el script lo comprueba) |
| Tamaño total ≤ 250 MB, ≤ 1500 archivos | Cumple | 1 archivo |
| SDK y evento `gameplayStart` | Cumple | `gameplayStart/Stop` al jugar, pausar, abrir mochila, escribir en el chat o ver un anuncio |
| Carga | Cumple | `loadingStart` en la cabecera (en cuanto carga el SDK) y `loadingStop` cuando el mundo está listo |
| Aterrizar directamente en la partida | Cumple | Dentro de CrazyGames no hay menú: entra solo (nombre de tu cuenta o `PlayerNNN`, aspecto guardado o aleatorio). Con `?menu=1` se ve el menú |
| Sin servidor, sigue funcionando | Cumple | Si el servidor no responde en 7 s entra en modo un jugador (`?offline=1`) |
| Sin anuncios externos ni enlaces externos | Cumple | El script de empaquetado lo verifica |
| Anuncios por el SDK | Cumple | `requestAd('midgame')` al reaparecer tras morir; el audio y `gameplayStop` se pausan durante el anuncio |
| Funciona con AdBlock | Cumple | Si el anuncio falla (`adError`) o no existe SDK, el juego continúa al instante |
| Cuenta de CrazyGames | Cumple | Nombre y avatar (menú de pausa) con `user.getUser`; escucha cambios de sesión (`addAuthListener`) |
| Progreso ligado a la cuenta | Cumple | Todo el guardado (partida, aspecto, ajustes) pasa por `SDK.data` (nube para usuarios con cuenta, local para invitados) |
| Sin login externo | Cumple | No hay ningún login propio |
| Multijugador: enlace de invitación | Cumple | `showInviteButton({ roomId })` al entrar; el enlace abre la sala indicada (`getInviteParam('roomId')`) |
| Multijugador: flujo instantáneo | Cumple | Entra directo en la sala (sin lobby) |
| Multijugador: preferencia `disableChat` | Cumple | Oculta todo el chat (y no se puede abrir) y reacciona en directo a los cambios |
| Preferencia `muteAudio` | Cumple | Suspende el audio y lo respeta tras anuncios |
| `happytime` | Cumple | Al completar objetivos y retos (máx. 1 por minuto) |
| PEGI 12 | Cumple | Violencia fantástica de baja intensidad, sin gore realista, sin lenguaje fuerte (filtro de insultos en chat y apodos), sin alcohol, drogas, juego ni contenido sexual |
| Privacidad / consentimiento | Cumple | Aviso la primera vez que se juega en línea («apodo, aspecto y mensajes») y botón *Privacidad* en la pausa |
| Móvil | Cumple | Controles táctiles (joystick, golpe, usar, agacharse, invitar, chat) |
| Ratón (mouse lock) | Cumple | Pide un clic para capturar el ratón («Haz clic para jugar»); `Esc` pausa |

## Ficha del juego (para el formulario)
**Título:** Pvp-Island

**Descripción corta:** Survive on a wild island, build a base with friends and raid your rivals — up to 20 players per server.

**Descripción:**
You wake up on a beach with nothing. Gather wood and stone, hunt, tame horses, build a fortress, craft weapons and explosives — and defend it from other players. Team up with up to 2 friends in a tribe (hold right‑click on a player to invite them), explore deserts, jungles, swamps and mountain caves, loot ancient ruins and shipwrecks, and raid enemy bases. Customize your character before you jump in; everyone sees how you look. Nothing is safe when you log off: build smart.

**Controles:**
- WASD — mover · Shift — correr · C — agacharse · Espacio — saltar
- Clic izquierdo — golpear / disparar · Clic derecho (mantener sobre un jugador) — invitar a tribu
- E — usar/recoger/domar/montar · F — montar/desmontar · B — construir · Tab — mochila y fabricación
- M — mapa · Enter — chat (`/t` para tu tribu) · 1–6 — barra rápida
- Móvil: joystick izquierdo, botones HIT / USE / CROUCH / BUILD / BAG / MAP / INVITE / CHAT

**Etiquetas sugeridas:** survival, multiplayer, io, building, pvp, sandbox, open world, crafting, 3D.
**Categoría:** Multiplayer / Adventure.
**Idiomas:** English, Español (se elige por el idioma del navegador y en la pausa).

## Lo que depende de ti
1. Servidor en marcha con HTTPS (`docs/DEPLOY.md`) y su dominio en el comando de empaquetado.
2. Portadas: las generadas en `docs/covers/` (revisa en el formulario las medidas exactas que piden).
3. Antes de enviar, prueba el zip con la herramienta *Preview* del Developer Portal y revisa la sección de QA.
4. Si CrazyGames te pide un enlace a política de privacidad propia, el texto del aviso está en el juego (botón *Privacidad*) y en `docs/PRIVACIDAD.md`.
