## MTProto
[Ссылка на официальный Git](https://github.com/TelegramMessenger/MTProxy/)
## MTProto (форк)
1) Скачиваем docker https://docs.docker.com/engine/install/ubuntu/
2) Запускаем докер (ну вдруг кто не понял)
3) Запускаем образ на докере. Выставляем порт который вам подходит. В примере прокси на порту 8443
```bash
    docker run -d -p8443:443 --name=mtproxy --restart=always -v mtproxy:/data mtproxy/mtproxy && docker logs -f mtproxy
```