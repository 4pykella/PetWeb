#!/bin/bash
# deploy.sh — запускается на сервере из CI/CD (GitHub Actions / GitLab CI).
# Ожидает, что проект уже распакован в каталог деплоя, а .env и secrets/ положены рядом.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] && set -a && . ./.env && set +a
DOMAIN="${DOMAIN:-chepykella.ru}"

echo "======================================"
echo " Deploying PetWeb → $(pwd)"
echo "======================================"

echo "[1/5] Validating docker compose..."
docker compose config -q

echo "[2/5] SSL certificate (DNS-01)..."
chmod +x ./cert.sh
# cert.sh не роняет деплой: при ошибке остаётся старый / самоподписанный сертификат
./cert.sh auto || echo "WARN: cert.sh failed, continue without new certificate"

echo "[3/5] Building and starting containers..."
docker compose up -d --build --remove-orphans

echo "[4/5] Cleaning dangling images..."
docker image prune -f >/dev/null || true

echo "[5/5] Health check..."
sleep 15
docker compose ps

failed=0
if [ "$(docker inspect -f '{{.State.Running}}' nginx 2>/dev/null)" != "true" ]; then
  echo "ERROR: nginx is not running"
  failed=1
elif ! docker exec nginx wget -q --no-check-certificate -O /dev/null https://localhost/; then
  echo "ERROR: https://localhost/ is not responding inside nginx"
  failed=1
fi

# Остальные сервисы — только предупреждение, чтобы упавший бот не ломал сайт
for svc in $(docker compose ps --services); do
  state=$(docker compose ps --format '{{.State}}' "$svc" 2>/dev/null | head -1)
  if [ "$state" != "running" ]; then
    echo "WARN: service '$svc' state: ${state:-not created}"
  fi
done

# Информация о сертификате
docker exec nginx sh -c "openssl x509 -noout -subject -issuer -enddate \
  -in /etc/letsencrypt/live/www.$DOMAIN/fullchain.pem" 2>/dev/null || true

if [ $failed -ne 0 ]; then
  docker compose logs --tail=100 nginx
  echo "======================================"
  echo " Deployment FAILED"
  echo "======================================"
  exit 1
fi

echo "======================================"
echo " Deployment successful"
echo "======================================"
