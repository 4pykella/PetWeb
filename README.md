# PetWeb

[![CI/CD](https://github.com/4pykella/PetWeb/actions/workflows/github-actions.yaml/badge.svg)](https://github.com/4pykella/PetWeb/actions/workflows/github-actions.yaml)

Сайт-визитка, личная вики (**Miki**), дашборд HomeLab и набор сервисов на одном сервере — всё в Docker Compose за nginx, с автодеплоем из git.

🌐 https://www.chepykella.ru · 📖 [Miki](https://www.chepykella.ru/miki/) · 🏠 [Homepage](https://home.chepykella.ru)

---

> 📘 **[Инструкция по проекту](html/miki/docs/PetWeb/Инструкция.md)**: где лежат файлы, как работать через git и прямо на сервере (code-server), куда добавлять музыку, `.env`, SSL и Homepage. Она же есть в Miki: *PetWeb → Инструкция*.

---

## 📋 Содержание

- [Описание](#описание)
- [Архитектура](#архитектура)
- [Технологии](#технологии)
- [Структура репозитория](#структура-репозитория)
- [CI/CD](#cicd)
- [Пароли и .env](#пароли-и-env)
- [SSL](#ssl)
- [wg-easy (отдельный проект)](#wg-easy-отдельный-проект)
- [Miki](#miki)
- [Музыкальный плеер](#музыкальный-плеер)
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
                 │  .env с паролями уже лежит на сервере
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
 └──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Технологии

| Область | Что используется |
|---------|------------------|
| **Контейнеризация** | Docker, Docker Compose, multi-stage / non-root образы |
| **Веб и прокси** | Nginx (reverse proxy, HTTP/2, TLS 1.2/1.3), статический HTML/CSS/JS |
| **CI/CD** | GitHub Actions, GitLab CI (`.gitlab-ci.yml`), деплой по SSH, health-check |
| **TLS** | Let's Encrypt (certbot, вручную), wildcard `*.chepykella.ru`, самоподписанный фолбэк |
| **Мониторинг** | Prometheus, Grafana, Node Exporter, Nginx Prometheus Exporter |
| **Сервисы** | Portainer, Homepage, code-server |
| **VPN** (отдельно) | WireGuard + wg-easy — `wg-easy/` |
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
├── cert.sh                                # ручной выпуск SSL (certbot)
├── scripts/deploy.sh                      # деплой на сервере + health-check
├── nginx/                                 # образ nginx, конфиг, entrypoint с фолбэком SSL
├── prometheus.yml                         # цели сбора метрик
├── wg-easy/                               # WireGuard с веб-UI для VDS — отдельный проект
├── HomeLab/HomePage/                      # конфиги дашборда Homepage
└── html/
    ├── index.html, style.css, script.js   # сайт-визитка
    ├── music.js                           # скрытый музыкальный плеер
    ├── music/                             # треки для плеера + generatePlaylist.js
    ├── images/                            # аватар, иконки технологий, резюме
    └── miki/                              # вики: app.js, generateFiles.js, docs/*.md
```

---

## CI/CD

Пайплайн запускается на push в `main` (и вручную через *Run workflow*). Для pull request выполняется только проверка.

1. **Build & validate** — генерация `html/miki/files.json`, проверка shell-скриптов, `docker compose config`, сборка образов.
2. **Deploy** — по SSH на сервере в `/opt/petweb` (git-клон `main`): `git fetch` + `git reset --hard origin/main`, затем [`scripts/deploy.sh`](scripts/deploy.sh). Вручную то же самое: `cd /opt/petweb && git pull && bash scripts/deploy.sh`. `.env` с паролями не в git, он лежит только на сервере:
   - `docker compose up -d --build --remove-orphans`;
   - проверка, что nginx запущен и отвечает по HTTPS; остальные сервисы — предупреждением.

### Секреты GitHub (*Settings → Secrets and variables → Actions*)

| Секрет | Обязателен | Описание |
|--------|:---:|----------|
| `SSH_HOST` | ✅ | IP/домен сервера |
| `SSH_USERNAME` | ✅ | пользователь деплоя (в группе `docker`) |
| `SSH_PRIVATE_KEY` | ✅ | приватный ключ |
| `SSH_PORT` | | порт SSH, по умолчанию `22` |

Переменная репозитория `DOMAIN` (*Variables*) — по умолчанию `chepykella.ru`.

GitLab: тот же пайплайн в [`.gitlab-ci.yml`](.gitlab-ci.yml), настройка — в [гайде по GitLab](html/miki/docs/GitLab/Гайд.md).

---

## Пароли и `.env`

Все пароли и токены (Grafana, code-server, ключи виджетов Homepage) лежат в `/opt/petweb/.env` **только на сервере**. В git есть шаблон [`.env.example`](.env.example) с описанием каждой переменной:

```bash
cd /opt/petweb && cp .env.example .env && nano .env && chmod 600 .env && docker compose up -d
```

Без обязательных паролей (`GRAFANA_ADMIN_PASSWORD`, `CODE_SERVER_PASSWORD`) `docker compose` не запустится и подскажет, что заполнить.

---

## SSL

Сертификат выпускается **вручную** на сервере — CI его не трогает:

```bash
cd /opt/petweb
./cert.sh                      # certbot покажет TXT-записи _acme-challenge — добавь их в DNS Selectel
docker compose restart nginx   # подхватить новый сертификат
```

Выпускается wildcard `*.chepykella.ru` + `chepykella.ru` в `data/certbot/conf/live/www.chepykella.ru/`. Сертификат живёт 90 дней — повторяй до истечения.

Пока сертификата нет, nginx при старте генерирует самоподписанный по тому же пути, так что деплой и сайт работают (браузер покажет предупреждение).

---

## wg-easy (отдельный проект)

[`wg-easy/`](wg-easy/README.md) — WireGuard с веб-интерфейсом (wg-easy v15) для VDS, опционально HTTPS через Caddy. Не входит в основной стек и CI его не запускает: папку копируют на VDS, заполняют свой `.env` и делают `docker compose up -d`. Секреты wg-easy — только в `.env` на VDS.

Telegram-бот графика смен — тоже отдельный проект, но в этом репозитории он не хранится.

---

## Miki

Markdown-вики без бэкенда: файлы из `html/miki/docs/` → `generateFiles.js` строит дерево `files.json` (в CI это делается автоматически) → `app.js` рисует навигацию и рендерит страницу через marked + highlight.js. Оформление общее с визиткой.

- полнотекстовый поиск по всем страницам (`Ctrl K` или `/`): ранжирование по заголовкам, переход сразу к нужному разделу, подсветка совпадений, исправление раскладки («ljrth» → «докер»);
- оглавление страницы со scrollspy, хлебные крошки, время чтения, «назад / далее», ссылка на файл в GitHub;
- копирование блоков кода, якоря заголовков, относительные ссылки между `.md`;
- последняя открытая страница и недавние запросы запоминаются, фильтр дерева, свернуть / развернуть всё;
- тёмная и светлая тема (общая с визиткой), адаптив под мобильные;
- прямые ссылки на страницы: `/miki/index.html#docs/roadmap.md`;
- ссылки между страницами в markdown: `[текст](#docs/Папка/Файл.md)`, якоря заголовков: `[шаг](#шаг-4-кластер-kubeadm)`.

Добавить страницу: положи `.md` в `html/miki/docs/<раздел>/` и запушь.

---

## Музыкальный плеер

На визитке спрятан плеер: открывается сочетанием **Ctrl + Alt + M** или если набрать на странице слово `music` (раскладка не важна).

- Музыка лежит в [`html/music/`](html/music/README.md): `mp3`, `ogg`, `opus`, `m4a`, `aac`, `flac`, `wav`, `webm`. Имя файла `Исполнитель - Название.mp3` становится подписью трека.
- Добавлять треки можно через git или сразу на сервер в `/opt/petweb/html/music/`. nginx отдаёт список папки как JSON (`autoindex_format json`), поэтому новые файлы появляются без перезапуска. Локально и как запасной вариант используется `playlist.json` (`node html/music/generatePlaylist.js`, в CI — автоматически).
- Визуализатор спектра (Web Audio), перемешивание, повтор одного или всех треков, громкость запоминается, управление с клавиатуры (`Space`, `←`/`→`, `N`/`P`, `Esc`) и из системных медиа-кнопок.
- Если скрыть плеер, музыка продолжает играть, а в углу остаётся маленький индикатор, по которому плеер можно вернуть.

---

## Локальный запуск

```bash
git clone https://github.com/4pykella/PetWeb.git
cd PetWeb

cp .env.example .env                  # заполни пароли
node html/miki/generateFiles.js       # дерево Miki
./cert.sh                             # опционально: настоящий сертификат вручную

docker compose up -d --build
```

Без сертификата nginx поднимется на самоподписанном — браузер предупредит, это ожидаемо.
Только статика без Docker: `python -m http.server 8088 --directory html` → http://localhost:8088

---

## Roadmap

- [x] Автодеплой через GitHub Actions
- [x] Мониторинг сервера: Prometheus + Grafana + экспортеры
- [x] Wildcard SSL (выпуск вручную) с самоподписанным фолбэком
- [ ] wg-easy на VDS, туннель сервер ↔ дом
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
