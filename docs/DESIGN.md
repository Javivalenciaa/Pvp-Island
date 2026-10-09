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


## Cuerpo dormido (server/src/room.js: sleep / wake / killSleeper)

- El cliente informa su inventario completo (`invfull`: 24 casillas con durabilidad, armadura, hambre y sed) cada 4 s y al cerrar/ocultar la pestaña. El servidor lo valida (ids ≤24 caracteres, cantidades ≤999) y lo guarda en el jugador.
- Al cerrar la conexión de un humano vivo, `leave()` lo convierte en cuerpo dormido (`sleeping`): sigue en `players` con su `tid` (sus construcciones siguen siendo suyas), se emite `sleep` y aparece en las instantáneas con la bandera `e[8]`. No cuenta para `count/humans` (no ocupa sitio ni cuenta como jugador en línea). Los bots y los animales ignoran los cuerpos dormidos; los demás jugadores pueden golpearlo, dispararle o explotarlo.
- Si muere, `killSleeper` suelta una bolsa con todo (casillas + armadura), lo quita del mapa y guarda un aviso para su dueño. Si el dueño vuelve antes, `join` con el mismo `token` despierta el mismo cuerpo (mismo id) y la bienvenida incluye `restore` (inventario, armadura, hambre, sed, vida) y la posición.
- Un segundo `join` con el mismo token mientras hay otra conexión releva a la anterior. Los tramposos expulsados no dejan cuerpo.
- Persistencia: `sleepers` y `deadSleepers` van en el JSON de la sala; los cuerpos dormidos caducan a las 24 h (se sueltan en una bolsa).


## Asedio y defensa (server/src/room.js, deps.js, buildings.js)

- **C4** (deployable `c4`, 40 de vida, máx. 8 por tribu): se coloca pegada a una pared u objeto; el dueño pulsa **G** y detona todas las suyas a ≤90 m (`det`), con una pequeña cascada de 0,12 s. Usa la explosión `charge` (380 × 1,6 contra piezas, R 3,2): a quemarropa son ~243 contra metal, así que **7 rompen una pared de metal (1500)**, 5 una puerta metálica y 2 una pared de piedra. Quien la golpea antes la **desactiva** (sin explosión).
- **Torretas**: ballesta 650, lanzallamas 520, mortero 750 de vida (antes 260/240/280). Mejora (`dup`, tecla U apuntando): nivel 1 = 30 lingotes + 8 engranajes, nivel 2 = 60 + 16; cada nivel +50 % de munición y +35 % de vida. Si la mejora se rechaza se devuelve el coste.
- **Caja fuerte** (`safe`): 1500 de vida, 48 huecos, los golpes de arma hacen el 3 % (solo la rompen los explosivos: ~7 C4); receta carísima (40 lingotes, 10 engranajes, 60 piedra).
- **Escudo** (item `shield`, clic derecho para alzarlo): reduce un 78 % los golpes, flechas y virotes de torreta que vienen de frente (≤ ~63°); **no** protege de explosiones ni fuego. Se desgasta con cada golpe bloqueado. Los clanes de bots lo usan en raids contra bases con torretas (`ai.shielded`, −70 % sin comprobar ángulo).
- **Rampas** (pieza `ramp`, sobre un cimiento sin techo, 4 direcciones): 7 escalones de 0,46 m que llegan a la altura del techo vecino, para subir a los tejados y construir más pisos.
