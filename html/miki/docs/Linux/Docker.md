# Docker - Полное руководство
## Что такое Docker?

Docker — это платформа для разработки, доставки и запуска приложений в контейнерах. Контейнеры позволяют упаковать приложение со всеми его зависимостями в стандартизированную единицу для разработки.

### Преимущества Docker
- **Изоляция**: Приложения работают изолированно друг от друга
- **Переносимость**: Контейнеры работают одинаково на любой системе
- **Масштабируемость**: Легкое масштабирование приложений
- **Эффективность**: Меньшее потребление ресурсов по сравнению с виртуальными машинами

## Основные концепции

### Образ (Image)
Шаблон только для чтения, используемый для создания контейнеров. Содержит ОС, приложение и все зависимости.

### Контейнер (Container)
Запущенный экземпляр образа. Контейнеры изолированы друг от друга и от хостовой системы.

### Dockerfile
Текстовый файл с инструкциями для сборки образа.

### Docker Hub
Реестр образов Docker, где можно хранить и делиться образами.

## Установка Docker

### Ubuntu/Debian
```bash
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка и апдейт
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Проверка статусов 
sudo systemctl status docker
sudo docker run hello-world

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
```

### Windows
Скачиваем просто образ с офф сайта 
https://docs.docker.com/desktop/setup/install/windows-install/

## Базовые команды

### Информация о системе
```bash
# Проверка версии Docker
docker --version

# Информация о системе Docker
docker system info

# Просмотр использования ресурсов
docker system df
```

### Работа с образами
```bash
# Скачать образ
docker pull ubuntu:20.04

# Просмотреть локальные образы
docker images

# Удалить образ
docker rmi ubuntu:20.04

# Поиск образов в Docker Hub
docker search nginx
```

### Работа с контейнерами
```bash
# Запустить контейнер
docker run -it ubuntu:20.04 /bin/bash

# Запустить контейнер в фоновом режиме
docker run -d --name my-container nginx

# Просмотреть запущенные контейнеры
docker ps

# Просмотреть все контейнеры
docker ps -a

# Остановить контейнер
docker stop my-container

# Удалить контейнер
docker rm my-container

# Просмотреть логи контейнера
docker logs my-container

# Выполнить команду в running контейнере
docker exec -it my-container /bin/bash
```

## Dockerfile

### Базовый пример Dockerfile
```dockerfile
# Базовый образ
FROM ubuntu:20.04

# Метаданные
LABEL maintainer="your-email@example.com"
LABEL version="1.0"
LABEL description="Пример Dockerfile"

# Установка переменных окружения
ENV APP_HOME /app
ENV NODE_ENV production

# Создание рабочей директории
WORKDIR $APP_HOME

# Копирование файлов
COPY package.json .
COPY src/ ./src/

# Установка зависимостей
RUN apt update && apt install -y nodejs npm
RUN npm install

# Открытие порта
EXPOSE 3000

# Команда запуска
CMD ["npm", "start"]
```

### Инструкции Dockerfile
- `FROM`: Базовый образ
- `RUN`: Выполнение команд при сборке
- `COPY`: Копирование файлов из хоста в контейнер
- `ADD`: Аналогично COPY, но с дополнительными функциями
- `CMD`: Команда по умолчанию при запуске контейнера
- `ENTRYPOINT`: Точка входа для контейнера
- `ENV`: Установка переменных окружения
- `ARG`: Определение переменных сборки
- `EXPOSE`: Объявление портов
- `WORKDIR`: Установка рабочей директории

### Сборка образа
```bash
docker build -t my-app:1.0 .
docker build -f Dockerfile.dev -t my-app:dev .
```

## Docker Compose

### docker-compose.yml пример
```yaml
version: '3.8'

services:
  web:
    image: nginx:alpine
    container_name: my-web
    ports:
      - "80:80"
    volumes:
      - ./html:/usr/share/nginx/html
    networks:
      - my-network
    depends_on:
      - db

  db:
    image: postgres:13
    container_name: my-database
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - my-network

  redis:
    image: redis:alpine
    container_name: my-redis
    networks:
      - my-network

volumes:
  db_data:

networks:
  my-network:
    driver: bridge
```

### Команды Docker Compose
```bash
# Запуск сервисов
docker-compose up -d

# Остановка сервисов
docker-compose down

# Просмотр логов
docker-compose logs

# Пересборка и запуск
docker-compose up --build

# Выполнение команды в сервисе
docker-compose exec web /bin/bash
```

## Управление образами

### Тегирование образов
```bash
# Добавление тега
docker tag my-app:1.0 my-registry.com/my-app:1.0

# Пуш образа в реестр
docker push my-registry.com/my-app:1.0

# Пулл образа из реестра
docker pull my-registry.com/my-app:1.0
```

### Экспорт и импорт
```bash
# Сохранение образа в файл
docker save -o my-app.tar my-app:1.0

# Загрузка образа из файла
docker load -i my-app.tar
```

## Управление контейнерами

### Мониторинг
```bash
# Статистика использования ресурсов
docker stats

# Просмотр процессов в контейнере
docker top my-container

# Инспектирование контейнера
docker inspect my-container
```

### Ресурсы контейнера
```bash
# Ограничение памяти
docker run -d --name my-app --memory=512m my-app:1.0

# Ограничение CPU
docker run -d --name my-app --cpus=1.5 my-app:1.0

# Перезапуск политики
docker run -d --name my-app --restart=always my-app:1.0
```

## Работа с сетями

### Создание сетей
```bash
# Создание bridge сети
docker network create my-network

# Просмотр сетей
docker network ls

# Подключение контейнера к сети
docker network connect my-network my-container

# Отключение контейнера от сети
docker network disconnect my-network my-container
```

### Типы сетей
- **bridge**: Сеть по умолчанию для контейнеров
- **host**: Использование сети хоста
- **none**: Без сети
- **overlay**: Сеть для Swarm кластера

## Работа с томами

### Управление томами
```bash
# Создание тома
docker volume create my-volume

# Просмотр томов
docker volume ls

# Удаление тома
docker volume rm my-volume
```

### Использование томов
```bash
# Монтирование тома
docker run -v my-volume:/data my-app:1.0

# Bind mount (привязка директории)
docker run -v /host/path:/container/path my-app:1.0

# Tmpfs mount (в памяти)
docker run --tmpfs /app/cache my-app:1.0
```

## Практические примеры

### Пример 1: Веб-приложение Node.js
```dockerfile
FROM node:14-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
```

### Пример 2: Python приложение
```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "app.py"]
```

### Пример 3: База данных с инициализацией
```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: myapp
      MYSQL_USER: appuser
      MYSQL_PASSWORD: apppass
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "3306:3306"

volumes:
  mysql_data:
```

### Полезные команды для отладки
```bash
# Просмотр всех ресурсов
docker system df
docker system prune

# Очистка неиспользуемых ресурсов
docker system prune -a

# Просмотр событий Docker
docker system events

# Проверка дискового пространства
docker system df -v
```

## Лучшие практики

1. **Используйте .dockerignore** для исключения ненужных файлов
2. **Многоступенчатая сборка** для уменьшения размера образов
3. **Не запускайте процессы от root** внутри контейнеров
4. **Используйте конкретные версии тегов** вместо latest
5. **Ограничивайте ресурсы** контейнеров
6. **Одна служба на контейнер**
7. **Используйте HEALTHCHECK** для мониторинга здоровья

Это руководство покрывает основные аспекты работы с Docker. Для более глубокого изучения рекомендуется обратиться к официальной документации Docker.
