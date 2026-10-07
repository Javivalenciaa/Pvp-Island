# Diseño

## Servidores y mapas
- Dos servidores de hasta 20 jugadores: **Isla del Hierro** (2000 m, costa, bosques y lagos) y **Cordillera Helada** (2400 m, montañas y nieve).
- Biomas: pradera, bosque denso, pantano, desierto, playa, montaña y nieve. Lagos y ríos como depresiones del terreno.
- Cuevas y minas: entradas deterministas en las laderas. El interior es una **zona separada** (mapa interior) a la que se entra por una puerta; el motor de alturas no admite túneles.

## Tribus
- Hasta 5 por tribu; en una sala de 20 caben unas 4. Base, cofres y puertas compartidas, sin fuego amigo, chat de tribu y marcadores en el mapa. Invitación por código.
- Los bots forman tribus como cualquier jugador.

## Bots
- Mismo canal que un jugador (solo `input` y `attack`); no ven información oculta.
- IA por capas: necesidades, recolectar, construir, combatir y huir con poca vida; tiempo de reacción humano y fallos de puntería.
- Los bots dejan sitio a los humanos y vuelven a entrar al salir alguien (mínimo configurable, 8 por defecto).

## Domar animales
- Domar con comida y paciencia (barra de doma); el animal se enfada si lo golpeas.
- Caballos (monturas rápidas), lobos (combate), osos (carga). Silla fabricable. Los animales domados defienden la base.

## Evitar bases imposibles de romper
- Coste de destruir menor que coste de construir; piezas se deterioran sin mantenimiento; límite de piezas y de nivel de material.
- Las puertas son el punto débil obligatorio; explosivos por niveles; derrumbe en cascada.
- Caja fuerte: el raideo roba solo una parte del botín del cofre principal.
- Protección de jugadores nuevos y ventanas de asedio.

## Servidor autoritativo
- 20 ticks/s; el cliente envía órdenes y predice su movimiento; snapshots solo de lo cercano (radio 160 m).
- Alojamiento gratuito recomendado: Oracle Cloud Always Free + Cloudflare/Caddy para `wss://`.

## Hoja de ruta
1. Cliente conectado: ver jugadores y bots, mapa por semilla en el cliente.
2. Construcción, cofres y raideo en el servidor.
3. Domar animales y monturas.
4. Interiores de cuevas y minas.
5. Persistencia (SQLite), reglas de equilibrio y despliegue.


## Bases de bots, clanes y raids (server/src/botbase.js)

- **Clanes:** los bots se agrupan en tribus fijas `tb0…tb7` de hasta 3 (nombre «Clan <Nombre>»). Los ids son estables, así que una base sigue siendo del clan aunque cambien los bots, y se guarda en disco con el resto de la sala (`tribeInfo.base/pool`).
- **Arranque en frío:** `createServer({ bases: true })` siembra una base completa por clan (con arcón, cama, banco, hoguera, estacas y botín) separadas ≥120 m, para que desde el primer minuto haya algo que ver y raidear. Después los bots las mantienen.
- **Construcción:** plano determinista (2×2 o 3×2 cimientos, perímetro de paredes, puerta, techo). Usa `Buildings.place` y las mismas reglas que un jugador; paga con la reserva del clan y lo que lleva cada bot. Mejora paredes y puerta a madera y luego a piedra; repara lo dañado y reconstruye lo que falta. El arcón es un espejo de la reserva del clan: lo que se roba es lo que de verdad había.
- **Movimiento:** los bots suben a los cimientos, abren su puerta al acercarse y no atraviesan paredes (solo ellos; los humanos colisionan en el cliente).
- **Raids:** cuando un clan tiene ≥1 bomba (4 azufre + 2 fibra + 4 madera) o 2 bots con lanza/hierro y pasa el enfriamiento (6 min), elige una base conocida (se conocen al pasar a <90 m o por tener a los suyos cerca); las bases de **jugadores solo se atacan si hay alguien del equipo conectado** (puede verlo y defenderse). Fases: reunirse a ~30 m → lanzar bombas a la puerta/pared más débil (con arco visible) → golpear con el arma → destruir el arcón → recoger el botín y llevarlo a casa. Quien defiende (bots del clan a <90 m) reacciona al primer golpe.
- **Aviso al dueño:** `alert` (primer golpe, throttled 25 s), `ev` global (feed), `report` al volver si estaba desconectado (solo para clanes de jugadores).
- **PvP físico más suave:** `skill` 0,42–0,68, reacción 0,7–1,5 s, menos ganas de pelear y cadencia de golpes más lenta: son buenos economía/construcción, no en el cuerpo a cuerpo.
- **Pruebas:** `npm run bases` (simulación sin red de N minutos), `src/test_raid.js` (defensa, botín, informe), `tools/test_online_ui.js` (navegador real contra servidor local).
