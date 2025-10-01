# Rustdesk

## Настройка Rustdesk client
### Установка
Переходим на офф сайт или гит репозиторий. Скачиваем нужную версию
https://rustdesk.com/
https://github.com/rustdesk/rustdesk/releases/tag/1.4.2

### Настройка 
1) Заходим в настройки через значек ручки.
2) Сеть.
3) запоняем ID, ретранслятор и Key.
4) Закрываем и перезагружаем.


## Настройка Rustdesk Server с использованием Docker

Это руководство предоставляет инструкции по настройке сервера Rustdesk с использованием Docker.

### Предварительные требования

- Docker установлен в системе
- Наличие прав для выполнения команд Docker

### Шаги установки

#### 1. Загрузка образа Rustdesk Server
```bash
sudo docker image pull rustdesk/rustdesk-server
```

#### 2. Запуск сервера HBBS (Rustdesk ID)
```bash
sudo docker run --name hbbs -v ./data:/root -td --net=host --restart unless-stopped rustdesk/rustdesk-server hbbs
```

#### 3. Запуск сервера HBBR (Relay)
```bash
sudo docker run --name hbbr -v ./data:/root -td --net=host --restart unless-stopped rustdesk/rustdesk-server hbbr
```

#### 4. Доступ к сгенерированным ключам
```bash
cd /data
cat id_ed**.pub
```

### Объяснение параметров Docker

- `--name`: Присваивает имя контейнеру
- `-v ./data:/root`: Подключает том для сохранения данных
- `-td`: Запускает контейнер в фоновом режиме с псевдо-TTY
- `--net=host`: Использует сетевой стек хоста
- `--restart unless-stopped`: Автоматически перезапускает контейнер, если он не был явно остановлен

### Важные примечания

- Файл `id_ed**.pub` содержит публичный ключ, необходимый для подключения клиентов
- Обязательно запишите ключ, отображаемый командой `cat`, так как он требуется для настройки клиента
- Убедитесь в правильной настройке файрвола для разрешения трафика Rustdesk
