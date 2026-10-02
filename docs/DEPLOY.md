# Despliegue gratis (Oracle Cloud Always Free)

1. Crea una VM **Ampere A1** (Ubuntu 22.04, 2 OCPU / 12 GB basta) en Oracle Cloud Always Free. Abre los puertos 80 y 443 (Security List + `sudo iptables`/`ufw`).
2. Dominio: uno gratis (DuckDNS) o barato apuntado a la IP de la VM. CrazyGames exige `wss://`, así que hace falta HTTPS.
3. En la VM:
   ```bash
   sudo apt install -y nodejs npm caddy git
   sudo useradd -r pvp; sudo git clone https://github.com/Javivalenciaa/Pvp-Island /opt/pvp-island
   cd /opt/pvp-island/server && sudo npm ci --omit=dev
   sudo cp /opt/pvp-island/deploy/pvp-island.service /etc/systemd/system/
   sudo systemctl enable --now pvp-island
   sudo cp /opt/pvp-island/deploy/Caddyfile /etc/caddy/Caddyfile   # edita el dominio
   sudo systemctl reload caddy
   ```
4. En `client/index.html` cambia `SERVER_URL` (`wss://pvp-island.example.com`) por `wss://game.tudominio.com`.
5. El estado (construcciones, cofres, tribus) se guarda cada 30 s y al parar en `DATA_DIR` (`/var/lib/pvp-island/<mapa>.json`). Haz copia de esa carpeta.

Alternativa: `docker build -f deploy/Dockerfile -t pvp-island .` y `docker run -p 8080:8080 -v pvp:/data pvp-island`.

Variables: `PORT`, `DATA_DIR`, `MIN_PLAYERS` (bots hasta ese total por mapa).
