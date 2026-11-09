# Заработало в РФ
## TG WS Proxy 
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
