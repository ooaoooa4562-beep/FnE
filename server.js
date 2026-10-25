const express = require('express');
const path = require('path');
const app = express();

// Middleware для обработки JSON
app.use(express.json());

// Раздаем статические файлы (index.html, style.css, script.js и т.д.) из корневой папки
app.use(express.static(path.join(__dirname)));

// API-маршрут для обработки формы и отправки заявки в Telegram
app.post('/api/submit', async (req, res) => {
    try {
        const { name, phone, course, level, goals } = req.body;
        
        const botToken = process.env.BOT_TOKEN;
        const chatId = process.env.CHAT_ID;

        if (!botToken || !chatId) {
            return res.status(500).json({ 
                success: false, 
                error: 'Токены не настроены в переменной окружения' 
            });
        }

        const message = `Новая заявка (FnE):\nИмя: ${name}\nТелефон: ${phone}\nКурс: ${course}\nУровень: ${level}\nЦели: ${goals}`;

        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message
            })
        });

        const data = await response.json();
        if (!data.ok) {
            throw new Error('Ошибка при отправке сообщения в Telegram');
        }

        res.status(200).json({ success: true, message: 'Заявка успешно отправлена!' });
    } catch (error) {
        console.error('Ошибка сервера:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
