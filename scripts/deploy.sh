#!/bin/bash
# deploy.sh — запускается на сервере из CI/CD (GitHub Actions / GitLab CI).
# Ожидает, что проект уже распакован в каталог деплоя.
# .env с паролями живёт ТОЛЬКО на сервере (шаблон — .env.example), CI его не трогает.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: нет $(pwd)/.env — скопируй .env.example в .env и заполни пароли"
  exit 1
fi
# .env, отредактированный на Windows, может прийти с CRLF — символ CR ломает значения
sed -i 's/\r$//' .env
set -a && . ./.env && set +a
DOMAIN="${DOMAIN:-chepykella.ru}"

echo "======================================"
echo " Deploying PetWeb → $(pwd)"
echo "======================================"

echo "[1/4] Validating docker compose..."
docker compose config -q

# code-server работает от CODE_SERVER_UID — отдаём ему файлы проекта,
# чтобы их можно было править прямо в браузере (data/ с сертификатами не трогаем)
find . -mindepth 1 -maxdepth 1 ! -name data ! -name code-server-config \
  -exec chown -R "${CODE_SERVER_UID:-1000}:${CODE_SERVER_GID:-1000}" {} + 2>/dev/null || true
chmod 600 .env

echo "[2/4] Building and starting containers..."
docker compose up -d --build --remove-orphans
# nginx.conf и prometheus.yml смонтированы отдельными файлами: распаковка архива заменяет
# файл (новый inode), и запущенный контейнер видит старую версию — пересоздаём их
docker compose up -d --no-deps --force-recreate nginx prometheus

echo "[3/4] Cleaning dangling images..."
docker image prune -f >/dev/null || true

echo "[4/4] Health check..."
sleep 15
docker compose ps

failed=0
if [ "$(docker inspect -f '{{.State.Running}}' nginx 2>/dev/null)" != "true" ]; then
  echo "ERROR: nginx is not running"
  failed=1
elif ! docker exec nginx wget -q --no-check-certificate -O /dev/null https://127.0.0.1/; then
  echo "ERROR: https://127.0.0.1/ is not responding inside nginx"
  failed=1
fi

# Остальные сервисы — только предупреждение, чтобы упавший бот не ломал сайт
for svc in $(docker compose config --services); do
  state=$(docker compose ps -a --format '{{.State}}' "$svc" 2>/dev/null | head -1)
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
