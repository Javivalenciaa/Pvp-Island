# Pvp Island

Juego de supervivencia multijugador PvP para navegador (pensado para CrazyGames), al estilo ARK: tribus, bases, mapas grandes con biomas y cuevas, y animales domables.

- **Servidor** (`server/`): Node.js + WebSockets, autoritativo. Dos salas (una por mapa) de hasta 20 jugadores. Si hay pocos humanos se rellenan con bots que usan el mismo canal que un jugador.
- **Mundo compartido** (`shared/world.js`): terreno, biomas y entradas de cuevas generados por semilla; servidor y clientes generan lo mismo sin enviarlo por red.
- **Cliente** (`client/`): base del juego de un jugador "Iron Island" (Three.js) que se irá adaptando al modo en línea.

## Estado

| Hito | Estado |
|---|---|
| Servidor con salas, tribus, movimiento, PvP y bots | Hecho (probado, `npm test`) |
| Mundo por semilla con biomas y cuevas | Hecho (versión inicial) |
| Cliente conectado al servidor (jugadores y bots visibles) | Siguiente |
| Construcción y raideo en servidor | Pendiente |
| Domar animales y monturas | Pendiente |
| Cuevas/minas como interiores | Pendiente |
| Persistencia y despliegue | Pendiente |

## Probar el servidor

```
cd server
npm install
npm test        # prueba automática con 2 clientes simulados
npm start       # escucha en el puerto 8080 (PORT para cambiarlo)
```

Diseño completo en [`docs/DESIGN.md`](docs/DESIGN.md).
