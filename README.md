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
| Construcción y raideo sincronizados por el servidor | Siguiente |
| Domar animales y monturas | Pendiente |
| Mapas grandes, biomas nuevos y cuevas/minas como interiores | Pendiente |
| Persistencia (SQLite) y despliegue gratuito | Pendiente |

Por ahora los recursos (árboles, rocas) y los animales son locales en cada cliente, y la construcción está desactivada en línea hasta que el servidor la controle.

## Probar el servidor

```
cd server
npm install
npm test        # prueba automática con 2 clientes simulados
npm start       # escucha en el puerto 8080 (PORT para cambiarlo; MIN_PLAYERS = bots mínimos por sala)
```

Cliente: abre `client/index.html` en el navegador (`?server=ws://localhost:8080`, `?map=cordillera` para el otro mapa, `?offline=1` para jugar solo). Tras tocar `shared/terrain.js`: `python3 tools/sync_terrain.py`.

Diseño completo en [`docs/DESIGN.md`](docs/DESIGN.md).
