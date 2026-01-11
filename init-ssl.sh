#!/bin/bash

# Создаем структуру директорий
mkdir -p data/certbot/conf data/certbot/www html

# Запускаем nginx без SSL конфига
echo "Создаем временный nginx.conf без SSL..."
cat > nginx-temp.conf << 'EOF'
events {
    worker_connections 1024;
}
http {
    server {
        listen 80;
        server_name chepykella.ru www.chepykella.ru;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            root /var/www/html;
        }
    }
}
EOF

# Запускаем временный контейнер nginx
echo "Запускаем временный nginx для получения сертификатов..."
docker run --rm -d \
  --name nginx-temp \
  -v $(pwd)/nginx-temp.conf:/etc/nginx/nginx.conf:ro \
  -v $(pwd)/data/certbot/www:/var/www/certbot:rw \
  -v $(pwd)/html:/var/www/html:ro \
  -p 80:80 \
  nginx:alpine

# Ждем запуска nginx
sleep 5

# Получаем сертификаты
echo "Получаем SSL сертификаты от Let's Encrypt..."
docker run --rm \
  -v $(pwd)/data/certbot/conf:/etc/letsencrypt:rw \
  -v $(pwd)/data/certbot/www:/var/www/certbot:rw \
  certbot/certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email admin@chepykella.ru \
  --agree-tos --no-eff-email \
  --force-renewal \
  -d chepykella.ru \
  -d www.chepykella.ru

# Останавливаем временный nginx
docker stop nginx-temp

# Проверяем сертификаты
echo "Проверяем полученные сертификаты..."
if [ -d "data/certbot/conf/live/chepykella.ru" ]; then
    echo "✅ Сертификаты успешно получены!"
    ls -la data/certbot/conf/live/chepykella.ru/
else
    echo "❌ Не удалось получить сертификаты"
    exit 1
fi

# Запускаем основной docker-compose
echo "Запускаем основную систему..."
docker-compose down
docker-compose up -d

echo "✅ Система запущена!"
echo "📌 Доступные сервисы:"
echo "   - https://chepykella.ru"
echo "   - https://chepykella.ru/grafana"
echo "   - https://chepykella.ru/prometheus"