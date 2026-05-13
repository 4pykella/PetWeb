#!/bin/bash
# cert.sh

docker run -it --rm \
  -v $(pwd)/data/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/data/certbot/www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d www.chepykella.ru -d prometheus.chepykella.ru -d prometheus.chepykella.ru -d grafana.chepykella.ru \
  --email DanilMkrtchian@gmail.com --agree-tos --no-eff-email --force-renew