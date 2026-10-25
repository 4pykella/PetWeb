# workdays-bot — Telegram-бот графика смен

Отвечает в чате, работает ли человек сегодня/завтра/в любой день по сменному графику, учитывает отпуска.
Самостоятельный проект: всё, что нужно для запуска, лежит в этой папке — от PetWeb он не зависит.

```
bot/
├── index.js            # код бота
├── package.json        # зависимости (node-telegram-bot-api, dotenv, socks-proxy-agent)
├── Dockerfile          # образ на node:20-alpine, без root
├── docker-compose.yml  # запуск + healthcheck + volume для отпусков
└── .env.example        # шаблон настроек (токен и т.д.)
```

---

## Развернуть на новом хосте

Нужен Docker с плагином compose (`docker compose version`).

1. **Скопировать папку** на хост (с ПК, из корня репозитория) — без `node_modules` и локального `.env`:
   ```bash
   tar --exclude=node_modules --exclude=.env -czf - -C bot . | ssh user@HOST "mkdir -p /opt/workdays-bot && tar -xzf - -C /opt/workdays-bot"
   ```
   или на хосте: `git clone https://github.com/4pykella/PetWeb.git && cp -r PetWeb/bot /opt/workdays-bot`.

2. **Настроить**:
   ```bash
   cd /opt/workdays-bot
   cp .env.example .env
   nano .env          # BOT_TOKEN обязателен
   chmod 600 .env
   ```

3. **Запустить**:
   ```bash
   docker compose up -d --build
   ```

4. **Проверить** (через 1–2 минуты):
   ```bash
   docker ps --filter name=workdays-bot     # Up … (healthy)
   docker logs --tail 20 workdays-bot
   ```
   В Telegram: `/health` — аптайм, последняя связь с Telegram, ошибки, прокси.

Обновить после изменений кода: `docker compose up -d --build`.

### Без Docker

```bash
npm ci --omit=dev
cp .env.example .env && nano .env
node index.js
```

---

## Проверка, что бот жив

- Раз в минуту бот вызывает `getMe` и обновляет файл `data/heartbeat`.
- Docker healthcheck: нет успешной связи 3+ минуты → контейнер `unhealthy` (видно в `docker ps`, Portainer, Homepage).
- Ошибки сети пишутся в лог не чаще раза в 5 минут.
- Если `BOT_TOKEN` пустой, контейнер не падает в цикле перезапусков, а висит `unhealthy` с сообщением в логе.

**`EFATAL` / `ETIMEDOUT` в логе** — хост не достаёт до `api.telegram.org` (например, сервер в РФ). Варианты:
- запустить бота на хосте за рубежом (VDS) — проще всего;
- `BOT_PROXY=socks5://…` — прокси на зарубежном сервере;
- `TELEGRAM_API_URL=https://…` — своё зеркало Bot API.

---

## Команды

| Команда | Что делает |
|---------|-----------|
| `/today`, `/status` | статус на сегодня |
| `/tomorrow` | на завтра |
| `/week` | ближайшие 7 дней |
| `/month [ГГГГ-ММ]` | график на месяц + число рабочих смен |
| `/date ГГГГ-ММ-ДД` | на конкретную дату |
| `/next` | ближайшая смена и ближайший выходной |
| `/sun ГГГГ-ММ-ДД ГГГГ-ММ-ДД` | добавить отпуск |
| `/vacations`, `/delvacation N`, `/clearvacations` | управление отпусками |
| `/health` | состояние бота |
| упоминание `PERSON_TAG` | «работает / выходной» прямо сейчас |

## Настройки (`.env`)

| Переменная | По умолчанию | |
|------------|--------------|--|
| `BOT_TOKEN` | — | обязателен |
| `ADMIN_IDS` | пусто (все) | кто может менять отпуска |
| `TZ` | `Europe/Moscow` | часовой пояс |
| `SCHEDULE_START` | `2026-09-04` | первый день цикла |
| `SCHEDULE_PATTERN` | `N,N,O,O,O,D,D,O` | `N` ночь, `D` день, `O` выходной |
| `PERSON_TAG` | `@chepykella` | на чьё упоминание реагировать |
| `BOT_PROXY` | пусто | SOCKS5/HTTP-прокси до Telegram |
| `TELEGRAM_API_URL` | пусто | своё зеркало Bot API |

## Данные и перенос

Отпуска хранятся в volume `bot_data` (`/app/data/vacations.json`).

Перенести со старого хоста:
```bash
# старый хост
docker cp workdays-bot:/app/data/vacations.json ./vacations.json
# новый хост (после первого запуска)
docker cp ./vacations.json workdays-bot:/app/data/vacations.json
docker exec -u 0 workdays-bot chown botuser:botuser /app/data/vacations.json
docker restart workdays-bot
```
