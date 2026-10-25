#!/bin/bash
# cert.sh

docker run -it --rm \
   -v $(pwd)/data/certbot/conf:/etc/letsencrypt \
   -v $(pwd)/data/certbot/www:/var/www/certbot \
   certbot/certbot certonly --manual --preferred-challenges dns --force-renew \
   -d www.chepykella.ru \
   -d chepykella.ru \
   -d grafana.chepykella.ru \
   -d prometheus.chepykella.ru \
   -d portainer.chepykella.ru \
   -d home.chepykella.ru \
   -d proxmox.chepykella.ru \
   -d truenas.chepykella.ru \
   -d code.chepykella.ru \
   -d openwrt.chepykella.ru \
   -d cloud.chepykella.ru \
   --email DanilMkrtchian@gmail.com --agree-tos --no-eff-email
