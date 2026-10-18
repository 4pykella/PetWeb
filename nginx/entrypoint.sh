#!/bin/sh
# Если сертификата Let's Encrypt ещё нет (DNS-выпуск не удался или первый запуск) —
# генерируем самоподписанный по тому же пути, чтобы nginx всё равно поднялся.

DOMAIN="${DOMAIN:-chepykella.ru}"
LIVE_DIR="/etc/letsencrypt/live/www.${DOMAIN}"

if [ ! -s "$LIVE_DIR/fullchain.pem" ] || [ ! -s "$LIVE_DIR/privkey.pem" ]; then
    echo "[entrypoint] Сертификат не найден — генерирую самоподписанный для *.${DOMAIN}"
    mkdir -p "$LIVE_DIR"
    rm -f "$LIVE_DIR/fullchain.pem" "$LIVE_DIR/privkey.pem"
    openssl req -x509 -nodes -days 30 -newkey rsa:2048 \
        -keyout "$LIVE_DIR/privkey.pem" \
        -out "$LIVE_DIR/fullchain.pem" \
        -subj "/CN=${DOMAIN}" \
        -addext "subjectAltName=DNS:${DOMAIN},DNS:*.${DOMAIN}"
fi

# Периодически перечитываем конфиг, чтобы подхватить продлённый acme.sh сертификат
(
    while :; do
        sleep 6h
        nginx -s reload 2>/dev/null
    done
) &

exec "$@"
