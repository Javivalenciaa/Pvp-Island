# Pvp Island

Juego de supervivencia multijugador PvP para navegador (pensado para CrazyGames), al estilo ARK: tribus, bases, mapas grandes con biomas y cuevas, y animales domables.

- **Servidor** (`server/`): Node.js + WebSockets, autoritativo. Dos salas (una por mapa) de hasta 20 jugadores. Si hay pocos humanos se rellenan con bots que usan el mismo canal que un jugador.
- **Mundo compartido** (`shared/world.js`): terreno, biomas y entradas de cuevas generados por semilla; servidor y clientes generan lo mismo sin enviarlo por red.
- **Cliente** (`client/`): base del juego de un jugador "Iron Island" (Three.js) que se irá adaptando al modo en línea.

## Estado

| Hito | Estado |
|---|---|
| Servidor con salas, tribus, PvP y bots | Hecho (probado, `npm test`) |
| Terreno compartido servidor/cliente (mismo código, `shared/terrain.js`) | Hecho |
| Cliente en línea: menú de salas, nombre y tribu, avatares vikingos con nombre | Hecho (probado con navegador real) |
| PvP: golpes, flechas y ballesta con daño calculado en el servidor, muerte y reaparición | Hecho |
| Anti-trampas básico: posición validada, daño por arma, sin fuego amigo | Hecho |
| Tribus (máx. 3, invitación con clic derecho mantenido) y chat global (`/t` para tribu) | Hecho |
| Construcción, mejora de materiales, puertas y raideo sincronizados por el servidor | Hecho |
| Objetos, trampas, torretas, explosivos, cofres y bolsas de botín en el servidor | Hecho |
| Recursos compartidos, fauna del servidor, domar y montar caballos, día/noche común | Hecho |
| Persistencia en JSON (piezas, objetos, cofres, tribus) y guía de despliegue gratis | Hecho (`docs/DEPLOY.md`) |
| Mapa Cordillera de 960 m, biomas (desierto, pantano, jungla) y punto de aparición en terreno llano | Hecho |
| Cuevas/minas **dentro del mapa**: zanja + túnel + sala talladas en la montaña, se entra andando, se puede construir dentro y encima del techo se camina | Hecho (`test_cave.js` + pruebas en navegador) |
| Clima sincronizado, recolectores de lluvia online, animación de golpes remota, botón de chat e invitar en táctil | Hecho |
| Sin protección al desconectarse: tus construcciones siguen siendo atacables (`test_offline.js`) | Hecho (decisión de diseño) |
| Detector de inventarios inflados (marca y expulsa), prueba de carga (`npm run load`), paquete CrazyGames (`tools/package_crazygames.py`) | Hecho |
| Creador de personaje (piel, ojos, pelo, peinado, barba, casco, ropa, tamaño de cabeza, brazos y complexión): los demás te ven así en multijugador | Hecho (`test_look.js`) |
| Al morir, tus pertenencias y armadura quedan en una bolsa visible con baliza roja y marca de «última muerte» en el mapa (10 min) | Hecho |
| Carga: el menú se pinta antes de generar el mundo; el botón Jugar se activa al terminar | Hecho (el coste real de compilar shaders depende de la GPU) |
| **CrazyGames (Full Implementation)**: SDK completo, entra directo en partida, cuenta y datos en la nube, invitaciones, disableChat/muteAudio, anuncios con respaldo ante AdBlock, filtro de chat, paquete verificado (`docs/CRAZYGAMES.md`, `tools/package_crazygames.py`, `tools/test_cg.js`) | Hecho |
| Bots con comportamiento más humano: ven solo en su campo de visión y oyen de cerca, tardan en reaccionar, rodean y retroceden al pelear, huyen con criterio, talan árboles y minan rocas **reales** del mapa, fabrican hacha/lanza/espada, cazan y se curan (`server/src/bots.js`, `npm run sim`) | Hecho |
| Inventario y crafting con autoridad total del servidor | Pendiente (hoy el cliente manda; solo hay detección de abusos gruesos) |
| Prueba de rendimiento en GPU real con 20 jugadores | Pendiente (el servidor aguanta 20 jugadores con ~1,3 ms por tick) |

Limitaciones conocidas: el inventario/crafting es del cliente (un cliente modificado puede hacer trampa en cantidades pequeñas), el daño parcial a recursos no se sincroniza. `SERVER_URL` en el cliente es un marcador hasta tener dominio.

## Probar el servidor

```
cd server
npm install
npm test        # prueba automática con 2 clientes simulados
npm start       # escucha en el puerto 8080 (PORT para cambiarlo; BOT_TARGETS=isla=6,cordillera=7 = ocupación base por mapa incluyendo bots)
```

Cliente: abre `client/index.html` en el navegador (`?server=ws://localhost:8080`, `?map=cordillera` para el otro mapa, `?offline=1` para jugar solo). Tras tocar `shared/terrain.js`: `python3 tools/sync_terrain.py`.

Diseño completo en [`docs/DESIGN.md`](docs/DESIGN.md).
