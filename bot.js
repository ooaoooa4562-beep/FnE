// bot.js — модуль для отправки заявок в Telegram

async function sendLeadToTelegram(leadData) {
    const { name, phone, course, level, message } = leadData;
    
    // Токен и чат берутся из защищенных переменных окружения Render
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        throw new Error('Telegram token or chat ID is missing in environment variables');
    }

    const text = `
✨ <b>НОВАЯ ЗАЯВКА НА ОБУЧЕНИЕ!</b> ✨
━━━━━━━━━━━━━━━━━━━━
👤 <b>ФИО:</b> ${name}
📞 <b>Телефон:</b> ${phone}
📚 <b>Курс:</b> ${course}
🎯 <b>Текущий уровень:</b> ${level}
💬 <b>Цель:</b> ${message || 'Не указана'}
━━━━━━━━━━━━━━━━━━━━
⏰ <i>Время: ${new Date().toLocaleString('ru-RU')}</i>
    `;

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        })
    });

    const data = await response.json();

    if (!data.ok) {
        throw new Error(data.description || 'Telegram API error');
    }

    return data;
}

module.exports = { sendLeadToTelegram };
