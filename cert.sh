#!/bin/bash
# cert.sh — ручной выпуск wildcard-сертификата Let's Encrypt (*.chepykella.ru)
#
# Запускать на сервере из каталога проекта:  ./cert.sh
# certbot покажет TXT-записи _acme-challenge — их нужно добавить в DNS (панель Selectel),
# дождаться обновления и нажать Enter. Сертификат действует 90 дней — повторить до истечения.
#
# Сертификат кладётся туда, где его ждёт nginx:
#   data/certbot/conf/live/www.$DOMAIN/{fullchain,privkey}.pem
# После выпуска:  docker compose restart nginx

set -eu
cd "$(dirname "$0")"

[ -f .env ] && set -a && . ./.env && set +a

DOMAIN="${DOMAIN:-chepykella.ru}"
EMAIL="${CERT_EMAIL:-DanilMkrtchian@gmail.com}"
CONF="$(pwd)/data/certbot/conf"

# Самоподписанная заглушка от nginx лежит в live/ без renewal-конфига —
# certbot с ней не уживается («live directory exists»), удаляем её
if [ -d "$CONF/live/www.$DOMAIN" ] && [ ! -f "$CONF/renewal/www.$DOMAIN.conf" ]; then
  rm -rf "$CONF/live/www.$DOMAIN"
fi

docker run -it --rm \
  -v "$CONF":/etc/letsencrypt \
  certbot/certbot certonly --manual --preferred-challenges dns \
  --cert-name "www.$DOMAIN" \
  -d "$DOMAIN" -d "*.$DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email
