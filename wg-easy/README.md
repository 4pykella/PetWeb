# wg-easy — WireGuard с веб-интерфейсом

[wg-easy](https://github.com/wg-easy/wg-easy) v15: создание клиентов в пару кликов, QR-коды для телефона,
скачивание `.conf`, статистика трафика, включение/выключение клиентов, 2FA для админа.
Разворачивается на VDS (например, WireguardKZ), отдельно от PetWeb.

```
wg-easy/
├── docker-compose.yml   # wg-easy + (опционально) Caddy для HTTPS
├── Caddyfile            # конфиг Caddy для профиля https
└── .env.example         # шаблон настроек
```

---

## 1. Подготовка VDS

- Docker с compose: `curl -fsSL https://get.docker.com | sh`
- Открыть в фаерволе: **UDP 51820** (WireGuard). Для профиля https ещё TCP 80 и 443.
- Если на VDS уже работает WireGuard «руками» на том же порту:
  ```bash
  wg show                                  # что сейчас поднято
  cp -r /etc/wireguard ~/wireguard-backup  # бэкап старых конфигов
  systemctl disable --now wg-quick@wg0     # освободить порт
  ```
  Старых клиентов придётся пересоздать в wg-easy (у них будут новые ключи) — или поднять wg-easy на другом порту (`WG_PORT=51830`) и переносить клиентов постепенно.

## 2. Запуск

```bash
scp -r wg-easy root@<VDS>:/opt/wg-easy        # с ПК, из корня репозитория
ssh root@<VDS>
cd /opt/wg-easy
cp .env.example .env && nano .env && chmod 600 .env
docker compose up -d
docker logs -f wg-easy                         # дождаться старта
```

## 3. Вход в веб-интерфейс

**Вариант А — SSH-туннель (по умолчанию, ничего лишнего наружу):**

```bash
ssh -L 51821:127.0.0.1:51821 root@<VDS>
```

и открыть в браузере http://localhost:51821. Логин/пароль — `WG_ADMIN_USER` / `WG_ADMIN_PASSWORD`.

**Вариант Б — HTTPS по домену:**

1. В DNS Selectel A-запись, например `wg` → IP VDS.
2. В `.env`: `WG_UI_DOMAIN=wg.chepykella.ru`, `ACME_EMAIL=…`
3. `docker compose --profile https up -d` — Caddy сам получит и будет продлевать сертификат.
4. Открыть https://wg.chepykella.ru и **сразу включить 2FA** (профиль → Two-Factor).

## 4. После первого входа

- Сотри `WG_ADMIN_PASSWORD` из `.env` — переменные `INIT_*` действуют только при первом запуске, дальше пароль хранится в базе wg-easy.
- Включи 2FA.
- Добавь клиентов: **New Client** → имя → QR-код (телефон) или скачать `.conf` (ПК, роутер OpenWRT).

## 5. Полезное

| Задача | Как |
|--------|-----|
| Обновить | `docker compose pull && docker compose up -d` |
| Бэкап клиентов | `docker run --rm -v wg-easy_etc_wireguard:/v -v $PWD:/b alpine tar czf /b/wg-backup.tgz -C /v .` |
| Логи | `docker logs -f wg-easy` |
| Кто подключён | веб-интерфейс или `docker exec wg-easy wg show` |

## 6. Идеи на будущее

- **Туннель сервер PetWeb ↔ дом.** Создай в wg-easy клиентов `archimedes` и `home-openwrt`; тогда nginx сможет проксировать proxmox/truenas по адресам внутри VPN, и пробросы портов 8006/8443 на домашнем роутере можно закрыть.
- **Telegram-бот** на этом же VDS: Telegram оттуда доступен напрямую, прокси не нужен (см. `bot/README.md`).
- Карточка wg-easy на Homepage: виджет `type: wgeasy` (https://gethomepage.dev/widgets/services/wgeasy/).
