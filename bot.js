const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN';
const ADMIN_ID = Number(process.env.ADMIN_ID) || YOUR_TELEGRAM_ID; // Впишите ваш ID цифрами
const API_URL = 'http://localhost:3000/api/admin';
const SECRET = process.env.ADMIN_SECRET || 'mysecret123';

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (chatId !== ADMIN_ID) {
        return bot.sendMessage(chatId, '⛔ У вас нет доступа к этому боту.');
    }
    bot.sendMessage(chatId, '👑 Привет, Админ! Панель управления Fast and Easy:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '👥 Список преподавателей', callback_data: 'list_teachers' }],
                [{ text: '➕ Добавить преподавателя', callback_data: 'add_teacher_prompt' }]
            ]
        }
    });
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    if (chatId !== ADMIN_ID) return;

    if (query.data === 'list_teachers') {
        try {
            const res = await fetch('http://localhost:3000/api/teachers');
            const teachers = await res.json();
            
            if (teachers.length === 0) {
                return bot.sendMessage(chatId, 'Список преподавателей пуст.');
            }

            for (let t of teachers) {
                bot.sendMessage(chatId, `${t.avatar} *${t.name}*\n${t.desc}`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🗑 Удалить', callback_data: `del_teacher_${t.id}` }]]
                    }
                });
            }
        } catch (e) {
            bot.sendMessage(chatId, 'Ошибка получения данных с сервера.');
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
    }
});

bot.onText(/\/add (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (chatId !== ADMIN_ID) return;

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

console.log('🤖 Telegram bot is running...');
