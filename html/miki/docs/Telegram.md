# Заработало в РФ
## TG WS Proxy 
[Ссылка на официальный Git](https://github.com/Flowseal/tg-ws-proxy/tree/main)

### Docker
1) Скачиваем docker https://docs.docker.com/engine/install/ubuntu/
2) Запускаем следующие команды.
```bash
    # Скачиваем репозиторий
    git clone https://github.com/Flowseal/tg-ws-proxy.git
    
    # Переходим в папку с проектом
    cd tg-ws-proxy
    
    # Собираем образ
    docker build -t tg-ws-proxy .
    
    # Запускаем контейнер
    docker run -d \
      --name tg-ws-proxy \
      --restart=always \
      -p 1443:1443 \
      tg-ws-proxy:latest
    
    # Получаем ссылку для подключения
    docker logs tg-ws-proxy 2>&1 | grep 'tg://proxy'
```
3) Вместо локального адреса подставляем свой адрес VDS и все раюотает под WG к этому же VDS.

### для Linux

Для Debian/Ubuntu скачайте со страницы релизов пакет TgWsProxy_linux_amd64.deb.

Для Arch и основанных на Arch дистрибутивов подготовлены пакеты в AUR:
```bash
    tg-ws-proxy-bin
    tg-ws-proxy-git
    tg-ws-proxy-cli
```
# Установка без AUR-helper
```bash
git clone https://aur.archlinux.org/tg-ws-proxy-bin.git
cd tg-ws-proxy-bin
makepkg -si

# При помощи AUR-helper
paru -S tg-ws-proxy-bin

# Для пакета -cli запуск через systemd (8888 — номер порта; secret можно сгенерировать командой openssl rand -hex 16)
sudo systemctl start tg-ws-proxy@8888:3075abe65830f0325116bb0416cadf9f
```

Для остальных дистрибутивов можно использовать TgWsProxy_linux_amd64 (бинарный файл для x86_64).
```bash
chmod +x TgWsProxy_linux_amd64
./TgWsProxy_linux_amd64
```
При первом запуске откроется окно с инструкцией. Приложение работает в системном трее (требуется AppIndicator).

# Ранишье работало на зарубежных VDS
## MTProto
[Ссылка на официальный Git](https://github.com/TelegramMessenger/MTProxy/)
## MTProto (форк)
1) Скачиваем docker https://docs.docker.com/engine/install/ubuntu/
2) Запускаем докер (ну вдруг кто не понял)
3) Запускаем образ на докере. Выставляем порт который вам подходит. В примере прокси на порту 8443
```bash
    docker run -d -p443:8443 --name=mtproxy --restart=always -v mtproxy:/data mtproxy/mtproxy && docker logs -f mtproxy
```
