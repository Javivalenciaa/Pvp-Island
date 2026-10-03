# Despliegue gratis en Oracle Cloud (Always Free)

Resultado: `wss://tu-dominio` sirviendo los dos mapas (20 jugadores cada uno), con HTTPS automático y reinicio automático.

## 1. Crear la VM
Consola de Oracle → Compute → Instances → Create instance:
- **Image:** Ubuntu 22.04 · **Shape:** Ampere (VM.Standard.A1.Flex) con 2 OCPU y 12 GB (entra en Always Free). Si dice "out of capacity", prueba otra hora u otro dominio de disponibilidad.
- Descarga la clave SSH privada que te da. Guarda la **IP pública**.

## 2. Abrir puertos 80 y 443 (hay que hacerlo en dos sitios)
1. Consola: Networking → tu VCN → Security Lists → *Add Ingress Rules*: origen `0.0.0.0/0`, TCP, puerto `80`; y otra para `443`.
2. Dentro de la VM (Ubuntu en Oracle trae iptables cerrado):
```bash
sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
sudo apt install -y iptables-persistent && sudo netfilter-persistent save
```

## 3. Dominio (necesario: CrazyGames exige `wss://`)
Opción gratis: https://www.duckdns.org → crea un subdominio (p. ej. `pvpisland.duckdns.org`) y ponle la IP pública de la VM. Si compras uno, crea un registro **A** a esa IP.

## 4. Instalar en la VM
```bash
ssh -i clave.key ubuntu@IP_DE_LA_VM
# Node 22 (el de apt es demasiado viejo)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs git
# Caddy (HTTPS automático)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
# El juego
sudo useradd -r -s /usr/sbin/nologin pvp
sudo git clone https://github.com/Javivalenciaa/Pvp-Island /opt/pvp-island
cd /opt/pvp-island/server && sudo npm ci --omit=dev && sudo chown -R pvp /opt/pvp-island
sudo cp /opt/pvp-island/deploy/pvp-island.service /etc/systemd/system/
sudo systemctl enable --now pvp-island
# HTTPS: pon TU dominio en el Caddyfile
sudo sed 's/game.tudominio.com/pvpisland.duckdns.org/' /opt/pvp-island/deploy/Caddyfile | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 5. Comprobar
- En la VM: `systemctl status pvp-island` (debe poner *active*) y `journalctl -u pvp-island -f`.
- Desde tu PC: abre `https://pvpisland.duckdns.org` — Caddy responde (aunque sea con una página vacía). Para probar el WebSocket, en la consola del navegador: `new WebSocket('wss://pvpisland.duckdns.org').onopen = () => console.log('OK')`.

## 6. Conectar el juego
En tu PC (con el repo clonado):
```bash
python3 tools/package_crazygames.py wss://pvpisland.duckdns.org
```
Genera `dist/pvp-island-crazygames.zip` para subir a CrazyGames. Para GitHub Pages / pruebas, también puedes poner `?server=wss://pvpisland.duckdns.org` al final de la URL del juego.

## Mantenimiento
- **Actualizar:** `cd /opt/pvp-island && sudo git pull && cd server && sudo npm ci --omit=dev && sudo systemctl restart pvp-island`.
- **Copias:** el estado (construcciones, cofres, tribus) está en `/var/lib/pvp-island`. Copia esa carpeta de vez en cuando.
- **Variables** (en `/etc/systemd/system/pvp-island.service`): `PORT`, `DATA_DIR`, `MIN_PLAYERS` (bots mínimos por mapa; ponlo a `0` si no quieres bots).
- Oracle recupera VMs Always Free **inactivas** (CPU muy baja durante días). Un servidor con jugadores no suele tener problema; si quieres asegurarte, entra de vez en cuando.

Alternativa con Docker: `docker build -f deploy/Dockerfile -t pvp-island .` y `docker run -d --restart=always -p 8080:8080 -v pvp:/data pvp-island` (Caddy igualmente delante).
