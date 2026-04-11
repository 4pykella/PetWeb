#!/bin/bash

set -e  # Остановка при любой ошибке

echo "📁 Создание директорий..."
mkdir -p data/certbot/{conf,www}
mkdir -p html

echo "🚀 Запуск Nginx для верификации..."
docker compose up -d nginx

echo "⏳ Ожидание запуска Nginx..."
sleep 5

echo "🔐 Получение SSL сертификата..."
docker compose run --rm certbot

echo "🔄 Перезапуск Nginx с SSL..."
docker compose restart nginx

echo "📊 Запуск Grafana и Prometheus..."
docker compose up -d grafana prometheus

echo ""
echo "✅ SSL сертификаты получены и сервисы запущены!"
echo ""
echo "📌 Доступные сервисы:"
echo "   🏠 Главная: https://chepykella.ru"
echo "   📊 Grafana: https://chepykella.ru/grafana (admin/admin)"
echo "   📈 Prometheus: https://chepykella.ru/prometheus"