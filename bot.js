const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;
// Читаем список админов из переменных окружения (перечислены через запятую)
const ADMIN_IDS = process.env.ADMIN_IDS 
    ? process.env.ADMIN_IDS.split(',').map(id => Number(id.trim())) 
    : [];

// Определяем базовый URL бэкенда (на Render подставляется ваш адрес или localhost)
const BACKEND_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
const API_URL = `${BACKEND_URL}/api/admin`;
const SECRET = process.env.ADMIN_SECRET;

const bot = new TelegramBot(TOKEN, { polling: true });

function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        return bot.sendMessage(chatId, '⛔ У вас нет доступа к этому боту.');
    }
    bot.sendMessage(chatId, '👑 Панель управления Fast and Easy:', {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '👥 Преподаватели', callback_data: 'list_teachers' },
                    { text: '📜 Сертификаты', callback_data: 'list_certs' }
                ],
                [
                    { text: '➕ Добавить преподавателя', callback_data: 'add_teacher_prompt' }
                ]
            ]
        }
    });
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    if (!isAdmin(chatId)) return;

    if (query.data === 'list_teachers') {
        try {
            const res = await fetch(`${BACKEND_URL}/api/teachers`);
            const teachers = await res.json();
            
            if (teachers.length === 0) return bot.sendMessage(chatId, 'Список преподавателей пуст.');

            for (let t of teachers) {
                bot.sendMessage(chatId, `${t.avatar} *${t.name}*\n${t.desc}`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🗑 Удалить', callback_data: `del_teacher_${t.id}` }]]
                    }
                });
            }
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
                    reply_markup: {
                        inline_keyboard: [[{ text: '🗑 Удалить', callback_data: `del_cert_${c.id}` }]]
                    }
                });
            }
        } catch (e) {
            bot.sendMessage(chatId, 'Ошибка получения сертификатов.');
        }
    } else if (query.data === 'add_teacher_prompt') {
        bot.sendMessage(chatId, 'Отправьте данные в формате:\n`/add Имя | Описание | Эмодзи`', { parse_mode: 'Markdown' });
    } else if (query.data.startsWith('del_teacher_')) {
        const id = query.data.split('_')[2];
        try {
            await fetch(`${API_URL}/teacher/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret: SECRET })
            });
            bot.answerCallbackQuery(query.id, { text: 'Успешно удалено!' });
            bot.editMessageText('❌ Преподаватель удален.', { chat_id: chatId, message_id: query.message.message_id });
        } catch (e) {
            bot.answerCallbackQuery(query.id, { text: 'Ошибка удаления.' });
        }
    } else if (query.data.startsWith('del_cert_')) {
        const id = query.data.split('_')[2];
        try {
            await fetch(`${API_URL}/cert/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret: SECRET })
            });
            bot.answerCallbackQuery(query.id, { text: 'Сертификат удален!' });
            bot.editMessageText('❌ Сертификат удален.', { chat_id: chatId, message_id: query.message.message_id });
        } catch (e) {
            bot.answerCallbackQuery(query.id, { text: 'Ошибка удаления.' });
        }
    }
});

bot.onText(/\/add (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    const parts = match[1].split('|').map(p => p.trim());
    if (parts.length < 2) {
        return bot.sendMessage(chatId, '⚠️ Неверный формат. Используйте: `/add Имя | Описание | Эмодзи`', { parse_mode: 'Markdown' });
    }

    const [name, desc, avatar] = parts;

    try {
        await fetch(`${API_URL}/teacher`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: SECRET, name, desc, avatar })
        });
        bot.sendMessage(chatId, `✅ Преподаватель "${name}" успешно добавлен!`);
    } catch (e) {
        bot.sendMessage(chatId, '❌ Ошибка при добавлении на сервер.');
    }
});

console.log('🤖 Telegram bot is running for multiple admins...');
