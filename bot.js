const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS 
    ? process.env.ADMIN_IDS.split(',').map(id => Number(id.trim())) 
    : [];

const BACKEND_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
const API_URL = `${BACKEND_URL}/api/admin`;
const SECRET = process.env.ADMIN_SECRET;

const bot = new TelegramBot(TOKEN, { polling: true });

function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

function sendMainMenu(chatId) {
    bot.sendMessage(chatId, '👑 *Панель администратора Fast and Easy*\n\nВыберите нужный раздел:', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📥 Заявки с сайта', callback_data: 'list_leads' }, { text: '📊 Статистика', callback_data: 'get_stats' }],
                [{ text: '👥 Преподаватели', callback_data: 'list_teachers' }, { text: '📜 Сертификаты', callback_data: 'list_certs' }],
                [{ text: '➕ Добавить учителя', callback_data: 'add_teacher_prompt' }, { text: '➕ Добавить сертификат', callback_data: 'add_cert_prompt' }],
                [{ text: '📢 Рассылка админам', callback_data: 'broadcast_prompt' }]
            ]
        }
    });
}

bot.onText(/\/start/, (msg) => {
    if (!isAdmin(msg.chat.id)) return bot.sendMessage(msg.chat.id, '⛔ У вас нет доступа к этому боту.');
    sendMainMenu(msg.chat.id);
});

bot.onText(/\/add_teacher (.+)/, async (msg, match) => {
    if (!isAdmin(msg.chat.id)) return;
    const parts = match[1].split('|').map(p => p.trim());
    if (parts.length < 2) return bot.sendMessage(msg.chat.id, '⚠️ Формат: `/add_teacher Имя | Описание | Эмодзи`', { parse_mode: 'Markdown' });

    try {
        await fetch(`${API_URL}/teacher`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: SECRET, name: parts[0], desc: parts[1], avatar: parts[2] || '👩‍🏫' })
        });
        bot.sendMessage(msg.chat.id, `✅ Преподаватель "${parts[0]}" успешно добавлен!`);
    } catch (e) {
        bot.sendMessage(msg.chat.id, '❌ Ошибка при добавлении преподавателя.');
    }
});

bot.onText(/\/add_cert (.+)/, async (msg, match) => {
    if (!isAdmin(msg.chat.id)) return;
    const parts = match[1].split('|').map(p => p.trim());
    if (parts.length < 2) return bot.sendMessage(msg.chat.id, '⚠️ Формат: `/add_cert Название | Описание`', { parse_mode: 'Markdown' });

    try {
        await fetch(`${API_URL}/cert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: SECRET, title: parts[0], desc: parts[1] })
        });
        bot.sendMessage(msg.chat.id, `✅ Сертификат "${parts[0]}" успешно добавлен!`);
    } catch (e) {
        bot.sendMessage(msg.chat.id, '❌ Ошибка при добавлении сертификата.');
    }
});

bot.onText(/\/broadcast (.+)/, (msg, match) => {
    if (!isAdmin(msg.chat.id)) return;
    const text = match[1];
    ADMIN_IDS.forEach(id => {
        bot.sendMessage(id, `📢 *Объявление от администратора:*\n\n${text}`, { parse_mode: 'Markdown' });
    });
    bot.sendMessage(msg.chat.id, '✅ Сообщение успешно разослано всем администраторам!');
});

// Публикация анонса в Telegram-канал прямо из бота: /post_channel Текст
bot.onText(/\/post_channel (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    const postText = match[1];
    const channelId = process.env.CHANNEL_ID;

    if (!channelId) {
        return bot.sendMessage(chatId, '⚠️ Переменная CHANNEL_ID не настроена в окружении.');
    }

    try {
        await bot.sendMessage(channelId, postText, { parse_mode: 'Markdown' });
        bot.sendMessage(chatId, '📢 *Пост успешно опубликован в канале!*', { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, '❌ Ошибка публикации в канал. Убедитесь, что бот добавлен в администраторы канала.');
    }
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    if (!isAdmin(chatId)) return;

    if (query.data === 'get_stats') {
        try {
            const res = await fetch(`${API_URL}/stats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret: SECRET })
            });
            const s = await res.json();
            bot.sendMessage(chatId, `📊 *Статистика центра Fast and Easy:*\n\n📩 Всего заявок: *${s.leadsCount}*\n🆕 Новых заявок: *${s.newLeadsCount}*\n👩‍🏫 Преподавателей: *${s.teachersCount}*\n📜 Сертификатов: *${s.certsCount}*`, { parse_mode: 'Markdown' });
            bot.answerCallbackQuery(query.id);
        } catch (e) {
            bot.sendMessage(chatId, 'Ошибка получения статистики.');
        }
    } else if (query.data === 'list_leads') {
        try {
            const res = await fetch(`${API_URL}/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret: SECRET })
            });
            const leads = await res.json();

            if (leads.length === 0) return bot.sendMessage(chatId, 'Список заявок пуст.');

            for (let l of leads.slice(0, 5)) {
                const statusBadge = l.status === 'processed' ? '✅ Обработана' : '🆕 Новая';
                bot.sendMessage(chatId, `📋 *Заявка от ${l.date}*\n\n👤 *Имя:* ${l.name}\n📞 *Тел:* ${l.phone}\n📚 *Курс:* ${l.course}\n📊 *Уровень:* ${l.level}\n🎯 *Цель:* ${l.goals || 'Нет'}\nСтатус: *${statusBadge}*`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ Отметить обработанной', callback_data: `lead_done_${l.id}` }]
                        ]
                    }
                });
            }
            bot.answerCallbackQuery(query.id);
        } catch (e) {
            bot.sendMessage(chatId, 'Ошибка загрузки заявок.');
        }
    } else if (query.data.startsWith('lead_done_')) {
        const id = query.data.split('_')[2];
        try {
            await fetch(`${API_URL}/leads/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret: SECRET, id, status: 'processed' })
            });
            bot.answerCallbackQuery(query.id, { text: 'Заявка обработана!' });
            bot.editMessageText('✅ *Заявка успешно обработана!*', { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
        } catch (e) {
            bot.answerCallbackQuery(query.id, { text: 'Ошибка изменения статуса.' });
        }
    } else if (query.data === 'list_teachers') {
        try {
            const res = await fetch(`${BACKEND_URL}/api/teachers`);
            const teachers = await res.json();
            if (teachers.length === 0) return bot.sendMessage(chatId, 'Список преподавателей пуст.');

            for (let t of teachers) {
                bot.sendMessage(chatId, `${t.avatar} *${t.name}*\n${t.desc}`, {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: '🗑 Удалить', callback_data: `del_teacher_${t.id}` }]] }
                });
            }
            bot.answerCallbackQuery(query.id);
        } catch (e) {
            bot.sendMessage(chatId, 'Ошибка получения преподавателей.');
        }
    } else if (query.data === 'list_certs') {
        try {
            const res = await fetch(`${BACKEND_URL}/api/certificates`);
            const certs = await res.json();
            if (certs.length === 0) return bot.sendMessage(chatId, 'Список сертификатов пуст.');

            for (let c of certs) {
                bot.sendMessage(chatId, `📜 *${c.title}*\n${c.desc}`, {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: '🗑 Удалить', callback_data: `del_cert_${c.id}` }]] }
                });
            }
            bot.answerCallbackQuery(query.id);
        } catch (e) {
            bot.sendMessage(chatId, 'Ошибка получения сертификатов.');
        }
    } else if (query.data.startsWith('del_teacher_')) {
        const id = query.data.split('_')[2];
        await fetch(`${API_URL}/teacher/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: SECRET }) });
        bot.answerCallbackQuery(query.id, { text: 'Удалено!' });
        bot.editMessageText('❌ Преподаватель удален.', { chat_id: chatId, message_id: query.message.message_id });
    } else if (query.data.startsWith('del_cert_')) {
        const id = query.data.split('_')[2];
        await fetch(`${API_URL}/cert/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: SECRET }) });
        bot.answerCallbackQuery(query.id, { text: 'Удалено!' });
        bot.editMessageText('❌ Сертификат удален.', { chat_id: chatId, message_id: query.message.message_id });
    } else if (query.data === 'add_teacher_prompt') {
        bot.sendMessage(chatId, 'Отправьте команду:\n`/add_teacher Имя | Описание | Эмодзи`', { parse_mode: 'Markdown' });
        bot.answerCallbackQuery(query.id);
    } else if (query.data === 'add_cert_prompt') {
        bot.sendMessage(chatId, 'Отправьте команду:\n`/add_cert Название | Описание`', { parse_mode: 'Markdown' });
        bot.answerCallbackQuery(query.id);
    } else if (query.data === 'broadcast_prompt') {
        bot.sendMessage(chatId, 'Отправьте команду для рассылки:\n`/broadcast Текст объявления`', { parse_mode: 'Markdown' });
        bot.answerCallbackQuery(query.id);
    }
});

console.log('🤖 Telegram bot with full CRM & Channel support is running...');
