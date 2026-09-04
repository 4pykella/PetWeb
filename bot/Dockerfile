# Используем официальный образ Node.js LTS
FROM node:18-alpine

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем package.json и package-lock.json (если есть)
COPY package*.json ./

# Устанавливаем зависимости проекта
RUN npm install

# Копируем исходный код
COPY . .

# Создаём пользователя без прав root для безопасности
RUN addgroup -g 1001 -S botuser && adduser -S botuser -u 1001 -G botuser
RUN chown -R botuser:botuser /app
USER botuser

# Команда запуска
CMD ["npm", "start"]