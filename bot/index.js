const dotenv = require('dotenv');
const fs = require('fs');

// Исправленный импорт (для некоторых версий библиотеки)
const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');

dotenv.config();

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
    console.error('Токен не задан в .env');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// Конфигурация графика
const START_DATE = new Date(2026, 8, 4); // 4 сентября 2026
const CYCLE_LENGTH = 8; // 2 ночи + 3 выходных + 2 дня + 1 выходной

// Файл для хранения отпусков
const VACATIONS_FILE = 'vacations.json';

// Загрузка отпусков
let vacations = [];
try {
    const data = fs.readFileSync(VACATIONS_FILE, 'utf8');
    vacations = JSON.parse(data);
} catch (err) {
    vacations = [];
}

function saveVacations() {
    fs.writeFileSync(VACATIONS_FILE, JSON.stringify(vacations, null, 2));
}

// Определение статуса на дату
function getStatus(date) {
    // Проверяем отпуск
    for (const vac of vacations) {
        const start = new Date(vac.start);
        const end = new Date(vac.end);
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        if (d >= start && d <= end) {
            return 'в отпуске 🏖️';
        }
    }

    const diffDays = Math.floor((date - START_DATE) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
        return 'неизвестно (до начала графика)';
    }

    const dayInCycle = diffDays % CYCLE_LENGTH;
    switch (dayInCycle) {
        case 0:
        case 1:
            return 'работает (ночная смена) 🌙';
        case 2:
        case 3:
        case 4:
            return 'выходной 🏠';
        case 5:
        case 6:
            return 'работает (дневная смена) ☀️';
        case 7:
            return 'выходной 🏠';
        default:
            return 'ошибка';
    }
}

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
        chatId,
        'Тегайте пидоры'
    );
});

// Команда /status
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const now = new Date();
    const status = getStatus(now);
    bot.sendMessage(chatId, `📆 Сегодня (${now.toLocaleDateString('ru-RU')}): ${status}`);
});

// Команда /month
bot.onText(/\/month(?:\s+(\d{4}-\d{2}))?/, (msg, match) => {
    const chatId = msg.chat.id;
    let year, month;
    if (match[1]) {
        const parts = match[1].split('-');
        year = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1; // 0-11
        if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
            bot.sendMessage(chatId, '❌ Неверный формат. Используйте ГГГГ-ММ, например /month 2026-09');
            return;
        }
    } else {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth();
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let result = `📅 График на ${year}-${String(month+1).padStart(2,'0')}:\n\n`;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const status = getStatus(date);
        // Сокращённый статус для компактности
        let shortStatus;
        if (status.includes('ночная')) shortStatus = '🌙 ночная';
        else if (status.includes('дневная')) shortStatus = '☀️ дневная';
        else if (status.includes('отпуске')) shortStatus = '🏖️ отпуск';
        else if (status.includes('выходной')) shortStatus = '🏠 выходной';
        else shortStatus = '❓ ' + status;

        const dayStr = `${String(d).padStart(2,'0')}.${String(month+1).padStart(2,'0')}`;
        result += `${dayStr}: ${shortStatus}\n`;
    }
    bot.sendMessage(chatId, result);
});

// Команда /sun — установка отпуска
bot.onText(/\/sun(?:\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2}))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const startStr = match[1];
    const endStr = match[2];

    if (startStr && endStr) {
        const start = new Date(startStr);
        const end = new Date(endStr);
        if (isNaN(start) || isNaN(end)) {
            bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте ГГГГ-ММ-ДД');
            return;
        }
        if (start > end) {
            bot.sendMessage(chatId, '❌ Дата начала не может быть позже даты конца');
            return;
        }
        vacations.push({ start: startStr, end: endStr });
        saveVacations();
        bot.sendMessage(chatId, `✅ Отпуск установлен с ${startStr} по ${endStr}`);
    } else {
        bot.sendMessage(chatId, 'Введите даты отпуска в формате:\n`начало конец`\nНапример: `2026-09-10 2026-09-15`', { parse_mode: 'Markdown' });
        waitingForVacation.set(chatId, true);
    }
});

// Хранилище ожидающих ввода отпуска
const waitingForVacation = new Map();

// Обработка всех текстовых сообщений (для упоминаний и ввода отпуска)
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Если ожидается ввод отпуска
    if (waitingForVacation.has(chatId) && text) {
        waitingForVacation.delete(chatId);
        const parts = text.trim().split(/\s+/);
        if (parts.length !== 2) {
            bot.sendMessage(chatId, '❌ Нужно ввести две даты через пробел');
            return;
        }
        const startStr = parts[0];
        const endStr = parts[1];
        const start = new Date(startStr);
        const end = new Date(endStr);
        if (isNaN(start) || isNaN(end)) {
            bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте ГГГГ-ММ-ДД');
            return;
        }
        if (start > end) {
            bot.sendMessage(chatId, '❌ Дата начала не может быть позже даты конца');
            return;
        }
        vacations.push({ start: startStr, end: endStr });
        saveVacations();
        bot.sendMessage(chatId, `✅ Отпуск установлен с ${startStr} по ${endStr}`);
        return;
    }

    // Реагируем на упоминание @chepykella (не команда)
    if (text && text.includes('@chepykella') && !text.startsWith('/')) {
        const now = new Date();
        const status = getStatus(now);
        bot.sendMessage(chatId, `@chepykella сейчас: ${status}`);
    }
});

// Команда /vacations
bot.onText(/\/vacations/, (msg) => {
    const chatId = msg.chat.id;
    if (vacations.length === 0) {
        bot.sendMessage(chatId, '📭 Нет запланированных отпусков');
    } else {
        let list = vacations.map((v, i) => `${i+1}. с ${v.start} по ${v.end}`).join('\n');
        bot.sendMessage(chatId, `📅 Текущие отпуска:\n${list}`);
    }
});

// Команда /clearvacations
bot.onText(/\/clearvacations/, (msg) => {
    const chatId = msg.chat.id;
    vacations = [];
    saveVacations();
    bot.sendMessage(chatId, '✅ Все отпуска удалены');
});

console.log('🤖 Бот запущен и готов к работе!');