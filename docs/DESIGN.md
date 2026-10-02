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
