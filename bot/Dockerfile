# Официальный образ Node.js LTS
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# tzdata — чтобы TZ=Europe/Moscow корректно влиял на расчёт дат
RUN apk add --no-cache tzdata

# Сначала зависимости — так слой кэшируется между сборками
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY index.js ./

# Пользователь без прав root; data/ — volume для vacations.json
RUN addgroup -g 1001 -S botuser && adduser -S botuser -u 1001 -G botuser \
    && mkdir -p /app/data && chown -R botuser:botuser /app
USER botuser

CMD ["node", "index.js"]
