#!/bin/bash
# deploy.sh — применить текущую версию проекта на сервере.
# /opt/petweb — git-клон репозитория. Обновление вручную:  git pull && bash scripts/deploy.sh
# (CI делает то же самое: git fetch + reset --hard origin/main + этот скрипт).
# .env с паролями живёт ТОЛЬКО на сервере (шаблон — .env.example), в git его нет.
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

# Дерево Miki (files.json) и плейлист — генерируемые файлы, в git их нет
bash scripts/regen.sh >/dev/null 2>&1 || echo "WARN: не удалось обновить files.json / playlist.json (scripts/regen.sh)"

# code-server работает от CODE_SERVER_UID — отдаём ему файлы проекта (вместе с .git и самим
# каталогом, чтобы git работал и в терминале code-server); data/ с сертификатами не трогаем
OWNER="${CODE_SERVER_UID:-1000}:${CODE_SERVER_GID:-1000}"
chown "$OWNER" . 2>/dev/null || true
find . -mindepth 1 -maxdepth 1 ! -name data ! -name code-server-config \
  -exec chown -R "$OWNER" {} + 2>/dev/null || true
chmod 600 .env
# root работает с репозиторием другого владельца — разрешаем явно
git config --global --get-all safe.directory 2>/dev/null | grep -qx "$(pwd)" \
  || git config --global --add safe.directory "$(pwd)"

echo "[2/4] Building and starting containers..."
docker compose up -d --build --remove-orphans
# nginx.conf и prometheus.yml смонтированы отдельными файлами: git checkout заменяет
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
