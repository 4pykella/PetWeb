#!/bin/bash
# cert.sh — выпуск SSL-сертификата Let's Encrypt через DNS-01 (wildcard).
#
# Режимы:
#   ./cert.sh            — авто: acme.sh + API DNS-провайдера (используется в CI/CD)
#   ./cert.sh manual     — ручной: certbot --manual, TXT-записи добавляются руками
#
# Авто-режим читает настройки из .env (или из переменных окружения):
#   DOMAIN             — основной домен (по умолчанию chepykella.ru)
#   ACME_EMAIL         — почта для Let's Encrypt
#   ACME_DNS_PROVIDER  — плагин acme.sh: dns_selectel, dns_regru, dns_cf, ...
#                        список: https://github.com/acmesh-official/acme.sh/wiki/dnsapi
#   secrets/acme.env   — файл с ключами API провайдера (KEY=VALUE построчно)
#
# Сертификат кладётся туда же, где его ждёт nginx:
#   data/certbot/conf/live/www.$DOMAIN/{fullchain,privkey}.pem
#
# Скрипт НИКОГДА не роняет деплой: если выпустить сертификат не удалось,
# он завершится с кодом 0, а nginx поднимется на старом или самоподписанном сертификате.

set -u
cd "$(dirname "$0")"

[ -f .env ] && set -a && . ./.env && set +a

DOMAIN="${DOMAIN:-chepykella.ru}"
ACME_EMAIL="${ACME_EMAIL:-DanilMkrtchian@gmail.com}"
ACME_DNS_PROVIDER="${ACME_DNS_PROVIDER:-}"
ACME_ENV_FILE="${ACME_ENV_FILE:-secrets/acme.env}"

CERT_ROOT="$(pwd)/data/certbot/conf"
LIVE_DIR="$CERT_ROOT/live/www.$DOMAIN"
ACME_HOME="$(pwd)/data/acme"

log()  { echo "[cert] $*"; }
warn() { echo "[cert] WARN: $*" >&2; }

manual() {
  docker run -it --rm \
    -v "$CERT_ROOT":/etc/letsencrypt \
    certbot/certbot certonly --manual --preferred-challenges dns \
    --cert-name "www.$DOMAIN" \
    -d "$DOMAIN" -d "*.$DOMAIN" \
    --email "$ACME_EMAIL" --agree-tos --no-eff-email
}

auto() {
  if [ -z "$ACME_DNS_PROVIDER" ] || [ ! -s "$ACME_ENV_FILE" ]; then
    warn "ACME_DNS_PROVIDER или $ACME_ENV_FILE не заданы — пропускаю выпуск сертификата"
    return 1
  fi

  mkdir -p "$ACME_HOME" "$LIVE_DIR"

  acme() {
    docker run --rm \
      -v "$ACME_HOME":/acme.sh \
      -v "$CERT_ROOT":/certs \
      --env-file "$ACME_ENV_FILE" \
      neilpang/acme.sh "$@"
  }

  acme --register-account -m "$ACME_EMAIL" --server letsencrypt >/dev/null 2>&1 || true

  log "Выпуск *.$DOMAIN через $ACME_DNS_PROVIDER ..."
  acme --issue --server letsencrypt --dns "$ACME_DNS_PROVIDER" \
       -d "$DOMAIN" -d "*.$DOMAIN" --keylength 2048
  rc=$?
  # 0 — выпущен, 2 — ещё действителен, продление не требуется
  if [ $rc -ne 0 ] && [ $rc -ne 2 ]; then
    warn "acme.sh завершился с кодом $rc"
    return 1
  fi

  # старые файлы certbot — симлинки в archive/, заменяем обычными файлами
  rm -f "$LIVE_DIR/fullchain.pem" "$LIVE_DIR/privkey.pem" 2>/dev/null || true

  acme --install-cert -d "$DOMAIN" \
       --fullchain-file "/certs/live/www.$DOMAIN/fullchain.pem" \
       --key-file       "/certs/live/www.$DOMAIN/privkey.pem" || return 1

  log "Сертификат установлен в $LIVE_DIR"
}

case "${1:-auto}" in
  manual) manual ;;
  auto)
    if ! auto; then
      if [ -s "$LIVE_DIR/fullchain.pem" ]; then
        warn "оставляю существующий сертификат"
      else
        warn "сертификата нет — nginx сгенерирует самоподписанный при старте"
      fi
    fi
    exit 0
    ;;
  *) echo "usage: $0 [auto|manual]"; exit 1 ;;
esac
