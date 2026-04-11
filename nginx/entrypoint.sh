#!/bin/sh

# Генерация самоподписанного сертификата, если он отсутствует
if [ ! -f /etc/nginx/ssl/server.crt ] || [ ! -f /etc/nginx/ssl/server.key ]; then
    echo "Generating self-signed SSL certificate..."
    mkdir -p /etc/nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/server.key \
        -out /etc/nginx/ssl/server.crt \
        -subj "/C=RU/ST=State/L=City/O=Organization/CN=localhost"
fi

exec "$@"