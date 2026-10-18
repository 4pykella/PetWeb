const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Исправленный импорт (для некоторых версий библиотеки)
const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');

const TOKEN = process.env.TOKEN || process.env.BOT_TOKEN;
if (!TOKEN) {
    // exit(0): при restart: on-failure контейнер не уйдёт в бесконечный рестарт
    console.error('❌ Токен не задан (переменная TOKEN / BOT_TOKEN) — бот не запущен');
    process.exit(0);
}

// ===== Конфигурация =====
// Цикл графика: N — ночная, D — дневная, O — выходной.
// По умолчанию: 2 ночи + 3 выходных + 2 дня + 1 выходной = 8 дней
const SCHEDULE_START = process.env.SCHEDULE_START || '2026-09-04';
const PATTERN = (process.env.SCHEDULE_PATTERN || 'N,N,O,O,O,D,D,O')
    .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const PERSON_TAG = process.env.PERSON_TAG || '@chepykella';
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const DATA_DIR = process.env.DATA_DIR || __dirname;
const VACATIONS_FILE = path.join(DATA_DIR, 'vacations.json');

const SHIFTS = {
    N: { full: 'работает (ночная смена) 🌙', short: '🌙 ночь', work: true },
    D: { full: 'работает (дневная смена) ☀️', short: '☀️ день', work: true },
    O: { full: 'выходной 🏠', short: '🏠 вых', work: false },
    V: { full: 'в отпуске 🏖️', short: '🏖️ отп', work: false },
};
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль',
    'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

if (PATTERN.length === 0 || PATTERN.some(p => !SHIFTS[p] || p === 'V')) {
    console.error(`❌ Неверный SCHEDULE_PATTERN: ${process.env.SCHEDULE_PATTERN}`);
    process.exit(1);
}

// ===== Работа с датами =====
// Все даты — локальная полночь (TZ контейнера), чтобы не ловить сдвиги из-за UTC.
function parseDate(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 ? d : null;
}

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

function fmt(date) {
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const START_DATE = parseDate(SCHEDULE_START);
if (!START_DATE) {
    console.error(`❌ Неверный SCHEDULE_START: ${SCHEDULE_START}`);
    process.exit(1);
}

// ===== Отпуска =====
let vacations = [];
try {
    vacations = JSON.parse(fs.readFileSync(VACATIONS_FILE, 'utf8'));
} catch (err) {
    vacations = [];
}

function saveVacations() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(VACATIONS_FILE, JSON.stringify(vacations, null, 2));
}

function isOnVacation(day) {
    return vacations.some(v => day >= parseDate(v.start) && day <= parseDate(v.end));
}

// ===== График =====
// Возвращает код смены на дату: N / D / O / V, либо null, если дата раньше старта графика
function getShift(date) {
    const day = startOfDay(date);
    if (isOnVacation(day)) return 'V';
    // Math.round — защита от часа перехода на летнее время
    const diffDays = Math.round((day - START_DATE) / 86400000);
    if (diffDays < 0) return null;
    return PATTERN[diffDays % PATTERN.length];
}

function statusText(date) {
    const code = getShift(date);
    return code ? SHIFTS[code].full : 'неизвестно (до начала графика)';
}

function dayLine(date) {
    const code = getShift(date);
    const label = code ? SHIFTS[code].short : '❓';
    return `${fmt(date)} ${WEEKDAYS[date.getDay()]} — ${label}`;
}

function renderMonth(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lines = [];
    let work = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const code = getShift(date);
        if (code && SHIFTS[code].work) work++;
        lines.push(dayLine(date));
    }
    return `📅 ${MONTHS[month]} ${year}\n` +
        `Рабочих смен: ${work} из ${daysInMonth}\n\n` +
        lines.join('\n');
}

// Ближайший рабочий день (или выходной), начиная с завтра
function findNext(from, wantWork) {
    for (let i = 1; i <= 366; i++) {
        const d = addDays(from, i);
        const code = getShift(d);
        if (code && SHIFTS[code].work === wantWork) return { date: d, code };
    }
    return null;
}

// ===== Бот =====
const bot = new TelegramBot(TOKEN, { polling: true });

const HELP = [
    `🤖 Бот графика ${PERSON_TAG}`,
    '',
    '/today — что сегодня',
    '/tomorrow — что завтра',
    '/week — ближайшие 7 дней',
    '/month [ГГГГ-ММ] — график на месяц',
    '/date ГГГГ-ММ-ДД — статус на дату',
    '/next — ближайшая смена и ближайший выходной',
    '/vacations — список отпусков',
    '/sun ГГГГ-ММ-ДД ГГГГ-ММ-ДД — добавить отпуск',
    '/delvacation N — удалить отпуск по номеру',
    '/clearvacations — удалить все отпуска',
    '',
    `Упомяни ${PERSON_TAG} в чате — бот подскажет, работает ли он сейчас.`,
].join('\n');

bot.setMyCommands([
    { command: 'today', description: 'Статус на сегодня' },
    { command: 'tomorrow', description: 'Статус на завтра' },
    { command: 'week', description: 'Ближайшие 7 дней' },
    { command: 'month', description: 'График на месяц' },
    { command: 'next', description: 'Ближайшая смена / выходной' },
    { command: 'vacations', description: 'Список отпусков' },
    { command: 'help', description: 'Справка' },
]).catch(err => console.error('setMyCommands:', err.message));

// Изменять отпуска могут только ADMIN_IDS (если список пуст — все)
function canEdit(msg) {
    if (ADMIN_IDS.length === 0) return true;
    if (ADMIN_IDS.includes(String(msg.from && msg.from.id))) return true;
    bot.sendMessage(msg.chat.id, '⛔ Менять отпуска может только владелец графика');
    return false;
}

// Регистрация команды: /cmd, /cmd@botname, /cmd аргументы
function command(name, handler) {
    bot.onText(new RegExp(`^/${name}(?:@\\w+)?(?:\\s+(.+))?$`), (msg, match) => {
        try {
            handler(msg, (match[1] || '').trim());
        } catch (err) {
            console.error(`/${name}:`, err);
            bot.sendMessage(msg.chat.id, '❌ Что-то пошло не так');
        }
    });
}

function addVacation(chatId, startStr, endStr) {
    const start = parseDate(startStr);
    const end = parseDate(endStr);
    if (!start || !end) {
        bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте ГГГГ-ММ-ДД');
        return;
    }
    if (start > end) {
        bot.sendMessage(chatId, '❌ Дата начала не может быть позже даты конца');
        return;
    }
    vacations.push({ start: startStr, end: endStr });
    vacations.sort((a, b) => a.start.localeCompare(b.start));
    saveVacations();
    bot.sendMessage(chatId, `✅ Отпуск установлен с ${startStr} по ${endStr}`);
}

// Хранилище ожидающих ввода отпуска
const waitingForVacation = new Set();

command('start', msg => bot.sendMessage(msg.chat.id, HELP));
command('help', msg => bot.sendMessage(msg.chat.id, HELP));

command('(?:status|today)', msg => {
    const now = new Date();
    bot.sendMessage(msg.chat.id, `📆 Сегодня (${now.toLocaleDateString('ru-RU')}): ${statusText(now)}`);
});

command('tomorrow', msg => {
    const d = addDays(new Date(), 1);
    bot.sendMessage(msg.chat.id, `📆 Завтра (${d.toLocaleDateString('ru-RU')}): ${statusText(d)}`);
});

command('week', msg => {
    const today = startOfDay(new Date());
    const lines = [];
    for (let i = 0; i < 7; i++) lines.push(dayLine(addDays(today, i)));
    bot.sendMessage(msg.chat.id, `🗓 Ближайшие 7 дней:\n\n${lines.join('\n')}`);
});

command('month', (msg, arg) => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    if (arg) {
        const m = /^(\d{4})-(\d{2})$/.exec(arg);
        if (!m || +m[2] < 1 || +m[2] > 12) {
            bot.sendMessage(msg.chat.id, '❌ Неверный формат. Используйте ГГГГ-ММ, например /month 2026-09');
            return;
        }
        year = +m[1];
        month = +m[2] - 1;
    }
    bot.sendMessage(msg.chat.id, renderMonth(year, month));
});

command('date', (msg, arg) => {
    const d = parseDate(arg);
    if (!d) {
        bot.sendMessage(msg.chat.id, '❌ Используйте /date ГГГГ-ММ-ДД');
        return;
    }
    bot.sendMessage(msg.chat.id, `📆 ${d.toLocaleDateString('ru-RU')} (${WEEKDAYS[d.getDay()]}): ${statusText(d)}`);
});

command('next', msg => {
    const today = startOfDay(new Date());
    const work = findNext(today, true);
    const rest = findNext(today, false);
    const lines = [`Сегодня: ${statusText(today)}`];
    if (work) lines.push(`Ближайшая смена: ${fmt(work.date)} ${WEEKDAYS[work.date.getDay()]} — ${SHIFTS[work.code].short}`);
    if (rest) lines.push(`Ближайший выходной: ${fmt(rest.date)} ${WEEKDAYS[rest.date.getDay()]}`);
    bot.sendMessage(msg.chat.id, lines.join('\n'));
});

// Команда /sun — установка отпуска
command('sun', (msg, arg) => {
    if (!canEdit(msg)) return;
    const parts = arg.split(/\s+/).filter(Boolean);
    if (parts.length === 2) {
        addVacation(msg.chat.id, parts[0], parts[1]);
    } else {
        bot.sendMessage(msg.chat.id, 'Введите даты отпуска в формате:\n`начало конец`\nНапример: `2026-09-10 2026-09-15`', { parse_mode: 'Markdown' });
        waitingForVacation.add(`${msg.chat.id}:${msg.from && msg.from.id}`);
    }
});

command('vacations', msg => {
    if (vacations.length === 0) {
        bot.sendMessage(msg.chat.id, '📭 Нет запланированных отпусков');
        return;
    }
    const list = vacations.map((v, i) => `${i + 1}. с ${v.start} по ${v.end}`).join('\n');
    bot.sendMessage(msg.chat.id, `📅 Текущие отпуска:\n${list}`);
});

command('delvacation', (msg, arg) => {
    if (!canEdit(msg)) return;
    const n = parseInt(arg, 10);
    if (!n || n < 1 || n > vacations.length) {
        bot.sendMessage(msg.chat.id, '❌ Укажите номер из /vacations, например /delvacation 1');
        return;
    }
    const [removed] = vacations.splice(n - 1, 1);
    saveVacations();
    bot.sendMessage(msg.chat.id, `🗑 Удалён отпуск с ${removed.start} по ${removed.end}`);
});

command('clearvacations', msg => {
    if (!canEdit(msg)) return;
    vacations = [];
    saveVacations();
    bot.sendMessage(msg.chat.id, '✅ Все отпуска удалены');
});

// Обработка обычных сообщений: ввод отпуска после /sun и упоминания
bot.on('message', (msg) => {
    const text = msg.text;
    if (!text || text.startsWith('/')) return;

    const key = `${msg.chat.id}:${msg.from && msg.from.id}`;
    if (waitingForVacation.has(key)) {
        waitingForVacation.delete(key);
        const parts = text.trim().split(/\s+/);
        if (parts.length !== 2) {
            bot.sendMessage(msg.chat.id, '❌ Нужно ввести две даты через пробел');
            return;
        }
        addVacation(msg.chat.id, parts[0], parts[1]);
        return;
    }

    // Реагируем на упоминание (не команда)
    if (text.toLowerCase().includes(PERSON_TAG.toLowerCase())) {
        bot.sendMessage(msg.chat.id, `${PERSON_TAG} сейчас: ${statusText(new Date())}`);
    }
});

bot.on('polling_error', err => console.error('polling_error:', err.code, err.message));

process.on('SIGTERM', () => {
    bot.stopPolling().finally(() => process.exit(0));
});

console.log(`🤖 Бот запущен. Старт графика: ${SCHEDULE_START}, цикл: ${PATTERN.join(',')}`);
