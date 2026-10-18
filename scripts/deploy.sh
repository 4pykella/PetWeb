#!/bin/bash
# deploy.sh — запускается на сервере из CI/CD (GitHub Actions / GitLab CI).
# Ожидает, что проект уже распакован в каталог деплоя, а .env положен рядом.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] && set -a && . ./.env && set +a
DOMAIN="${DOMAIN:-chepykella.ru}"

echo "======================================"
echo " Deploying PetWeb → $(pwd)"
echo "======================================"

echo "[1/4] Validating docker compose..."
docker compose config -q

echo "[2/4] Building and starting containers..."
docker compose up -d --build --remove-orphans

echo "[3/4] Cleaning dangling images..."
docker image prune -f >/dev/null || true

echo "[4/4] Health check..."
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

# Информация о сертификате (выпускается вручную: ./cert.sh)
if [ -f "data/certbot/conf/renewal/www.$DOMAIN.conf" ]; then
  docker exec nginx sh -c "openssl x509 -noout -subject -enddate \
    -in /etc/letsencrypt/live/www.$DOMAIN/fullchain.pem" 2>/dev/null || true
else
  echo "WARN: сертификат самоподписанный — выпусти настоящий: ./cert.sh && docker compose restart nginx"
fi

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
