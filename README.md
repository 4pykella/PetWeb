# PetWeb

[![CI/CD](https://github.com/4pykella/PetWeb/actions/workflows/github-actions.yaml/badge.svg)](https://github.com/4pykella/PetWeb/actions/workflows/github-actions.yaml)

Сайт-визитка, личная вики (**Miki**), дашборд HomeLab и набор сервисов на одном сервере — всё в Docker Compose за nginx, с автодеплоем из git и wildcard-сертификатом Let's Encrypt по DNS.

🌐 https://www.chepykella.ru · 📖 [Miki](https://www.chepykella.ru/miki/) · 🏠 [Homepage](https://home.chepykella.ru)

---

## 📋 Содержание

- [Описание](#описание)
- [Архитектура](#архитектура)
- [Технологии](#технологии)
- [Структура репозитория](#структура-репозитория)
- [CI/CD](#cicd)
- [SSL по DNS](#ssl-по-dns)
- [Telegram-бот графика](#telegram-бот-графика)
- [Miki](#miki)
- [Локальный запуск](#локальный-запуск)
- [Roadmap](#roadmap)
- [Контрибьютинг](#контрибьютинг)

---

## Описание

PetWeb — мой пет-проект: сайт-визитка и замена Obsidian в одном лице. Хотелось развернуть свой сайт на облачном сервере с автоматическим деплоем, а Obsidian стал неудобен — платная синхронизация и привязка к устройству.

Часть визуала сделана с помощью вайбкодинга, а деплой, получение сертификатов, мониторинг и инфраструктура — своими руками от A до Я. Проект постепенно растёт в полноценный HomeLab: Proxmox, TrueNAS, OpenWRT, а следующий шаг — кластер Kubernetes на нескольких нодах (см. [роадмап](html/miki/docs/roadmap.md)).

---

## Архитектура

```
 git push ──► GitHub Actions / GitLab CI
                 │  validate → build images → files.json для Miki
                 ▼
              SSH deploy ──► /opt/petweb на сервере
                 │  .env и ключи DNS из секретов
                 │  cert.sh: acme.sh DNS-01 → *.chepykella.ru (при ошибке — деплой продолжается)
                 ▼
         docker compose up -d --build  +  health-check

 ┌──────────────────────────── сервер (Docker Compose) ────────────────────────────┐
 │  nginx :80/:443 ── www / chepykella.ru ─► статический сайт + Miki               │
 │     │            ├─ grafana.*     ─► Grafana                                     │
 │     │            ├─ prometheus.*  ─► Prometheus ◄── node-exporter, nginx-exporter│
 │     │            ├─ home.*        ─► Homepage (дашборд HomeLab)                  │
 │     │            ├─ code.*        ─► code-server                                 │
 │     │            ├─ /portainer    ─► Portainer                                   │
 │     │            └─ proxmox.* / truenas.* / openwrt.* ─► HomeLab по WireGuard/IP │
 │  acme (acme.sh daemon) — продление сертификата                                   │
 │  workdays-bot — Telegram-бот графика смен                                        │
 └──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Технологии

| Область | Что используется |
|---------|------------------|
| **Контейнеризация** | Docker, Docker Compose, multi-stage / non-root образы |
| **Веб и прокси** | Nginx (reverse proxy, HTTP/2, TLS 1.2/1.3), статический HTML/CSS/JS |
| **CI/CD** | GitHub Actions, GitLab CI (`.gitlab-ci.yml`), деплой по SSH, health-check |
| **TLS** | Let's Encrypt, acme.sh, DNS-01, wildcard `*.chepykella.ru`, самоподписанный фолбэк |
| **Мониторинг** | Prometheus, Grafana, Node Exporter, Nginx Prometheus Exporter |
| **Сервисы** | Portainer, Homepage, code-server |
| **Бот** | Node.js 20, node-telegram-bot-api |
| **Miki** | HTML/CSS/JS, marked, highlight.js, генерация дерева `files.json` |
| **HomeLab** | Proxmox VE, TrueNAS, Nextcloud, OpenWRT, MikroTik, WireGuard |
| **Облако** | Selectel (VPS, DNS) |
| **В изучении** | Kubernetes (kubeadm, multi-node), Helm, Argo CD, Ansible, Terraform |

---

## Структура репозитория

```
.
├── .github/workflows/github-actions.yaml  # CI/CD для GitHub
├── .gitlab-ci.yml                         # тот же пайплайн для GitLab
├── docker-compose.yml                     # все сервисы
├── cert.sh                                # выпуск SSL по DNS-01 (auto / manual)
├── scripts/deploy.sh                      # деплой на сервере + health-check
├── nginx/                                 # образ nginx, конфиг, entrypoint с фолбэком SSL
├── prometheus.yml                         # цели сбора метрик
├── bot/                                   # Telegram-бот графика рабочих дней
├── HomeLab/HomePage/                      # конфиги дашборда Homepage
└── html/
    ├── index.html, style.css, script.js   # сайт-визитка
    ├── images/                            # аватар, иконки технологий, резюме
    └── miki/                              # вики: app.js, generateFiles.js, docs/*.md
```

---

## CI/CD

Пайплайн запускается на push в `main` (и вручную через *Run workflow*). Для pull request выполняется только проверка.

1. **Build & validate** — генерация `html/miki/files.json`, проверка синтаксиса бота и shell-скриптов, `docker compose config`, сборка образов `nginx` и `workdays-bot`.
2. **Deploy** — `.env` и `secrets/acme.env` собираются из секретов, проект уходит архивом по SSH в `/opt/petweb`, затем на сервере запускается [`scripts/deploy.sh`](scripts/deploy.sh):
   - `cert.sh auto` — выпуск/продление сертификата (никогда не роняет деплой);
   - `docker compose up -d --build --remove-orphans`;
   - проверка, что nginx запущен и отвечает по HTTPS; остальные сервисы — предупреждением.

### Секреты GitHub (*Settings → Secrets and variables → Actions*)

| Секрет | Обязателен | Описание |
|--------|:---:|----------|
| `SSH_HOST` | ✅ | IP/домен сервера |
| `SSH_USERNAME` | ✅ | пользователь деплоя (в группе `docker`) |
| `SSH_PRIVATE_KEY` | ✅ | приватный ключ |
| `SSH_PORT` | | порт SSH, по умолчанию `22` |
| `BOT_TOKEN` | | токен Telegram-бота от @BotFather |
| `BOT_ADMIN_IDS` | | Telegram ID, которым разрешено менять отпуска (через запятую) |
| `GRAFANA_ADMIN_PASSWORD` | | пароль admin в Grafana |
| `CODE_SERVER_PASSWORD` | | пароль code-server |
| `ACME_EMAIL` | | почта для Let's Encrypt |
| `ACME_DNS_PROVIDER` | | плагин acme.sh: `dns_selectel`, `dns_regru`, `dns_cf`, … |
| `ACME_DNS_ENV` | | ключи API DNS-провайдера, построчно `KEY=VALUE` |

Переменная репозитория `DOMAIN` (*Variables*) — по умолчанию `chepykella.ru`.

GitLab: тот же пайплайн в [`.gitlab-ci.yml`](.gitlab-ci.yml), настройка — в [гайде по GitLab](html/miki/docs/GitLab/Гайд.md).

---

## SSL по DNS

Сертификат выпускается через **DNS-01**, поэтому подходит для wildcard и не требует открытого 80 порта.

```bash
./cert.sh          # авто: acme.sh + API DNS-провайдера (используется в CI)
./cert.sh manual   # вручную: certbot покажет TXT-записи, которые нужно добавить
```

Пример `secrets/acme.env` для Selectel (API v2):

```
SL_Ver=v2
SL_Expire=60
SL_Login_Name=dns-bot
SL_Login_ID=123456
SL_Project_Name=my-project
SL_Pswd=********
```

Другие провайдеры: https://github.com/acmesh-official/acme.sh/wiki/dnsapi

**Если выпустить не получилось** (нет ключей, ошибка API) — деплой всё равно продолжается: остаётся предыдущий сертификат, а при его отсутствии nginx при старте сгенерирует самоподписанный по тому же пути. Продление выполняет контейнер `acme` (acme.sh в режиме daemon), nginx перечитывает сертификат каждые 6 часов.

---

## Telegram-бот графика

Сервис `workdays-bot` в `docker-compose.yml` показывает, работает ли человек в конкретный день по сменному графику.

| Команда | Что делает |
|---------|-----------|
| `/today`, `/status` | статус на сегодня |
| `/tomorrow` | статус на завтра |
| `/week` | ближайшие 7 дней |
| `/month [ГГГГ-ММ]` | график на месяц + число рабочих смен |
| `/date ГГГГ-ММ-ДД` | статус на дату |
| `/next` | ближайшая смена и ближайший выходной |
| `/sun ГГГГ-ММ-ДД ГГГГ-ММ-ДД` | добавить отпуск |
| `/vacations`, `/delvacation N`, `/clearvacations` | управление отпусками |
| упоминание `@chepykella` | ответ «работает / выходной» |

Настройки (через `.env`):

| Переменная | По умолчанию | |
|------------|--------------|--|
| `BOT_TOKEN` | — | без него бот не стартует (контейнер просто остановится) |
| `SCHEDULE_START` | `2026-09-04` | первый день цикла |
| `SCHEDULE_PATTERN` | `N,N,O,O,O,D,D,O` | цикл: `N` ночь, `D` день, `O` выходной |
| `PERSON_TAG` | `@chepykella` | на чьё упоминание реагировать |
| `BOT_ADMIN_IDS` | пусто (все) | кто может менять отпуска |
| `TZ` | `Europe/Moscow` | часовой пояс расчёта дат |

Отпуска хранятся в volume `bot_data` и переживают пересоздание контейнера.

---

## Miki

Markdown-вики без бэкенда: файлы из `html/miki/docs/` → `generateFiles.js` строит дерево `files.json` (в CI это делается автоматически) → `app.js` рисует навигацию и рендерит страницу через marked + highlight.js.

- тёмная и светлая тема, поиск по дереву, адаптив под мобильные;
- прямые ссылки на страницы: `/miki/index.html#docs/roadmap.md`;
- ссылки между страницами в markdown: `[текст](#docs/Папка/Файл.md)`, якоря заголовков: `[шаг](#шаг-4-кластер-kubeadm)`.

Добавить страницу: положи `.md` в `html/miki/docs/<раздел>/` и запушь.

---

## Локальный запуск

```bash
git clone https://github.com/4pykella/PetWeb.git
cd PetWeb

touch .env                            # или заполни переменными из таблицы выше
node html/miki/generateFiles.js       # дерево Miki
./cert.sh manual                      # опционально: настоящий сертификат вручную

docker compose up -d --build
```

Без сертификата nginx поднимется на самоподписанном — браузер предупредит, это ожидаемо.
Только статика без Docker: `python -m http.server 8088 --directory html` → http://localhost:8088

---

## Roadmap

- [x] Автодеплой через GitHub Actions
- [x] Мониторинг сервера: Prometheus + Grafana + экспортеры
- [x] Wildcard SSL по DNS-01 с фолбэком
- [x] Telegram-бот графика в общем compose
- [x] GitLab CI
- [ ] Алерты о неудачном деплое и инцидентах в Telegram
- [ ] Перенос PetWeb в Kubernetes — пошагово в [роадмапе](html/miki/docs/roadmap.md)
- [ ] Наращивание базы знаний Miki

---

## Контрибьютинг

1. Сделай форк проекта
2. Создай ветку: `git checkout -b feature/имя-функции`
3. Закоммить изменения: `git commit -m "Добавляет X"`
4. Запушь и создай Pull Request — CI проверит сборку автоматически
