const express = require('express');
const path = require('path');
const app = express();

// Middleware для работы с JSON-данными от формы
app.use(express.json());

// Раздача статических файлов (index.html, стили, скрипты) из корневой папки
app.use(express.static(path.join(__dirname)));

// Пример эндпоинта для обработки формы регистрации и отправки в Telegram
app.post('/api/submit', async (req, res) => {
    try {
        const { name, phone, course, level, goals } = req.body;
        
        // Секретные данные подтягиваются из переменных окружения Vercel или .env
        const botToken = process.env.BOT_TOKEN;
        const chatId = process.env.CHAT_ID;

        // Проверка наличия токенов
        if (!botToken || !chatId) {
            return res.status(500).json({ success: false, error: 'Токены не настроены в переменных окружения' });
        }

        // Текст сообщения для Telegram
        const message = `Новая заявка:\nИмя: ${name}\nТелефон: ${phone}\nКурс: ${course}\nУровень: ${level}\nЦели: ${goals}`;

        // Отправка в Telegram
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
            throw new Error('Ошибка при отправке в Telegram');
        }

        res.status(200).json({ success: true, message: 'Заявка успешно отправлена!' });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
});

// Автоматический выбор порта для локальной разработки и Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
